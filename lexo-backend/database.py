from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config import DATABASE_URL
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    clerk_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    games_as_player1 = relationship("GameHistory", back_populates="player1", foreign_keys="GameHistory.player1_id")
    games_as_player2 = relationship("GameHistory", back_populates="player2", foreign_keys="GameHistory.player2_id")
    stats = relationship("UserStats", back_populates="user", uselist=False)
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class GameHistory(Base):
    __tablename__ = "game_history"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String, unique=True, index=True)

    player1_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    player2_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    player1_score = Column(Integer, default=0)
    player2_score = Column(Integer, default=0)
    player1_words = Column(Text)
    player2_words = Column(Text)
    
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    duration = Column(Integer, default=60)
    letter_pool = Column(String)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, default=datetime.utcnow)
    
    player1 = relationship("User", back_populates="games_as_player1", foreign_keys=[player1_id])
    player2 = relationship("User", back_populates="games_as_player2", foreign_keys=[player2_id])
    
    def __repr__(self):
        return f"<GameHistory(id={self.id}, room_id={self.room_id})>"


class UserStats(Base):
    __tablename__ = "user_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    total_games = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    ties = Column(Integer, default=0)
    
    total_score = Column(Integer, default=0)
    highest_score = Column(Integer, default=0)
    average_score = Column(Float, default=0.0)
    
    total_words = Column(Integer, default=0)
    longest_word = Column(String, default="")
    longest_word_length = Column(Integer, default=0)
    
    total_play_time = Column(Integer, default=0)
    
    current_win_streak = Column(Integer, default=0)
    best_win_streak = Column(Integer, default=0)
    
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="stats")
    
    @property
    def win_rate(self) -> float:
        if self.total_games == 0:
            return 0.0
        return (self.wins / self.total_games) * 100
    
    def __repr__(self):
        return f"<UserStats(user_id={self.user_id}, total_games={self.total_games}, wins={self.wins})>"


def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise


def drop_all_tables():
    Base.metadata.drop_all(bind=engine)
    logger.warning("All database tables dropped")


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")
