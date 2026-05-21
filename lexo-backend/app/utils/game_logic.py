from typing import List
import random

from app.core.constants import (
    LETTER_FREQUENCY,
    LETTER_SCORES,
    VOWELS,
    CONSONANTS
)
from app.core.config import settings

_VOWEL_SET = set(VOWELS)

_MAX_POOL_RETRIES = 5


def _is_pool_playable(pool: List[str]) -> bool:
    """
    Return True when the pool is likely to contain playable words.

    Criteria:
    - At least 4 vowels in total (enough to build multiple words)
    - At least 3 *distinct* vowel characters (avoids e.g. aaaa which blocks
      front/back vowel harmony variety)
    """
    vowels_in_pool = [c for c in pool if c in _VOWEL_SET]
    return len(vowels_in_pool) >= 4 and len(set(vowels_in_pool)) >= 3


def _generate_once(size: int) -> List[str]:
    pool: List[str] = []
    min_vowels = int(size * settings.game.min_vowel_ratio)
    min_consonants = int(size * settings.game.min_consonant_ratio)

    for _ in range(min_vowels):
        pool.append(random.choice(VOWELS))

    for _ in range(min_consonants):
        pool.append(random.choice(CONSONANTS))

    remaining = size - len(pool)
    letters = list(LETTER_FREQUENCY.keys())
    weights = list(LETTER_FREQUENCY.values())
    pool.extend(random.choices(letters, weights=weights, k=remaining))

    random.shuffle(pool)
    return pool


def generate_balanced_letter_pool(size: int = 16) -> List[str]:
    """Generate a letter pool that is guaranteed to be playable.

    Retries up to _MAX_POOL_RETRIES times until _is_pool_playable passes,
    then returns the best attempt (best-effort) on exhaustion.
    """
    for _ in range(_MAX_POOL_RETRIES):
        pool = _generate_once(size)
        if _is_pool_playable(pool):
            return pool
    return pool  # best effort — extremely rare after 5 attempts


def calculate_word_score(word: str) -> int:
    word_lower = word.lower()
    word_length = len(word_lower)
    
    base_score = sum(LETTER_SCORES.get(char, 0) for char in word_lower)
    
    length_bonus = 0
    threshold_1 = settings.game.length_bonus_threshold_1
    threshold_2 = settings.game.length_bonus_threshold_2
    multiplier_1 = settings.game.length_bonus_multiplier_1
    multiplier_2 = settings.game.length_bonus_multiplier_2
    
    if word_length >= threshold_1:
        length_bonus = (word_length - threshold_1 + 1) * multiplier_1
    if word_length >= threshold_2:
        length_bonus += (word_length - threshold_2 + 1) * multiplier_2
    
    total_score = int(base_score + length_bonus)
    return max(total_score, word_length)


def generate_replacement_letters(count: int) -> List[str]:
    letters = list(LETTER_FREQUENCY.keys())
    weights = list(LETTER_FREQUENCY.values())
    return random.choices(letters, weights=weights, k=count)


def validate_word_length(word: str) -> bool:
    return len(word) >= settings.game.min_word_length


def has_letters_in_pool(word: str, pool: List[str]) -> bool:
    temp_pool = pool.copy()
    for letter in word.lower():
        if letter in temp_pool:
            temp_pool.remove(letter)
        else:
            return False
    return True
