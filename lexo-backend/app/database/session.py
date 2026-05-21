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
    """Create tables (idempotent) and ensure Alembic version is stamped.

    On a fresh database, ``create_all`` creates all tables and we stamp
    Alembic to ``head`` so future deploys can run ``alembic upgrade head``
    incrementally.  On an existing database, ``create_all`` is a no-op and
    the Alembic stamp is skipped.
    """
    try:
        async with engine.begin() as conn:
            already_stamped = await _alembic_version_exists(conn)
            await conn.run_sync(Base.metadata.create_all)

        if not already_stamped:
            # Fresh DB: stamp to head so future upgrades work incrementally.
            try:
                _run_alembic('stamp')
                logger.info("Alembic stamped to head on fresh database")
            except Exception as exc:
                logger.warning(f"Alembic stamp failed (non-fatal): {exc}")
        else:
            # Existing DB: apply any pending schema migrations (e.g. new columns).
            try:
                _run_alembic('upgrade')
                logger.info("Alembic migrations applied (or already at head)")
            except Exception as exc:
                logger.error(f"Alembic upgrade failed: {exc}")
                raise  # surface the error so the deploy fails loudly instead of silently

        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise


if __name__ == "__main__":
    import asyncio
    asyncio.run(init_db())
    logger.info("Database initialized successfully!")
