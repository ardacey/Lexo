import random
from typing import List
from functools import lru_cache
from .constants import LETTER_FREQUENCY, LETTER_SCORES

_LETTERS = list(LETTER_FREQUENCY.keys())
_WEIGHTS = list(LETTER_FREQUENCY.values())

def generate_letter_pool(count: int) -> List[str]:
    return random.choices(_LETTERS, weights=_WEIGHTS, k=count)

@lru_cache(maxsize=100)
def calculate_score(word: str) -> int:
    return sum(LETTER_SCORES.get(char, 0) for char in word.lower())

def has_letters_in_pool(word: str, pool: List[str]) -> bool:
    temp_pool = pool.copy()
    for letter in word.lower():
        if letter in temp_pool:
            temp_pool.remove(letter)
        else:
            return False
    return True