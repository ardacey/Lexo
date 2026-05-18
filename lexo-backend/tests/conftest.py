"""
Pytest configuration and shared fixtures.

The `client` fixture boots the FastAPI app via Starlette's TestClient.
All external I/O that runs in the lifespan (Postgres init, Redis init,
WebSocketBridge Pub/Sub listener) is mocked so tests run without any
real infrastructure.

The `async_db_session` fixture provides a fresh in-memory SQLite
AsyncSession for each repository test.
"""
import os
import importlib
import pytest
import uuid
from typing import Generator
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

import fakeredis.aioredis as fakeredis

from app.core import config
from app.models.database import Base, User
from app.database.session import get_db
from app.services.word_service import WordService
from app.services.ws_bridge import WebSocketBridge
from app.core.config import settings
from app.api.dependencies.auth import get_current_user

os.environ[
    "CORS_ORIGINS"
] = "http://localhost:8081,http://localhost:19006,http://localhost:19000"
os.environ["ENVIRONMENT"] = "development"


# ---------------------------------------------------------------------------
# Sync SQLite fixtures (legacy — for tests that only need plain DB rows)
# ---------------------------------------------------------------------------

SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test.db"


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        SQLALCHEMY_TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine
    )
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


# ---------------------------------------------------------------------------
# Async SQLite fixtures (for repository unit tests)
# ---------------------------------------------------------------------------

@pytest.fixture
async def async_db_session():
    """
    Fresh in-memory AsyncSession (SQLite/aiosqlite) for each test.
    Repositories require AsyncSession; this fixture provides an isolated one
    without needing a running Postgres instance.
    """
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def async_test_user(async_db_session):
    """Test User row inserted into the async in-memory database."""
    user = User(
        supabase_user_id=f"test_user_{uuid.uuid4().hex[:8]}",
        username=f"testuser_{uuid.uuid4().hex[:8]}",
        email=f"test_{uuid.uuid4().hex[:8]}@example.com",
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


# ---------------------------------------------------------------------------
# HTTP test client  (mocks all external I/O in the lifespan)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def client(db_session) -> Generator[TestClient, None, None]:
    """
    TestClient with mocked DB and Redis startup.

    Patches applied for the duration of every test:
      - app.main.init_db          → AsyncMock (no Postgres connection)
      - app.main.init_redis       → returns a FakeRedis instance
      - app.main.close_redis      → AsyncMock (no-op teardown)
      - app.core.redis._redis     → same FakeRedis (makes get_redis() work)
      - WebSocketBridge.start     → AsyncMock (no Pub/Sub task)
      - WebSocketBridge.stop      → AsyncMock
    The get_db dependency yields an AsyncMock session so that
    `await db.execute(...)` inside async endpoints resolves cleanly.
    """
    config.settings.database.url = SQLALCHEMY_TEST_DATABASE_URL
    app_module = importlib.import_module("app.main")
    app = app_module.app

    async def override_get_db():
        yield AsyncMock()

    async def override_get_current_user():
        return {"user_id": "test_user_id", "claims": {"sub": "test_user_id"}}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    fake_redis = fakeredis.FakeRedis(decode_responses=True)

    with patch("app.main.init_db", new_callable=AsyncMock), \
         patch("app.main.init_redis", AsyncMock(return_value=fake_redis)), \
         patch("app.main.close_redis", new_callable=AsyncMock), \
         patch("app.core.redis._redis", fake_redis), \
         patch.object(WebSocketBridge, "start", new_callable=AsyncMock), \
         patch.object(WebSocketBridge, "stop", new_callable=AsyncMock):
        with TestClient(app) as test_client:
            yield test_client

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Misc shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def word_service() -> WordService:
    return WordService()


@pytest.fixture
def sample_letter_pool() -> list[str]:
    return ['a', 'e', 'i', 'k', 'l', 'm', 'n', 'r', 's', 't', 'u', 'ı', 'ş', 'ç', 'ğ', 'ü']


@pytest.fixture
def sample_words() -> list[str]:
    return ['kelime', 'test', 'at', 'ev', 'deneme', 'masa', 'kale']


@pytest.fixture
def invalid_words() -> list[str]:
    return ['xxx', 'zzz', 'qwerty', 'asdfgh']


@pytest.fixture
def test_user(db_session):
    """Sync test user for legacy sync-session tests."""
    user = User(
        supabase_user_id=f"test_user_{uuid.uuid4().hex[:8]}",
        username=f"testuser_{uuid.uuid4().hex[:8]}",
        email=f"test_{uuid.uuid4().hex[:8]}@example.com",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user
