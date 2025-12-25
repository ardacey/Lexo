from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


class ValidateWordRequest(BaseModel):
    word: str = Field(..., min_length=1, max_length=50)
    
    @field_validator('word')
    @classmethod
    def validate_word(cls, v: str) -> str:
        if not v.replace(' ', '').isalpha():
            raise ValueError('Word contains invalid characters')
        return v.strip()


class ValidateWordResponse(BaseModel):
    valid: bool
    message: str


class CreateUserRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1, max_length=30)
    email: Optional[str] = Field(None, max_length=100)


class UpdateUsernameRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=30)


class UserResponse(BaseModel):
    id: int
    user_id: str
    username: str
    email: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserStatsResponse(BaseModel):
    total_games: int
    wins: int
    losses: int
    ties: int
    win_rate: float
    highest_score: int
    average_score: float
    total_words: int
    longest_word: str
    longest_word_length: int
    total_play_time: int
    current_win_streak: int
    best_win_streak: int
    rank: Optional[int] = None


class GameHistoryResponse(BaseModel):
    room_id: str
    opponent: str
    user_score: int
    opponent_score: int
    user_words: List[str]
    won: bool
    tied: bool
    duration: int
    played_at: str


class LeaderboardEntry(BaseModel):
    username: str
    total_games: int
    wins: int
    losses: int
    ties: int
    win_rate: float
    highest_score: int
    average_score: float
    total_words: int
    longest_word: str
    best_win_streak: int


class SaveGameRequest(BaseModel):
    room_id: str
    player1_user_id: str
    player2_user_id: str
    player1_score: int = Field(..., ge=0)
    player2_score: int = Field(..., ge=0)
    player1_words: List[str]
    player2_words: List[str]
    winner_user_id: Optional[str] = None
    duration: int = Field(..., gt=0)
    letter_pool: List[str]
    started_at: str
    ended_at: str


class SaveGameResponse(BaseModel):
    success: bool
    message: str
    game_id: Optional[int] = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None


class SuccessResponse(BaseModel):
    success: bool = True
    message: str


class FriendUser(BaseModel):
    user_id: str
    username: str


class FriendRequestCreate(BaseModel):
    target_user_id: str = Field(..., min_length=1)


class FriendRequestRespond(BaseModel):
    action: str = Field(..., min_length=1)


class FriendRequestResponse(BaseModel):
    id: int
    requester: FriendUser
    status: str
    created_at: datetime


class FriendInviteSend(BaseModel):
    target_user_id: str = Field(..., min_length=1)


class FriendInviteRespond(BaseModel):
    invite_id: str = Field(..., min_length=1)
    action: str = Field(..., min_length=1)


class FriendInviteCancel(BaseModel):
    invite_id: str = Field(..., min_length=1)
