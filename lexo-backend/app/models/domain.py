from typing import List, Dict, Set, Optional
from datetime import datetime

from app.core.config import settings


class Player:
    def __init__(self, player_id: str, username: str):
        self.id = player_id
        self.username = username
        self.score = 0
        self.words: List[str] = []
        self.connected = True
        self.last_disconnect_time: Optional[datetime] = None

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
            "words": self.words,
            "connected": self.connected,
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
        self.game_saved = False
        self.reconnect_grace_period = settings.websocket.grace_period_seconds

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
            {"username": self.player2.username, "score": self.player2.score},
        ]

    def get_time_remaining(self) -> Optional[int]:
        if not self.start_time or self.game_ended:
            return None
        elapsed = (datetime.now() - self.start_time).total_seconds()
        remaining = self.duration - int(elapsed)
        return max(0, remaining)

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
            "winner": self.get_winner() if self.game_ended else None,
        }

    def to_snapshot(self) -> Dict:
        """Serializable snapshot for cross-worker reconnect state in Redis."""
        return {
            "id": self.id,
            "player1_id": self.player1.id,
            "player1_username": self.player1.username,
            "player1_score": str(self.player1.score),
            "player1_words": ",".join(self.player1.words),
            "player1_connected": "1" if self.player1.connected else "0",
            "player2_id": self.player2.id,
            "player2_username": self.player2.username,
            "player2_score": str(self.player2.score),
            "player2_words": ",".join(self.player2.words),
            "player2_connected": "1" if self.player2.connected else "0",
            "letter_pool": ",".join(self.letter_pool),
            "used_words": ",".join(self.used_words),
            "duration": str(self.duration),
            "start_time": self.start_time.isoformat() if self.start_time else "",
            "game_started": "1" if self.game_started else "0",
            "game_ended": "1" if self.game_ended else "0",
        }
