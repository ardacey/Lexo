"""
Unit tests for WordService
"""
import pytest
from app.services.word_service import WordService


class TestWordService:
    """Tests for WordService class"""
    
    @pytest.mark.unit
    def test_service_initialization(self, word_service):
        """Test that WordService initializes correctly"""
        assert word_service is not None
        assert word_service.get_word_count() > 0
    
    @pytest.mark.unit
    def test_load_words(self, word_service):
        """Test that words are loaded from file"""
        count = word_service.get_word_count()
        assert count > 1000  # Should have at least 1000 Turkish words
    
    @pytest.mark.unit
    @pytest.mark.parametrize("word", [
        "ev", "at", "masa", "kale", "test", "kelime"
    ])
    def test_valid_common_words(self, word_service, word):
        """Test validation of common Turkish words"""
        assert word_service.is_valid_word(word) is True
    
    @pytest.mark.unit
    @pytest.mark.parametrize("word", [
        "zzz", "qwerty", "asdfgh", "notaturkishword", "xyzabc"
    ])
    def test_invalid_words(self, word_service, word):
        """Test that invalid words are rejected"""
        assert word_service.is_valid_word(word) is False
    
    @pytest.mark.unit
    def test_case_insensitive_validation(self, word_service):
        """Test that validation is case insensitive"""
        assert word_service.is_valid_word("ev") == word_service.is_valid_word("EV")
        assert word_service.is_valid_word("ev") == word_service.is_valid_word("Ev")
    
    @pytest.mark.unit
    def test_empty_word(self, word_service):
        """Test validation of empty word"""
        assert word_service.is_valid_word("") is False
        assert word_service.is_valid_word("   ") is False
    
    @pytest.mark.unit
    def test_word_with_spaces(self, word_service):
        """Test that words with spaces are handled"""
        assert word_service.is_valid_word("ke lim e") is False
    
    @pytest.mark.unit
    def test_turkish_characters(self, word_service):
        """Test validation with Turkish characters"""
        # Test with Turkish specific characters
        turkish_words = ["şeker", "çay", "ığ", "öğle", "ü"]
        for word in turkish_words:
            # Just verify it doesn't crash
            result = word_service.is_valid_word(word)
            assert isinstance(result, bool)
    
    @pytest.mark.unit
    def test_single_letter_words(self, word_service):
        """Test single letter words"""
        # Most single letters shouldn't be valid words
        result = word_service.is_valid_word("a")
        assert isinstance(result, bool)


class TestZeyrekMorphologicalValidation:
    """Tests that verify vowel-harmony-correct morphological validation."""

    @pytest.mark.unit
    @pytest.mark.parametrize("word", [
        "masalardan",   # masa + lar + dan   (back vowel, correct)
        "evlerden",     # ev   + ler + den   (front vowel, correct)
        "geldim",       # gel  + di  + m     (verb past 1sg, correct)
        "arabam",       # araba + m          (possessive, correct)
        "kitaptan",     # kitap + tan        (ablative, correct)
        "çocuklar",     # çocuk + lar        (plural, correct)
    ])
    def test_valid_inflected_forms(self, word_service, word):
        """Correctly inflected Turkish words must be accepted."""
        assert word_service.is_valid_word(word) is True

    @pytest.mark.unit
    @pytest.mark.parametrize("word", [
        "masalerden",   # wrong harmony: masa (back) + ler (front suffix)
        "evlardan",     # wrong harmony: ev (front) + lar (back suffix)
        "geldüm",       # non-existent suffix combination
        "nonexistkök",  # non-existent root
    ])
    def test_invalid_vowel_harmony_rejected(self, word_service, word):
        """Words with incorrect vowel harmony or non-existent roots must be rejected."""
        assert word_service.is_valid_word(word) is False

    @pytest.mark.unit
    def test_result_is_cached(self, word_service):
        """Second call for the same inflected word hits the cache (no re-analysis)."""
        # Call once to populate cache
        word_service.is_valid_word("masalardan")
        # Cache must now contain the entry
        assert "masalardan" in word_service._morph_cache

    @pytest.mark.unit
    def test_empty_and_whitespace_rejected(self, word_service):
        """Empty string and whitespace-only input must return False without crashing."""
        assert word_service.is_valid_word("") is False
        assert word_service.is_valid_word("   ") is False
