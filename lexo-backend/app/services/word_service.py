import logging
from typing import Dict, Set

# Silence zeyrek's DEBUG/WARNING log spam before importing
logging.getLogger("zeyrek").setLevel(logging.ERROR)
import zeyrek  # noqa: E402
from zeyrek.attributes import SecondaryPos  # noqa: E402

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def _has_non_proper_analysis(analyses) -> bool:
    """
    Return True only when at least one analysis is NOT a proper noun.
    This filters out foreign brand names (e.g. "qwerty") that zeyrek
    recognises as ProperNoun entries in its lexicon.
    """
    return any(sa.dict_item.secondary_pos != SecondaryPos.ProperNoun for sa in analyses)


class WordService:

    def __init__(self):
        self.valid_words: Set[str] = set()
        self._morph_cache: Dict[str, bool] = {}
        self._load_words()
        logger.info("Initializing zeyrek MorphAnalyzer…")
        self._morph_analyzer = zeyrek.MorphAnalyzer()
        logger.info("zeyrek MorphAnalyzer ready")

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
        Return True when the word is a grammatically valid Turkish word.

        Validation steps (fastest-first):
        1. Exact match in the static word list (fast path, O(1)).
        2. In-memory cache check — avoids re-running zeyrek for repeated words.
        3. zeyrek morphological analysis — accepts a word only when it has at
           least one valid morphological parse according to Turkish grammar rules,
           including correct vowel harmony and real suffix combinations.
        """
        if not word or not word.strip():
            return False

        word_lower = word.lower()

        # 1. Exact match
        if word_lower in self.valid_words:
            return True

        # 2. Cache hit
        if word_lower in self._morph_cache:
            return self._morph_cache[word_lower]

        # 3. Morphological analysis via zeyrek
        #    Reject proper-noun-only analyses (foreign brand names like "qwerty")
        analyses = self._morph_analyzer._parse(word_lower)
        result = _has_non_proper_analysis(analyses)
        self._morph_cache[word_lower] = result
        return result

    def get_word_count(self) -> int:
        return len(self.valid_words)
