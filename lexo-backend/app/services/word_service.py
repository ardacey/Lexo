from typing import Set
from pathlib import Path

from app.core.config import settings
from app.core.logging import get_logger
from app.core.cache import cache

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
        
        # Try cache first
        cache_key = f"word:valid:{word_lower}"
        cached_result = cache.get(cache_key)
        if cached_result is not None:
            return cached_result
        
        # Check in word set
        is_valid = word_lower in self.valid_words
        
        # Cache result (24 hour TTL since word dictionary doesn't change)
        cache.set(cache_key, is_valid, ttl=86400)
        
        return is_valid
    
    def get_word_count(self) -> int:
        return len(self.valid_words)
