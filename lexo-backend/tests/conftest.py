"""
Pytest configuration and shared fixtures
"""
import pytest
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from app.main import app
from app.models.database import Base
from app.database.session import get_db
from app.services.word_service import WordService
from app.core.config import settings


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
    """Create test client with database override"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
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
