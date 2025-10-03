from typing import List
import random
from config import LETTER_FREQUENCY, LETTER_SCORES, VOWELS, CONSONANTS, GAME_SETTINGS


def generate_balanced_letter_pool(size: int = 16) -> List[str]:
    pool = []
    min_vowels = int(size * GAME_SETTINGS['min_vowel_ratio'])
    min_consonants = int(size * GAME_SETTINGS['min_consonant_ratio'])
    
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


def calculate_word_score(word: str) -> int:
    word_lower = word.lower()
    word_length = len(word_lower)
    
    # Calculate base score from letter values
    base_score = sum(LETTER_SCORES.get(char, 0) for char in word_lower)
    
    # Calculate length bonuses
    length_bonus = 0
    threshold_1 = GAME_SETTINGS['length_bonus_threshold_1']
    threshold_2 = GAME_SETTINGS['length_bonus_threshold_2']
    multiplier_1 = GAME_SETTINGS['length_bonus_multiplier_1']
    multiplier_2 = GAME_SETTINGS['length_bonus_multiplier_2']
    
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
    return len(word) >= GAME_SETTINGS['min_word_length']
