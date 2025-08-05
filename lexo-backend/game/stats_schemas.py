from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserStatsResponse(BaseModel):
    id: str
    user_id: str
    total_games: int
    wins: int
    losses: int
    draws: int
    total_score: int
    highest_score: int
    average_score: int
    total_words: int
    longest_word_length: int
    longest_word: str
    total_playtime_seconds: int
    classic_games: int
    battle_royale_games: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class LeaderboardResponse(BaseModel):
    rank: int
    username: str
    total_score: int
    wins: int
    total_games: int
    win_rate: float
    average_score: int
    longest_word: str
    longest_word_length: int

class GameHistoryResponse(BaseModel):
    id: str
    room_id: str
    game_mode: str
    result: str
    score: int
    words_played: int
    started_at: datetime
    ended_at: datetime
    duration_seconds: int
    final_position: Optional[int]
    total_players: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class WordHistoryResponse(BaseModel):
    id: str
    word: str
    score: int
    word_length: int
    is_valid: bool
    played_at: datetime
    
    class Config:
        from_attributes = True
