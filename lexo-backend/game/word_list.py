from typing import Set

VALID_WORDS: Set[str] = set()

def load_wordlist(filepath: str = "words/turkish_words.txt"):
    global VALID_WORDS
    try:
        with open(filepath, encoding="utf-8") as f:
            for line in f:
                word = line.strip().lower()
                if word:
                    VALID_WORDS.add(word)
        print(f"Successfully loaded {len(VALID_WORDS)} words.")
    except FileNotFoundError:
        print(f"Error: Word list file not found at '{filepath}'.")
        VALID_WORDS = set()

def is_word_valid(word: str) -> bool:
    return word.lower() in VALID_WORDS