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


async def _apply_schema_patches(conn) -> None:
    """Ensure all required schema additions are present, regardless of Alembic state.

    This guards against the race condition on Render free-tier where two workers
    can both run Alembic concurrently: one worker updates ``alembic_version`` while
    the other's DDL transaction is rolled back, leaving the version table ahead of
    the real schema.  All statements use IF NOT EXISTS so they are cheap no-ops
    once the schema is correct.
    """
    # ── user_stats.elo_rating ─────────────────────────────────────────────────
    await conn.execute(text(
        "ALTER TABLE user_stats "
        "ADD COLUMN IF NOT EXISTS elo_rating INTEGER NOT NULL DEFAULT 1000"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_stats_elo_rating_desc "
        "ON user_stats (elo_rating)"
    ))

    # ── daily_challenges ──────────────────────────────────────────────────────
    await conn.execute(text(
        """
        CREATE TABLE IF NOT EXISTS daily_challenges (
            id          SERIAL PRIMARY KEY,
            date        DATE      NOT NULL UNIQUE,
            letter_pool VARCHAR   NOT NULL,
            created_at  TIMESTAMP DEFAULT now()
        )
        """
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenges_date "
        "ON daily_challenges (date)"
    ))

    # ── daily_challenge_entries ───────────────────────────────────────────────
    await conn.execute(text(
        """
        CREATE TABLE IF NOT EXISTS daily_challenge_entries (
            id             SERIAL PRIMARY KEY,
            user_id        INTEGER   NOT NULL REFERENCES users(id),
            challenge_date DATE      NOT NULL,
            score          INTEGER   DEFAULT 0,
            words          TEXT,
            word_count     INTEGER   DEFAULT 0,
            completed_at   TIMESTAMP DEFAULT now()
        )
        """
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenge_entries_user_id "
        "ON daily_challenge_entries (user_id)"
    ))
    await conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenge_entries_challenge_date "
        "ON daily_challenge_entries (challenge_date)"
    ))
    await conn.execute(text(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_dce_user_date "
        "ON daily_challenge_entries (user_id, challenge_date)"
    ))


async def init_db() -> None:
    """Initialise the database schema, handling both fresh and existing databases.

    Fresh database
    --------------
    ``create_all`` creates every table in one shot, then we stamp Alembic to
    ``head`` so future deploys run incremental migrations instead of
    re-creating tables from scratch.

    Existing database
    -----------------
    Migrations are handled by ``alembic upgrade head`` which runs in the
    Procfile web command **before** gunicorn starts (single-worker, no race).
    Workers therefore find the DB already at head and skip Alembic entirely.
    We do NOT call ``create_all`` here — SQLAlchemy would eagerly create every
    table including ones owned by pending migrations, causing Alembic to fail
    with "relation already exists".
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
            # Alembic upgrade already ran in the Procfile startup command.
            # Apply any schema patches that Alembic may have missed (e.g. when
            # alembic_version was updated by one worker but DDL was rolled back
            # by the concurrent second worker on Render free tier).
            logger.info("Database already initialised; applying schema patches...")
            try:
                async with engine.begin() as conn:
                    await _apply_schema_patches(conn)
                logger.info("Schema patches applied successfully")
            except Exception as exc:
                # Log but don't crash — a patch failure usually means the
                # column/table already exists and the IF NOT EXISTS guard fired,
                # or the table being patched doesn't exist yet (will be created
                # by create_all on first fresh deploy).
                logger.warning(f"Schema patch step had a warning (non-fatal): {exc}")

        logger.info("Database initialised successfully")
    except Exception as e:
        logger.error(f"Database initialisation failed: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    import asyncio
    asyncio.run(init_db())
    logger.info("Database initialized successfully!")
