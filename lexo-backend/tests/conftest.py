"""
Pytest configuration and shared fixtures.

The `client` fixture boots the FastAPI app via Starlette's TestClient.
All external I/O that runs in the lifespan (Postgres init, Redis init,
WebSocketBridge Pub/Sub listener) is mocked so tests run without any
real infrastructure.
"""
import os
import importlib
import pytest
from typing import Generator
from unittest.mock import AsyncMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

import fakeredis.aioredis as fakeredis

from app.core import config
from app.models.database import Base
from app.database.session import get_db
from app.services.word_service import WordService
from app.services.ws_bridge import WebSocketBridge
from app.core.config import settings
from app.api.dependencies.auth import get_current_user

os.environ[
    "CORS_ORIGINS"
] = "http://localhost:8081,http://localhost:19006,http://localhost:19000"
os.environ["ENVIRONMENT"] = "development"


# Test database URL (SQLite in-memory, sync — used only by old sync fixtures)
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test.db"


# ---------------------------------------------------------------------------
# Sync SQLite fixtures (kept for legacy tests)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def test_engine():
    """Create test database engine"""
    engine = create_engine(
        SQLALCHEMY_TEST_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(test_engine) -> Generator[Session, None, None]:
    """Create a fresh database session for each test"""
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
# HTTP test client  (mocks all external I/O in the lifespan)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def client(db_session) -> Generator[TestClient, None, None]:
    """
    TestClient with mocked DB and Redis startup.

    Patches applied for the duration of every test:
      - app.main.init_db      → AsyncMock (no Postgres connection)
      - app.main.init_redis   → returns a FakeRedis instance
      - app.main.close_redis  → AsyncMock (no-op teardown)
      - WebSocketBridge.start → AsyncMock (no Pub/Sub task created)
      - WebSocketBridge.stop  → AsyncMock (no task to cancel)
    """
    config.settings.database.url = SQLALCHEMY_TEST_DATABASE_URL
    app_module = importlib.import_module("app.main")
    app = app_module.app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    async def override_get_current_user():
        return {"user_id": "test_user_id", "claims": {"sub": "test_user_id"}}

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    fake_redis = fakeredis.FakeRedis(decode_responses=True)

    with patch("app.main.init_db", new_callable=AsyncMock), \
         patch("app.main.init_redis", AsyncMock(return_value=fake_redis)), \
         patch("app.main.close_redis", new_callable=AsyncMock), \
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
    """Create WordService instance for testing"""
    return WordService()


@pytest.fixture
def sample_letter_pool() -> list[str]:
    """Sample letter pool for testing"""
    return ['a', 'e', 'i', 'k', 'l', 'm', 'n', 'r', 's', 't', 'u', 'ı', 'ş', 'ç', 'ğ', 'ü']


@pytest.fixture
def sample_words() -> list[str]:
    """Sample valid Turkish words for testing"""
    return ['kelime', 'test', 'at', 'ev', 'deneme', 'masa', 'kale']


@pytest.fixture
def invalid_words() -> list[str]:
    """Sample invalid words for testing"""
    return ['xxx', 'zzz', 'qwerty', 'asdfgh']


@pytest.fixture
def test_user(db_session):
    """Create a test user for testing"""
    from app.models.database import User
    import uuid

    user = User(
        supabase_user_id=f"test_user_{uuid.uuid4().hex[:8]}",
        username=f"testuser_{uuid.uuid4().hex[:8]}",
        email=f"test_{uuid.uuid4().hex[:8]}@example.com"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user
