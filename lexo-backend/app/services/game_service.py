from typing import Dict
import uuid

from app.models.domain import Player, GameRoom
from app.services.word_service import WordService
from app.utils.game_logic import (
    generate_balanced_letter_pool,
    calculate_word_score,
    validate_word_length,
    has_letters_in_pool
)
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class GameService:

    def __init__(self, word_service: WordService):
        self.word_service = word_service
    
    def create_game_room(
        self, 
        room_id: str, 
        player1: Player, 
        player2: Player
    ) -> GameRoom:
        duration = settings.game.default_duration
        room = GameRoom(room_id, player1, player2, duration)
        
        pool_size = settings.game.letter_pool_size
        letter_pool = generate_balanced_letter_pool(pool_size)
        room.set_letter_pool(letter_pool)
        
        logger.info(f"Created game room {room_id} with {len(letter_pool)} letters")
        return room
    
    def validate_word_submission(self, room: GameRoom, word: str) -> Dict[str, any]:
        word = word.strip()
        word_lower = word.lower()
        
        if not validate_word_length(word):
            return {
                'valid': False,
                'message': f'Kelime en az {settings.game.min_word_length} harf olmalıdır'
            }
        
        if word_lower in room.used_words:
            return {
                'valid': False,
                'message': 'Bu kelime zaten kullanıldı'
            }
        
        if not room.has_letters(word):
            return {
                'valid': False,
                'message': 'Havuzda yeterli harf yok'
            }
        
        if not self.word_service.is_valid_word(word):
            return {
                'valid': False,
                'message': 'Geçerli bir Türkçe kelime değil'
            }
        
        return {
            'valid': True,
            'message': 'Kelime geçerli'
        }
    
    def process_word_submission(
        self, 
        room: GameRoom, 
        player: Player, 
        word: str
    ) -> Dict[str, any]:
        word_lower = word.lower()
        score = calculate_word_score(word)
        
        room.add_used_word(word_lower)
        
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
