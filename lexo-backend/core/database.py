from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import QueuePool
import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./lexo.db")

if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args = {
        "check_same_thread": False,
        "timeout": 30
    }

if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args=connect_args, 
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=False
    )
else:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args=connect_args,
        poolclass=QueuePool,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
        pool_timeout=30,
        echo=False
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        from fastapi import HTTPException
        if not isinstance(e, HTTPException):
            logger.error(f"Database session error: {e}")
        db.rollback()
        raise
    finally:
        db.close()