"""
Pytest configuration and shared fixtures
"""
import os
import pytest
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

import importlib
from app.core import config
from app.models.database import Base
from app.database.session import get_db
from app.services.word_service import WordService
from app.core.config import settings
from app.api.dependencies.auth import get_current_user

os.environ[
    "CORS_ORIGINS"
] = "http://localhost:8081,http://localhost:19006,http://localhost:19000"
os.environ["ENVIRONMENT"] = "development"


# Test database URL
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test.db"


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


@pytest.fixture(scope="function")
def client(db_session) -> Generator[TestClient, None, None]:
    """Create test client with database override and patch DB URL for app startup"""
    # Patch the settings.database.url to use SQLite for app startup (init_db)
    config.settings.database.url = SQLALCHEMY_TEST_DATABASE_URL
    # Re-import app after patching config so FastAPI app uses the test DB
    app_module = importlib.import_module("app.main")
    app = app_module.app
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    async def override_get_current_user():
        return {"user_id": "test_user_id", "claims": {"sub": "test_user_id"}}
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


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
