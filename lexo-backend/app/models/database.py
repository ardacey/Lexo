from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    supabase_user_id = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    games_as_player1 = relationship(
        "GameHistory", 
        back_populates="player1", 
        foreign_keys="GameHistory.player1_id"
    )
    games_as_player2 = relationship(
        "GameHistory", 
        back_populates="player2", 
        foreign_keys="GameHistory.player2_id"
    )
    stats = relationship("UserStats", back_populates="user", uselist=False)
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class GameHistory(Base):
    __tablename__ = "game_history"
    
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(String, unique=True, index=True)
    
    player1_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    player2_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    player1_score = Column(Integer, default=0)
    player2_score = Column(Integer, default=0)
    player1_words = Column(Text)
    player2_words = Column(Text)
    
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    duration = Column(Integer, default=60)
    letter_pool = Column(String)
    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    ended_at = Column(DateTime, default=datetime.utcnow, index=True)
    
    player1 = relationship(
        "User", 
        back_populates="games_as_player1", 
        foreign_keys=[player1_id]
    )
    player2 = relationship(
        "User", 
        back_populates="games_as_player2", 
        foreign_keys=[player2_id]
    )
    
    # Composite indexes for common queries
    __table_args__ = (
        # Index for finding games by player
        Index('ix_game_player1_started', 'player1_id', 'started_at'),
        Index('ix_game_player2_started', 'player2_id', 'started_at'),
        # Index for leaderboard queries (winner + time)
        Index('ix_game_winner_ended', 'winner_id', 'ended_at'),
        # Index for recent games
        Index('ix_game_ended_at_desc', 'ended_at'),
    )
    
    def __repr__(self):
        return f"<GameHistory(id={self.id}, room_id={self.room_id})>"


class UserStats(Base):
    __tablename__ = "user_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)

    total_games = Column(Integer, default=0, index=True)
    wins = Column(Integer, default=0, index=True)
    losses = Column(Integer, default=0)
    ties = Column(Integer, default=0)

    total_score = Column(Integer, default=0, index=True)
    highest_score = Column(Integer, default=0, index=True)
    average_score = Column(Float, default=0.0)

    total_words = Column(Integer, default=0)
    longest_word = Column(String, default="")
    longest_word_length = Column(Integer, default=0, index=True)

    total_play_time = Column(Integer, default=0)

    current_win_streak = Column(Integer, default=0, index=True)
    best_win_streak = Column(Integer, default=0, index=True)

    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="stats")
    
    # Composite indexes for leaderboard queries
    __table_args__ = (
        # Index for wins leaderboard
        Index('ix_stats_wins_desc', 'wins', 'total_games'),
        # Index for highest score leaderboard
        Index('ix_stats_highest_score_desc', 'highest_score'),
        # Index for win streak leaderboard
        Index('ix_stats_best_streak_desc', 'best_win_streak'),
        # Index for total score leaderboard
        Index('ix_stats_total_score_desc', 'total_score'),
    )
    
    @property
    def win_rate(self) -> float:
        if self.total_games == 0:
            return 0.0
        return (self.wins / self.total_games) * 100
    
    def __repr__(self):
        return f"<UserStats(user_id={self.user_id}, total_games={self.total_games}, wins={self.wins})>"
