from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text
import logging
import subprocess

from app.core.config import settings
from app.models.database import Base

logger = logging.getLogger(__name__)

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
            # Fresh DB: stamp to head so future `alembic upgrade head` works.
            result = subprocess.run(
                ["alembic", "stamp", "head"],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                logger.info("Alembic stamped to head on fresh database")
            else:
                logger.warning(
                    f"Alembic stamp failed (non-fatal): {result.stderr.strip()}"
                )
        else:
            # Existing DB: apply any pending schema migrations automatically.
            result = subprocess.run(
                ["alembic", "upgrade", "head"],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                logger.info("Alembic migrations applied (or already at head)")
            else:
                logger.warning(
                    f"Alembic upgrade failed (non-fatal): {result.stderr.strip()}"
                )

        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise


if __name__ == "__main__":
    import asyncio
    asyncio.run(init_db())
    logger.info("Database initialized successfully!")
