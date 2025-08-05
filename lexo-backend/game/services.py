from typing import Dict, Any, Tuple
from .models_db import RoomDB, PlayerDB
from .logic import calculate_score, has_letters_in_pool, generate_letter_pool
from .word_list import is_word_valid
from .constants import MIN_WORD_LENGTH

ServiceResponse = Tuple[bool, Dict[str, Any]]

def process_word_submission(room: RoomDB, player: PlayerDB, word: str) -> ServiceResponse:
    if getattr(player, 'is_eliminated', False):
        return False, {
            "type": "error",
            "message": "You have been eliminated and cannot submit words."
        }
    
    lower_word = word.lower()

    if len(lower_word) < MIN_WORD_LENGTH:
        return False, {
            "type": "error",
            "message": f"Word must be at least {MIN_WORD_LENGTH} characters long."
        }

    if room.is_word_used_in_room(lower_word):
        return False, {
            "type": "error",
            "message": f'"{lower_word}" has already been played in this room.'
        }

    if not has_letters_in_pool(lower_word, room.letter_pool): # type: ignore
        return False, {
            "type": "error",
            "message": f'Not enough letters in the pool for "{lower_word}".'
        }

    if not is_word_valid(lower_word):
        return False, {
            "type": "word_result",
            "word": lower_word,
            "valid": False,
            "message": f'"{lower_word}" is not a valid Turkish word.'
        }

    score = calculate_score(lower_word)

    temp_pool = room.letter_pool.copy()
    for letter in lower_word:
        temp_pool.remove(letter)
    
    new_letters = generate_letter_pool(len(lower_word))
    room.letter_pool = temp_pool + new_letters # type: ignore

    player.score += score # type: ignore
    player.words.append(lower_word)
    room.add_used_word(lower_word)

    success_data = {
        "word": lower_word,
        "score": score,
        "player_total_score": player.score,
        "new_letter_pool": room.letter_pool,
        "current_scores": room.get_scores()
    }
    
    return True, success_data