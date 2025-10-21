from typing import Set
from pathlib import Path

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class WordService:
    
    def __init__(self):
        self.valid_words: Set[str] = set()
        self._load_words()
    
    def _load_words(self):
        words_file = settings.files.words_file
        try:
            with open(words_file, "r", encoding="utf-8") as f:
                self.valid_words = set(
                    line.strip().lower() 
                    for line in f 
                    if line.strip()
                )
            logger.info(f"Loaded {len(self.valid_words)} Turkish words")
        except FileNotFoundError:
            logger.warning(f"{words_file} not found")
            self.valid_words = set()
    
    def is_valid_word(self, word: str) -> bool:
        """
        Check if word is valid. Uses cache for frequently checked words.
        """
        word_lower = word.lower()
        
        # Check in word set
        return word_lower in self.valid_words
    
    def get_word_count(self) -> int:
        return len(self.valid_words)
