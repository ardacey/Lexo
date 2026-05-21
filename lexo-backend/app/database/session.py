from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
import logging
import os

from app.core.config import settings
from app.models.database import Base

logger = logging.getLogger(__name__)

# Absolute path to the lexo-backend/ directory (where alembic.ini lives).
# session.py is at lexo-backend/app/database/session.py → three levels up.
_BACKEND_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))


def _run_alembic(command: str) -> None:
    """Run an Alembic command via its Python API (no subprocess / PATH dependency)."""
    from alembic.config import Config
    from alembic import command as alembic_command

    alembic_ini = os.path.join(_BACKEND_DIR, 'alembic.ini')
    cfg = Config(alembic_ini)
    # Make sure the script_location inside alembic.ini resolves correctly.
    cfg.set_main_option('script_location', os.path.join(_BACKEND_DIR, 'alembic'))

    if command == 'upgrade':
        alembic_command.upgrade(cfg, 'head')
    elif command == 'stamp':
        alembic_command.stamp(cfg, 'head')

engine = create_async_engine(
    settings.database.async_url,
    echo=settings.database.echo,
    pool_pre_ping=True,
    pool_size=int(settings.database.pool_size),
    max_overflow=int(settings.database.max_overflow),
    pool_timeout=30,
    pool_recycle=3600,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


async def _alembic_version_exists(conn) -> bool:
    """Return True if the alembic_version table is already present."""
    result = await conn.execute(
        text(
            "SELECT EXISTS ("
            "  SELECT 1 FROM information_schema.tables"
            "  WHERE table_name = 'alembic_version'"
            ")"
        )
    )
    return bool(result.scalar())


async def init_db() -> None:
    """Initialise the database schema, handling both fresh and existing databases.

    Fresh database
    --------------
    ``create_all`` creates every table in one shot, then we stamp Alembic to
    ``head`` so future deploys run incremental migrations instead of re-creating
    tables from scratch.

    Existing database
    -----------------
    We do **not** call ``create_all`` here.  SQLAlchemy's ``create_all`` sees
    every model and would create any table that does not yet exist — including
    tables that belong to *pending* Alembic migrations.  That means Alembic
    would then try to ``CREATE TABLE`` something that already exists and fail.

    Instead, we let Alembic be the sole owner of DDL on existing databases.

    Race condition (multiple gunicorn workers)
    ------------------------------------------
    All workers call ``init_db()`` at startup in parallel.  We use a
    PostgreSQL session-level advisory lock (arbitrary key 9_876_543_210) so
    only one worker runs ``alembic upgrade head`` at a time.  The others block
    until the first worker finishes, then see "already at head" and return
    immediately.
    """
    try:
        async with engine.begin() as conn:
            already_stamped = await _alembic_version_exists(conn)

        if not already_stamped:
            # ── Fresh DB ──────────────────────────────────────────────────────
            # Create all tables in one pass, then stamp so future deploys use
            # incremental Alembic migrations rather than re-running create_all.
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            try:
                _run_alembic('stamp')
                logger.info("Alembic stamped to head on fresh database")
            except Exception as exc:
                logger.warning(f"Alembic stamp failed (non-fatal): {exc}")

        else:
            # ── Existing DB ───────────────────────────────────────────────────
            # Advisory lock serialises migration runs across workers.
            # Key 9_876_543_210 is arbitrary; it just needs to be consistent.
            async with engine.connect() as lock_conn:
                await lock_conn.execute(
                    text("SELECT pg_advisory_lock(9876543210)")
                )
                try:
                    _run_alembic('upgrade')
                    logger.info("Alembic migrations applied (or already at head)")
                except Exception as exc:
                    logger.error(f"Alembic upgrade failed: {exc}", exc_info=True)
                    raise
                finally:
                    # Always release — even if the migration raised, so that
                    # other workers are not left waiting forever.
                    try:
                        await lock_conn.execute(
                            text("SELECT pg_advisory_unlock(9876543210)")
                        )
                    except Exception:
                        pass  # Connection may already be broken; lock auto-releases.

        logger.info("Database initialised successfully")
    except Exception as e:
        logger.error(f"Database initialisation failed: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    import asyncio
    asyncio.run(init_db())
    logger.info("Database initialized successfully!")
