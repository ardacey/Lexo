import random
from typing import List
from .constants import LETTER_FREQUENCY, LETTER_SCORES

def generate_letter_pool(count: int) -> List[str]:
    letters = list(LETTER_FREQUENCY.keys())
    weights = list(LETTER_FREQUENCY.values())
    return random.choices(letters, weights=weights, k=count)

def calculate_score(word: str) -> int:
    return sum(LETTER_SCORES.get(char, 0) for char in word.lower())

def has_letters_in_pool(word: str, pool: List[str]) -> bool:
    temp_pool = pool.copy()
    for letter in word:
        if letter in temp_pool:
            temp_pool.remove(letter)
        else:
            return False
    return True