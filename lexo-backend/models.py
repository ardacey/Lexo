from typing import List, Dict, Set, Optional
from datetime import datetime
from fastapi import WebSocket
from pydantic import BaseModel


class Player:
    def __init__(self, player_id: str, username: str, websocket: WebSocket):
        self.id = player_id
        self.username = username
        self.websocket = websocket
        self.score = 0
        self.words: List[str] = []
    
    def add_score(self, points: int) -> int:
        self.score += points
        return self.score
    
    def add_word(self, word: str):
        self.words.append(word.lower())
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "username": self.username,
            "score": self.score,
            "words": self.words
        }


class GameRoom:
    def __init__(self, room_id: str, player1: Player, player2: Player, duration: int = 60):
        self.id = room_id
        self.player1 = player1
        self.player2 = player2
        self.letter_pool: List[str] = []
        self.used_words: Set[str] = set()
        self.duration = duration
        self.start_time: Optional[datetime] = None
        self.game_started = False
        self.game_ended = False
    
    def start_game(self):
        self.game_started = True
        self.start_time = datetime.now()
    
    def end_game(self):
        self.game_ended = True
    
    def set_letter_pool(self, letters: List[str]):
        self.letter_pool = letters
    
    def add_used_word(self, word: str) -> bool:
        word_lower = word.lower()
        if word_lower in self.used_words:
            return False
        self.used_words.add(word_lower)
        return True
    
    def has_letters(self, word: str) -> bool:
        temp_pool = self.letter_pool.copy()
        for letter in word.lower():
            if letter in temp_pool:
                temp_pool.remove(letter)
            else:
                return False
        return True
    
    def remove_letters(self, word: str):
        word_lower = word.lower()
        for letter in word_lower:
            if letter in self.letter_pool:
                self.letter_pool.remove(letter)
    
    def add_letters(self, letters: List[str]):
        self.letter_pool.extend(letters)
    
    def get_player(self, player_id: str) -> Optional[Player]:
        if self.player1.id == player_id:
            return self.player1
        elif self.player2.id == player_id:
            return self.player2
        return None
    
    def get_opponent(self, player: Player) -> Player:
        return self.player2 if player == self.player1 else self.player1
    
    def get_scores(self) -> List[Dict]:
        return [
            {"username": self.player1.username, "score": self.player1.score},
            {"username": self.player2.username, "score": self.player2.score}
        ]
    
    def get_winner(self) -> Optional[str]:
        if self.player1.score > self.player2.score:
            return self.player1.username
        elif self.player2.score > self.player1.score:
            return self.player2.username
        return None  # Tie
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "player1": self.player1.to_dict(),
            "player2": self.player2.to_dict(),
            "letter_pool": self.letter_pool,
            "used_words": list(self.used_words),
            "duration": self.duration,
            "game_started": self.game_started,
            "game_ended": self.game_ended,
            "winner": self.get_winner() if self.game_ended else None
        }


# Pydantic models for API requests/responses
class QueueJoinRequest(BaseModel):
    username: str


class SubmitWordRequest(BaseModel):
    word: str


class WordValidationResponse(BaseModel):
    is_valid: bool
    message: Optional[str] = None
    score: Optional[int] = None


class GameStateResponse(BaseModel):
    letter_pool: List[str]
    scores: List[Dict]
    used_words: List[str]
    time_remaining: int
