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
