from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.database import Base

class UserStats(Base):
    __tablename__ = "user_stats"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True, nullable=False)
    
    total_games = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    draws = Column(Integer, default=0)
    
    total_score = Column(Integer, default=0)
    highest_score = Column(Integer, default=0)
    average_score = Column(Integer, default=0)
    
    total_words = Column(Integer, default=0)
    longest_word_length = Column(Integer, default=0)
    longest_word = Column(String, default="")
    
    total_playtime_seconds = Column(Integer, default=0)
    
    classic_games = Column(Integer, default=0)
    battle_royale_games = Column(Integer, default=0)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class GameHistory(Base):
    __tablename__ = "game_history"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    room_id = Column(String, nullable=False)
    
    game_mode = Column(String, nullable=False)
    result = Column(String, nullable=False)
    score = Column(Integer, default=0)
    words_played = Column(Integer, default=0)
    
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=False)
    duration_seconds = Column(Integer, default=0)
    
    final_position = Column(Integer, nullable=True)
    total_players = Column(Integer, default=2)
    
    created_at = Column(DateTime, server_default=func.now())

class WordHistory(Base):
    __tablename__ = "word_history"
    
    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    game_history_id = Column(String, ForeignKey("game_history.id"), nullable=False)
    
    word = Column(String, nullable=False)
    score = Column(Integer, default=0)
    word_length = Column(Integer, default=0)
    is_valid = Column(Boolean, default=True)
    
    played_at = Column(DateTime, server_default=func.now())
