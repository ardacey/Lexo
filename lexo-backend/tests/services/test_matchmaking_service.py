"""
Tests for MatchmakingService
"""
import pytest
from unittest.mock import Mock

from app.services.matchmaking_service import MatchmakingService
from app.services.game_service import GameService
from app.models.domain import Player, GameRoom


@pytest.fixture
def game_service():
    """Mock GameService for testing"""
    return Mock(spec=GameService)


@pytest.fixture
def matchmaking_service(game_service):
    """Create MatchmakingService instance"""
    return MatchmakingService(game_service)


@pytest.fixture
def mock_websocket():
    """Create mock WebSocket"""
    return Mock()


@pytest.fixture
def player1(mock_websocket):
    """Create test player 1"""
    return Player(
        player_id="player1_id",
        username="player1",
        websocket=mock_websocket
    )


@pytest.fixture
def player2(mock_websocket):
    """Create test player 2"""
    return Player(
        player_id="player2_id",
        username="player2",
        websocket=mock_websocket
    )


@pytest.fixture
def player3(mock_websocket):
    """Create test player 3"""
    return Player(
        player_id="player3_id",
        username="player3",
        websocket=mock_websocket
    )


class TestMatchmakingService:
    """Test suite for MatchmakingService"""
    
    def test_initialization(self, matchmaking_service, game_service):
        """Test service initialization"""
        assert matchmaking_service.game_service == game_service
        assert matchmaking_service.waiting_queue == []
        assert matchmaking_service.active_rooms == {}
        assert matchmaking_service.player_rooms == {}
    
    def test_add_to_queue(self, matchmaking_service, player1):
        """Test adding player to matchmaking queue"""
        queue_size = matchmaking_service.add_to_queue(player1)
        
        assert queue_size == 1
        assert player1 in matchmaking_service.waiting_queue
        assert len(matchmaking_service.waiting_queue) == 1
    
    def test_add_multiple_to_queue(self, matchmaking_service, player1, player2, player3):
        """Test adding multiple players to queue"""
        size1 = matchmaking_service.add_to_queue(player1)
        size2 = matchmaking_service.add_to_queue(player2)
        size3 = matchmaking_service.add_to_queue(player3)
        
        assert size1 == 1
        assert size2 == 2
        assert size3 == 3
        assert len(matchmaking_service.waiting_queue) == 3
        assert matchmaking_service.waiting_queue[0] == player1
        assert matchmaking_service.waiting_queue[1] == player2
        assert matchmaking_service.waiting_queue[2] == player3
    
    def test_remove_from_queue(self, matchmaking_service, player1, player2):
        """Test removing player from queue"""
        matchmaking_service.add_to_queue(player1)
        matchmaking_service.add_to_queue(player2)
        
        matchmaking_service.remove_from_queue(player1)
        
        assert player1 not in matchmaking_service.waiting_queue
        assert player2 in matchmaking_service.waiting_queue
        assert len(matchmaking_service.waiting_queue) == 1
    
    def test_remove_from_queue_not_present(self, matchmaking_service, player1, player2):
        """Test removing player that's not in queue"""
        matchmaking_service.add_to_queue(player1)
        
        # Should not raise error
        matchmaking_service.remove_from_queue(player2)
        
        assert player1 in matchmaking_service.waiting_queue
        assert len(matchmaking_service.waiting_queue) == 1
    
    def test_try_match_players_insufficient(self, matchmaking_service, player1):
        """Test matching with insufficient players"""
        matchmaking_service.add_to_queue(player1)
        
        room = matchmaking_service.try_match_players()
        
        assert room is None
        assert player1 in matchmaking_service.waiting_queue
    
    def test_try_match_players_empty_queue(self, matchmaking_service):
        """Test matching with empty queue"""
        room = matchmaking_service.try_match_players()
        
        assert room is None
        assert len(matchmaking_service.waiting_queue) == 0
    
    def test_try_match_players_success(self, matchmaking_service, game_service, player1, player2):
        """Test successful player matching"""
        # Setup mock to return the room it receives
        def create_room_side_effect(room_id, p1, p2):
            return GameRoom(room_id=room_id, player1=p1, player2=p2)
        
        game_service.create_game_room.side_effect = create_room_side_effect
        
        matchmaking_service.add_to_queue(player1)
        matchmaking_service.add_to_queue(player2)
        
        room = matchmaking_service.try_match_players()
        
        assert room is not None
        assert room.player1 == player1
        assert room.player2 == player2
        assert len(matchmaking_service.waiting_queue) == 0
        assert room.id in matchmaking_service.active_rooms
        assert matchmaking_service.player_rooms[player1.id] == room.id
        assert matchmaking_service.player_rooms[player2.id] == room.id
        
        # Verify game service was called
        game_service.create_game_room.assert_called_once()
    
    def test_try_match_players_fifo_order(self, matchmaking_service, game_service, player1, player2, player3):
        """Test that matching follows FIFO order"""
        # Setup mock game room
        mock_room = GameRoom(
            room_id="test_room_id",
            player1=player1,
            player2=player2
        )
        game_service.create_game_room.return_value = mock_room
        
        # Add players in order
        matchmaking_service.add_to_queue(player1)
        matchmaking_service.add_to_queue(player2)
        matchmaking_service.add_to_queue(player3)
        
        room = matchmaking_service.try_match_players()
        
        # First two players should be matched
        assert room.player1 == player1
        assert room.player2 == player2
        # Third player should still be in queue
        assert player3 in matchmaking_service.waiting_queue
        assert len(matchmaking_service.waiting_queue) == 1
    
    def test_get_room_by_player(self, matchmaking_service, game_service, player1, player2):
        """Test getting room by player ID"""
        # Setup and create a match
        mock_room = GameRoom(
            room_id="test_room_id",
            player1=player1,
            player2=player2
        )
        game_service.create_game_room.return_value = mock_room
        
        matchmaking_service.add_to_queue(player1)
        matchmaking_service.add_to_queue(player2)
        matchmaking_service.try_match_players()
        
        # Get room by player1
        room1 = matchmaking_service.get_room_by_player(player1.id)
        assert room1 is not None
        assert room1.id == mock_room.id
        
        # Get room by player2
        room2 = matchmaking_service.get_room_by_player(player2.id)
        assert room2 is not None
        assert room2.id == mock_room.id
    
    def test_get_room_by_player_not_found(self, matchmaking_service):
        """Test getting room for player not in any room"""
        room = matchmaking_service.get_room_by_player("nonexistent_player")
        
        assert room is None
    
    def test_cleanup_room(self, matchmaking_service, game_service, player1, player2):
        """Test cleaning up a game room"""
        # Setup mock to return the room it receives
        def create_room_side_effect(room_id, p1, p2):
            return GameRoom(room_id=room_id, player1=p1, player2=p2)
        
        game_service.create_game_room.side_effect = create_room_side_effect
        
        matchmaking_service.add_to_queue(player1)
        matchmaking_service.add_to_queue(player2)
        room = matchmaking_service.try_match_players()
        
        room_id = room.id
        
        # Verify room exists before cleanup
        assert room_id in matchmaking_service.active_rooms
        assert player1.id in matchmaking_service.player_rooms
        assert player2.id in matchmaking_service.player_rooms
        
        # Cleanup
        matchmaking_service.cleanup_room(room_id)
        
        # Verify cleanup
        assert room_id not in matchmaking_service.active_rooms
        assert player1.id not in matchmaking_service.player_rooms
        assert player2.id not in matchmaking_service.player_rooms
    
    def test_cleanup_room_not_exists(self, matchmaking_service):
        """Test cleaning up non-existent room"""
        # Should not raise error
        matchmaking_service.cleanup_room("nonexistent_room_id")
        
        assert len(matchmaking_service.active_rooms) == 0
    
    def test_get_stats_empty(self, matchmaking_service):
        """Test getting stats with no activity"""
        stats = matchmaking_service.get_stats()
        
        assert stats['active_rooms'] == 0
        assert stats['waiting_players'] == 0
    
    def test_get_stats_with_waiting_players(self, matchmaking_service, player1, player2):
        """Test getting stats with players in queue"""
        matchmaking_service.add_to_queue(player1)
        matchmaking_service.add_to_queue(player2)
        
        stats = matchmaking_service.get_stats()
        
        assert stats['active_rooms'] == 0
        assert stats['waiting_players'] == 2
    
    def test_get_stats_with_active_rooms(self, matchmaking_service, game_service, player1, player2, player3):
        """Test getting stats with active rooms and waiting players"""
        # Setup mock room
        mock_room = GameRoom(
            room_id="test_room_id",
            player1=player1,
            player2=player2
        )
        game_service.create_game_room.return_value = mock_room
        
        # Create a match
        matchmaking_service.add_to_queue(player1)
        matchmaking_service.add_to_queue(player2)
        matchmaking_service.try_match_players()
        
        # Add another waiting player
        matchmaking_service.add_to_queue(player3)
        
        stats = matchmaking_service.get_stats()
        
        assert stats['active_rooms'] == 1
        assert stats['waiting_players'] == 1
    
    def test_multiple_matches(self, matchmaking_service, game_service):
        """Test creating multiple matches"""
        # Create 4 players
        mock_ws = Mock()
        players = [
            Player(player_id=f"player{i}", username=f"player{i}", websocket=mock_ws)
            for i in range(4)
        ]
        
        # Setup mock rooms
        def create_room_side_effect(room_id, p1, p2):
            return GameRoom(room_id=room_id, player1=p1, player2=p2)
        
        game_service.create_game_room.side_effect = create_room_side_effect
        
        # Add all players to queue
        for player in players:
            matchmaking_service.add_to_queue(player)
        
        # Create first match
        room1 = matchmaking_service.try_match_players()
        assert room1 is not None
        assert room1.player1 == players[0]
        assert room1.player2 == players[1]
        
        # Create second match
        room2 = matchmaking_service.try_match_players()
        assert room2 is not None
        assert room2.player1 == players[2]
        assert room2.player2 == players[3]
        
        # Verify state
        assert len(matchmaking_service.waiting_queue) == 0
        assert len(matchmaking_service.active_rooms) == 2
        assert len(matchmaking_service.player_rooms) == 4
        
        stats = matchmaking_service.get_stats()
        assert stats['active_rooms'] == 2
        assert stats['waiting_players'] == 0
    
    def test_cleanup_one_of_multiple_rooms(self, matchmaking_service, game_service):
        """Test cleaning up one room while keeping others active"""
        # Create 4 players and 2 rooms
        mock_ws = Mock()
        players = [
            Player(player_id=f"player{i}", username=f"player{i}", websocket=mock_ws)
            for i in range(4)
        ]
        
        def create_room_side_effect(room_id, p1, p2):
            return GameRoom(room_id=room_id, player1=p1, player2=p2)
        
        game_service.create_game_room.side_effect = create_room_side_effect
        
        for player in players:
            matchmaking_service.add_to_queue(player)
        
        room1 = matchmaking_service.try_match_players()
        room2 = matchmaking_service.try_match_players()
        
        # Cleanup first room
        matchmaking_service.cleanup_room(room1.id)
        
        # Verify first room is cleaned but second remains
        assert room1.id not in matchmaking_service.active_rooms
        assert room2.id in matchmaking_service.active_rooms
        assert players[0].id not in matchmaking_service.player_rooms
        assert players[1].id not in matchmaking_service.player_rooms
        assert players[2].id in matchmaking_service.player_rooms
        assert players[3].id in matchmaking_service.player_rooms
        
        stats = matchmaking_service.get_stats()
        assert stats['active_rooms'] == 1
