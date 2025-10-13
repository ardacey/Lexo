"""
Unit tests for game logic utilities
"""
import pytest
from app.utils.game_logic import (
    generate_balanced_letter_pool,
    calculate_word_score,
    generate_replacement_letters,
    validate_word_length,
    has_letters_in_pool
)
from app.core.constants import VOWELS, CONSONANTS


class TestGenerateBalancedLetterPool:
    """Tests for generate_balanced_letter_pool function"""
    
    @pytest.mark.unit
    def test_pool_size(self):
        """Test that pool has correct size"""
        pool = generate_balanced_letter_pool(16)
        assert len(pool) == 16
        
        pool_20 = generate_balanced_letter_pool(20)
        assert len(pool_20) == 20
    
    @pytest.mark.unit
    def test_pool_has_vowels(self):
        """Test that pool contains minimum vowels"""
        pool = generate_balanced_letter_pool(16)
        vowel_count = sum(1 for letter in pool if letter in VOWELS)
        # Min 30% vowels for 16 letters = at least 4
        assert vowel_count >= 4
    
    @pytest.mark.unit
    def test_pool_has_consonants(self):
        """Test that pool contains minimum consonants"""
        pool = generate_balanced_letter_pool(16)
        consonant_count = sum(1 for letter in pool if letter in CONSONANTS)
        # Min 50% consonants for 16 letters = at least 8
        assert consonant_count >= 8
    
    @pytest.mark.unit
    def test_all_letters_are_lowercase(self):
        """Test that all letters in pool are lowercase"""
        pool = generate_balanced_letter_pool(16)
        assert all(letter.islower() for letter in pool)
    
    @pytest.mark.unit
    def test_randomness(self):
        """Test that pools are different (randomized)"""
        pool1 = generate_balanced_letter_pool(16)
        pool2 = generate_balanced_letter_pool(16)
        # Pools should be different most of the time
        assert pool1 != pool2


class TestCalculateWordScore:
    """Tests for calculate_word_score function"""
    
    @pytest.mark.unit
    @pytest.mark.parametrize("word,min_score", [
        ("at", 2),
        ("ev", 2),
        ("masa", 4),
        ("kelime", 6),
    ])
    def test_minimum_score_equals_length(self, word, min_score):
        """Test that score is at least equal to word length"""
        score = calculate_word_score(word)
        assert score >= min_score
    
    @pytest.mark.unit
    def test_longer_words_get_bonus(self):
        """Test that longer words receive length bonus"""
        short_word_score = calculate_word_score("at")
        medium_word_score = calculate_word_score("kelime")
        long_word_score = calculate_word_score("merhaba")
        
        assert medium_word_score > short_word_score
        assert long_word_score > medium_word_score
    
    @pytest.mark.unit
    def test_case_insensitive(self):
        """Test that scoring is case insensitive"""
        score_lower = calculate_word_score("kelime")
        score_upper = calculate_word_score("KELIME")
        score_mixed = calculate_word_score("KeLiMe")
        
        assert score_lower == score_upper == score_mixed
    
    @pytest.mark.unit
    def test_score_is_positive(self):
        """Test that score is always positive"""
        words = ["a", "at", "ev", "kelime", "test", "deneme"]
        for word in words:
            score = calculate_word_score(word)
            assert score > 0


class TestGenerateReplacementLetters:
    """Tests for generate_replacement_letters function"""
    
    @pytest.mark.unit
    def test_correct_count(self):
        """Test that correct number of letters are generated"""
        letters = generate_replacement_letters(5)
        assert len(letters) == 5
        
        letters_10 = generate_replacement_letters(10)
        assert len(letters_10) == 10
    
    @pytest.mark.unit
    def test_all_lowercase(self):
        """Test that all generated letters are lowercase"""
        letters = generate_replacement_letters(20)
        assert all(letter.islower() for letter in letters)
    
    @pytest.mark.unit
    def test_randomness(self):
        """Test that generation is random"""
        letters1 = generate_replacement_letters(10)
        letters2 = generate_replacement_letters(10)
        # Should be different most of the time
        assert letters1 != letters2 or len(set(letters1)) > 1


class TestValidateWordLength:
    """Tests for validate_word_length function"""
    
    @pytest.mark.unit
    def test_valid_lengths(self):
        """Test that valid lengths return True"""
        assert validate_word_length("at") is True
        assert validate_word_length("ev") is True
        assert validate_word_length("masa") is True
        assert validate_word_length("kelime") is True
    
    @pytest.mark.unit
    def test_invalid_lengths(self):
        """Test that invalid lengths return False"""
        assert validate_word_length("") is False
        assert validate_word_length("a") is False
    
    @pytest.mark.unit
    def test_boundary_cases(self):
        """Test boundary cases"""
        # Minimum valid length is 2
        assert validate_word_length("ab") is True
        assert validate_word_length("a") is False


class TestHasLettersInPool:
    """Tests for has_letters_in_pool function"""
    
    @pytest.mark.unit
    def test_word_in_pool(self):
        """Test that word with all letters in pool returns True"""
        pool = ['a', 't', 'e', 'v', 'm', 's']
        assert has_letters_in_pool("at", pool) is True
        assert has_letters_in_pool("ev", pool) is True
        assert has_letters_in_pool("mas", pool) is True
    
    @pytest.mark.unit
    def test_word_not_in_pool(self):
        """Test that word with missing letters returns False"""
        pool = ['a', 't', 'e', 'v']
        assert has_letters_in_pool("kelime", pool) is False
        assert has_letters_in_pool("masa", pool) is False
    
    @pytest.mark.unit
    def test_duplicate_letters(self):
        """Test handling of duplicate letters"""
        pool = ['a', 't', 'e', 'v', 'm']
        # Word "atam" needs two 'a's but pool only has one
        assert has_letters_in_pool("atam", pool) is False
        
        pool_with_duplicates = ['a', 'a', 't', 'm']
        assert has_letters_in_pool("atam", pool_with_duplicates) is True
    
    @pytest.mark.unit
    def test_case_insensitive(self):
        """Test that check is case insensitive"""
        pool = ['a', 't', 'e', 'v']
        assert has_letters_in_pool("AT", pool) is True
        assert has_letters_in_pool("At", pool) is True
        assert has_letters_in_pool("at", pool) is True
    
    @pytest.mark.unit
    def test_empty_word(self):
        """Test empty word"""
        pool = ['a', 't', 'e', 'v']
        assert has_letters_in_pool("", pool) is True
    
    @pytest.mark.unit
    def test_pool_not_modified(self):
        """Test that original pool is not modified"""
        original_pool = ['a', 't', 'e', 'v', 'm']
        pool_copy = original_pool.copy()
        
        has_letters_in_pool("at", original_pool)
        
        assert original_pool == pool_copy
