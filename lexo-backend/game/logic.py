import random
from typing import List
from functools import lru_cache
from .constants import LETTER_FREQUENCY, LETTER_SCORES, VOWELS, CONSONANTS, MIN_VOWELS_IN_POOL, MIN_CONSONANTS_IN_POOL

_LETTERS = list(LETTER_FREQUENCY.keys())
_WEIGHTS = list(LETTER_FREQUENCY.values())

def generate_letter_pool(count: int) -> List[str]:
    return random.choices(_LETTERS, weights=_WEIGHTS, k=count)

def count_vowels_consonants(letters: List[str]) -> tuple[int, int]:
    vowel_count = sum(1 for letter in letters if letter in VOWELS)
    consonant_count = sum(1 for letter in letters if letter in CONSONANTS)
    return vowel_count, consonant_count

def generate_balanced_replacement_letters(used_letters: List[str], current_pool: List[str]) -> List[str]:
    current_vowels, current_consonants = count_vowels_consonants(current_pool)
    used_vowels, used_consonants = count_vowels_consonants(used_letters)

    predicted_vowels = current_vowels - used_vowels
    predicted_consonants = current_consonants - used_consonants
    
    new_letters = []
    remaining_count = len(used_letters)

    vowels_needed = max(0, MIN_VOWELS_IN_POOL - predicted_vowels)
    consonants_needed = max(0, MIN_CONSONANTS_IN_POOL - predicted_consonants)

    for _ in range(min(vowels_needed, remaining_count)):
        vowel_letters = [letter for letter in VOWELS]
        vowel_weights = [LETTER_FREQUENCY[letter] for letter in vowel_letters]
        new_letter = random.choices(vowel_letters, weights=vowel_weights, k=1)[0]
        new_letters.append(new_letter)
        remaining_count -= 1
    
    for _ in range(min(consonants_needed, remaining_count)):
        consonant_letters = [letter for letter in CONSONANTS]
        consonant_weights = [LETTER_FREQUENCY[letter] for letter in consonant_letters]
        new_letter = random.choices(consonant_letters, weights=consonant_weights, k=1)[0]
        new_letters.append(new_letter)
        remaining_count -= 1

    if remaining_count > 0:
        new_letters.extend(generate_letter_pool(remaining_count))
    
    return new_letters

def generate_initial_balanced_pool(size: int) -> List[str]:
    letters = []
    
    if size > 30:
        vowel_ratio = 0.35
        consonant_ratio = 0.65
        
        vowels_to_add = max(MIN_VOWELS_IN_POOL, int(size * vowel_ratio))
        consonants_to_add = max(MIN_CONSONANTS_IN_POOL, int(size * consonant_ratio))

        remaining = size - vowels_to_add - consonants_to_add
        if remaining > 0:
            vowels_to_add += remaining // 2
            consonants_to_add += remaining - (remaining // 2)
    else:
        vowel_letters = list(VOWELS)
        vowel_weights = [LETTER_FREQUENCY[letter] for letter in vowel_letters]
        vowels_to_add = min(MIN_VOWELS_IN_POOL, size // 3)
        
        consonant_letters = list(CONSONANTS)
        consonant_weights = [LETTER_FREQUENCY[letter] for letter in consonant_letters]
        consonants_to_add = min(MIN_CONSONANTS_IN_POOL, size - vowels_to_add)

    vowel_letters = list(VOWELS)
    vowel_weights = [LETTER_FREQUENCY[letter] for letter in vowel_letters]
    for _ in range(vowels_to_add):
        letter = random.choices(vowel_letters, weights=vowel_weights, k=1)[0]
        letters.append(letter)
    
    consonant_letters = list(CONSONANTS)
    consonant_weights = [LETTER_FREQUENCY[letter] for letter in consonant_letters]
    for _ in range(consonants_to_add):
        letter = random.choices(consonant_letters, weights=consonant_weights, k=1)[0]
        letters.append(letter)

    remaining = size - len(letters)
    if remaining > 0:
        letters.extend(generate_letter_pool(remaining))

    random.shuffle(letters)
    return letters

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