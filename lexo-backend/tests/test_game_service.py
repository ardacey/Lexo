"""
Unit tests for GameService
"""
import pytest
from unittest.mock import Mock, MagicMock
from app.services.game_service import GameService
from app.services.word_service import WordService
from app.models.domain import Player, GameRoom


@pytest.fixture
def mock_word_service():
    """Create mock WordService"""
    service = Mock(spec=WordService)
    service.is_valid_word = Mock(return_value=True)
    return service


@pytest.fixture
def game_service(mock_word_service):
    """Create GameService with mock dependencies"""
    return GameService(mock_word_service)


@pytest.fixture
def player1():
    """Create test player 1"""
    return Player("user1", "Player1", "user_id_1")


@pytest.fixture
def player2():
    """Create test player 2"""
    return Player("user2", "Player2", "user_id_2")


@pytest.fixture
def game_room(player1, player2):
    """Create test game room"""
    room = GameRoom("room_123", player1, player2, duration=60)
    room.set_letter_pool(['a', 'e', 'i', 'k', 'l', 'm', 'n', 'r', 's', 't', 'u', 'ı', 'ş', 'ç', 'ğ', 'ü'])
    return room


class TestGameService:
    """Tests for GameService class"""
    
    @pytest.mark.unit
    def test_service_initialization(self, game_service):
        """Test that GameService initializes correctly"""
        assert game_service is not None
        assert game_service.word_service is not None
    
    @pytest.mark.unit
    def test_create_game_room(self, game_service, player1, player2):
        """Test creating a new game room"""
        room = game_service.create_game_room("room_123", player1, player2)
        
        assert room is not None
        assert room.id == "room_123"  # GameRoom uses 'id' not 'room_id'
        assert room.player1 == player1
        assert room.player2 == player2
        assert len(room.letter_pool) > 0
        assert room.duration > 0
    
    @pytest.mark.unit
    def test_validate_word_submission_valid(self, game_service, game_room):
        """Test validation of valid word submission"""
        result = game_service.validate_word_submission(game_room, "at")
        
        assert result['valid'] is True
        assert 'message' in result
    
    @pytest.mark.unit
    def test_validate_word_submission_too_short(self, game_service, game_room):
        """Test validation of too short word"""
        result = game_service.validate_word_submission(game_room, "a")
        
        assert result['valid'] is False
        assert 'en az' in result['message'].lower()
    
    @pytest.mark.unit
    def test_validate_word_submission_already_used(self, game_service, game_room):
        """Test validation of already used word"""
        game_room.add_used_word("test")
        result = game_service.validate_word_submission(game_room, "test")
        
        assert result['valid'] is False
        assert 'zaten kullanıldı' in result['message'].lower()
    
    @pytest.mark.unit
    def test_validate_word_submission_not_in_pool(self, game_service, game_room):
        """Test validation when letters not in pool"""
        result = game_service.validate_word_submission(game_room, "xyz")
        
        assert result['valid'] is False
        assert 'havuz' in result['message'].lower()
    
    @pytest.mark.unit
    def test_validate_word_submission_invalid_word(self, game_service, game_room):
        """Test validation of invalid Turkish word"""
        game_service.word_service.is_valid_word = Mock(return_value=False)
        result = game_service.validate_word_submission(game_room, "aet")  # Has letters but not valid
        
        assert result['valid'] is False
        assert 'geçerli' in result['message'].lower()
    
    @pytest.mark.unit
    def test_process_word_submission(self, game_service, game_room, player1):
        """Test processing a valid word submission"""
        initial_score = player1.score
        
        result = game_service.process_word_submission(game_room, player1, "test")
        
        assert 'word' in result
        assert 'score' in result
        assert 'total_score' in result
        assert result['word'] == "test"
        assert result['score'] > 0
        assert player1.score > initial_score
        assert "test" in game_room.used_words
    
    @pytest.mark.unit
    def test_process_word_adds_to_used_words(self, game_service, game_room, player1):
        """Test that processed word is added to used words"""
        game_service.process_word_submission(game_room, player1, "test")
        
        assert "test" in game_room.used_words
        assert len(game_room.used_words) == 1
    
    @pytest.mark.unit
    def test_process_word_updates_player_score(self, game_service, game_room, player1):
        """Test that player score is updated"""
        initial_score = player1.score
        result = game_service.process_word_submission(game_room, player1, "test")
        
        assert player1.score > initial_score
        assert result['total_score'] == player1.score
    
    @pytest.mark.unit
    def test_case_insensitive_word_processing(self, game_service, game_room, player1):
        """Test that word processing is case insensitive"""
        result1 = game_service.process_word_submission(game_room, player1, "TEST")
        assert result1['word'] == "test"
        
        # Second submission should be rejected as duplicate
        validation = game_service.validate_word_submission(game_room, "Test")
        assert validation['valid'] is False
