from typing import List, Dict, Set, Optional
import logging
from pathlib import Path
from config import FILE_PATHS, GAME_SETTINGS
from models import Player, GameRoom
from utils import generate_balanced_letter_pool, calculate_word_score, generate_replacement_letters

logger = logging.getLogger(__name__)


class WordService:
    def __init__(self):
        self.valid_words: Set[str] = set()
        self._load_words()
    
    def _load_words(self):
        words_file = FILE_PATHS['words_file']
        try:
            with open(words_file, "r", encoding="utf-8") as f:
                self.valid_words = set(line.strip().lower() for line in f if line.strip())
            logger.info(f"Loaded {len(self.valid_words)} Turkish words")
        except FileNotFoundError:
            logger.warning(f"{words_file} not found")
            self.valid_words = set()
    
    def is_valid_word(self, word: str) -> bool:
        return word.lower() in self.valid_words
    
    def get_word_count(self) -> int:
        return len(self.valid_words)


class GameService:
    def __init__(self, word_service: WordService):
        self.word_service = word_service
    
    def create_game_room(self, room_id: str, player1: Player, player2: Player) -> GameRoom:
        duration = GAME_SETTINGS['default_duration']
        room = GameRoom(room_id, player1, player2, duration)
        
        pool_size = GAME_SETTINGS['letter_pool_size']
        letter_pool = generate_balanced_letter_pool(pool_size)
        room.set_letter_pool(letter_pool)
        
        logger.info(f"Created game room {room_id} with {len(letter_pool)} letters")
        return room
    
    def validate_word_submission(self, room: GameRoom, word: str) -> Dict[str, any]:
        word = word.strip()
        word_lower = word.lower()

        min_length = GAME_SETTINGS['min_word_length']
        if len(word) < min_length:
            return {
                'valid': False,
                'message': f'Kelime en az {min_length} harf olmalıdır'
            }
        
        # Check if already used
        if word_lower in room.used_words:
            return {
                'valid': False,
                'message': 'Bu kelime zaten kullanıldı'
            }
        
        # Check if letters are available
        if not room.has_letters(word):
            return {
                'valid': False,
                'message': 'Havuzda yeterli harf yok'
            }
        
        # Check if word is valid Turkish word
        if not self.word_service.is_valid_word(word):
            return {
                'valid': False,
                'message': 'Geçerli bir Türkçe kelime değil'
            }
        
        return {
            'valid': True,
            'message': 'Kelime geçerli'
        }
    
    def process_word_submission(self, room: GameRoom, player: Player, word: str) -> Dict[str, any]:
        word_lower = word.lower()
        score = calculate_word_score(word)
        
        room.add_used_word(word_lower)
        room.remove_letters(word)
        
        replacement_letters = generate_replacement_letters(len(word_lower))
        room.add_letters(replacement_letters)
        
        player.add_score(score)
        player.add_word(word_lower)
        
        logger.info(f"{player.username} played word: {word_lower} (+{score} points)")
        
        return {
            'word': word_lower,
            'score': score,
            'total_score': player.score,
            'letter_pool': room.letter_pool,
            'scores': room.get_scores()
        }


class MatchmakingService:
    def __init__(self, game_service: GameService):
        self.game_service = game_service
        self.waiting_queue: List[Player] = []
        self.active_rooms: Dict[str, GameRoom] = {}
        self.player_rooms: Dict[str, str] = {}  # player_id -> room_id
    
    def add_to_queue(self, player: Player) -> int:
        self.waiting_queue.append(player)
        logger.info(f"Player {player.username} ({player.id}) joined queue")
        return len(self.waiting_queue)
    
    def remove_from_queue(self, player: Player):
        if player in self.waiting_queue:
            self.waiting_queue.remove(player)
            logger.info(f"Removed {player.username} from queue")
    
    def try_match_players(self) -> Optional[GameRoom]:
        if len(self.waiting_queue) < 2:
            return None
        
        player1 = self.waiting_queue.pop(0)
        player2 = self.waiting_queue.pop(0)
        
        import uuid
        room_id = str(uuid.uuid4())
        room = self.game_service.create_game_room(room_id, player1, player2)
        
        self.active_rooms[room_id] = room
        self.player_rooms[player1.id] = room_id
        self.player_rooms[player2.id] = room_id
        
        logger.info(f"Matched {player1.username} vs {player2.username} in room {room_id}")
        return room
    
    def get_room_by_player(self, player_id: str) -> Optional[GameRoom]:
        room_id = self.player_rooms.get(player_id)
        if room_id:
            return self.active_rooms.get(room_id)
        return None
    
    def cleanup_room(self, room_id: str):
        if room_id in self.active_rooms:
            room = self.active_rooms[room_id]
            
            if room.player1.id in self.player_rooms:
                del self.player_rooms[room.player1.id]
            if room.player2.id in self.player_rooms:
                del self.player_rooms[room.player2.id]
            
            del self.active_rooms[room_id]
            logger.info(f"Cleaned up room {room_id}")
    
    def get_stats(self) -> Dict:
        return {
            'active_rooms': len(self.active_rooms),
            'waiting_players': len(self.waiting_queue)
        }
