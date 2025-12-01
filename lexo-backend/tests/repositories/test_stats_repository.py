import pytest
from datetime import datetime
from app.repositories.stats_repository import StatsRepository
from app.models.database import UserStats, User


class TestStatsRepository:
    """Test suite for StatsRepository"""
    
    def test_get_by_user_id(self, db_session, test_user):
        """Test getting stats by user ID"""
        repo = StatsRepository(db_session)
        
        # Create stats
        stats = UserStats(
            user_id=test_user.id,
            total_games=5,
            wins=3,
            losses=2
        )
        db_session.add(stats)
        db_session.commit()
        
        # Retrieve stats
        result = repo.get_by_user_id(test_user.id)
        
        assert result is not None
        assert result.user_id == test_user.id
        assert result.total_games == 5
        assert result.wins == 3
        assert result.losses == 2
    
    def test_get_by_user_id_with_user(self, db_session, test_user):
        """Test getting stats with user data"""
        repo = StatsRepository(db_session)
        
        stats = UserStats(user_id=test_user.id)
        db_session.add(stats)
        db_session.commit()
        
        result = repo.get_by_user_id(test_user.id, with_user=True)
        
        assert result is not None
        assert result.user.username == test_user.username
    
    def test_get_by_user_id_not_found(self, db_session):
        """Test getting non-existent stats"""
        repo = StatsRepository(db_session)
        
        result = repo.get_by_user_id(99999)
        
        assert result is None
    
    def test_create_for_user(self, db_session, test_user):
        """Test creating stats for a user"""
        repo = StatsRepository(db_session)
        
        stats = repo.create_for_user(test_user.id)
        
        assert stats.id is not None
        assert stats.user_id == test_user.id
        assert stats.total_games == 0
        assert stats.wins == 0
        assert stats.losses == 0
    
    def test_get_or_create_existing(self, db_session, test_user):
        """Test get_or_create with existing stats"""
        repo = StatsRepository(db_session)
        
        # Create initial stats
        initial_stats = UserStats(user_id=test_user.id, total_games=5)
        db_session.add(initial_stats)
        db_session.commit()
        initial_id = initial_stats.id
        
        # Get or create should return existing
        result = repo.get_or_create(test_user.id)
        
        assert result.id == initial_id
        assert result.total_games == 5
    
    def test_get_or_create_new(self, db_session, test_user):
        """Test get_or_create creating new stats"""
        repo = StatsRepository(db_session)
        
        result = repo.get_or_create(test_user.id)
        
        assert result.id is not None
        assert result.user_id == test_user.id
        assert result.total_games == 0
    
    def test_update_after_game_win(self, db_session, test_user):
        """Test updating stats after a won game"""
        repo = StatsRepository(db_session)
        
        # Create initial stats
        stats = UserStats(
            user_id=test_user.id,
            total_games=5,
            wins=2,
            current_win_streak=1,
            best_win_streak=2,
            total_score=150,
            highest_score=40,
            total_words=25,
            longest_word="test",
            longest_word_length=4
        )
        db_session.add(stats)
        db_session.commit()
        
        # Update after win
        words = ["kelime", "oyun", "test"]
        updated = repo.update_after_game(
            user_id=test_user.id,
            score=50,
            words=words,
            won=True,
            tied=False,
            game_duration=300
        )
        
        assert updated.total_games == 6
        assert updated.wins == 3
        assert updated.current_win_streak == 2
        assert updated.total_score == 200
        assert updated.highest_score == 50
        assert updated.total_words == 28
        assert updated.longest_word == "kelime"
        assert updated.longest_word_length == 6
        assert updated.total_play_time == 300
    
    def test_update_after_game_loss(self, db_session, test_user):
        """Test updating stats after a lost game"""
        repo = StatsRepository(db_session)
        
        stats = UserStats(
            user_id=test_user.id,
            total_games=5,
            wins=3,
            losses=1,
            current_win_streak=2,
            best_win_streak=3,
            total_score=150,
            highest_score=40
        )
        db_session.add(stats)
        db_session.commit()
        
        updated = repo.update_after_game(
            user_id=test_user.id,
            score=25,
            words=["test"],
            won=False,
            tied=False,
            game_duration=180
        )
        
        assert updated.total_games == 6
        assert updated.losses == 2
        assert updated.current_win_streak == 0  # Reset on loss
        assert updated.best_win_streak == 3  # Unchanged
    
    def test_update_after_game_tie(self, db_session, test_user):
        """Test updating stats after a tied game"""
        repo = StatsRepository(db_session)
        
        stats = UserStats(
            user_id=test_user.id,
            total_games=5,
            wins=2,
            ties=1,
            current_win_streak=1,
            total_score=150
        )
        db_session.add(stats)
        db_session.commit()
        
        updated = repo.update_after_game(
            user_id=test_user.id,
            score=30,
            words=["test", "word"],
            won=False,
            tied=True,
            game_duration=240
        )
        
        assert updated.total_games == 6
        assert updated.ties == 2
        assert updated.current_win_streak == 0  # Reset on tie
        assert updated.total_score == 180
    
    def test_update_after_game_new_best_streak(self, db_session, test_user):
        """Test updating best streak when current streak exceeds it"""
        repo = StatsRepository(db_session)
        
        stats = UserStats(
            user_id=test_user.id,
            current_win_streak=4,
            best_win_streak=4,
            total_score=100
        )
        db_session.add(stats)
        db_session.commit()
        
        updated = repo.update_after_game(
            user_id=test_user.id,
            score=30,
            words=["test"],
            won=True,
            tied=False,
            game_duration=180
        )
        
        assert updated.current_win_streak == 5
        assert updated.best_win_streak == 5  # Updated!
    
    def test_update_after_game_average_score(self, db_session, test_user):
        """Test that average score is calculated correctly"""
        repo = StatsRepository(db_session)
        
        stats = UserStats(
            user_id=test_user.id,
            total_games=4,
            total_score=200
        )
        db_session.add(stats)
        db_session.commit()
        
        updated = repo.update_after_game(
            user_id=test_user.id,
            score=50,
            words=["test"],
            won=True,
            tied=False,
            game_duration=180
        )
        
        assert updated.total_games == 5
        assert updated.total_score == 250
        assert updated.average_score == 50.0
    
    def test_get_leaderboard(self, db_session):
        """Test getting leaderboard"""
        import uuid
        repo = StatsRepository(db_session)
        
        # Clean database before test
        db_session.query(UserStats).delete()
        db_session.query(User).delete()
        db_session.commit()
        
        
        # Create multiple users and stats
        users_data = [
            (10, 50),
            (8, 60),
            (12, 45),
        ]
        
        player_names = []
        for i, (wins, highest_score) in enumerate(users_data):
            unique_id = uuid.uuid4().hex[:8]
            username = f"player_{unique_id}"
            player_names.append((username, wins))
            user = User(
                user_id=f"user_{unique_id}",
                username=username,
                email=f"user_{unique_id}@test.com"
            )
            db_session.add(user)
            db_session.flush()
            
            stats = UserStats(
                user_id=user.id,
                total_games=15,
                wins=wins,
                highest_score=highest_score,
                total_score=wins * 40,
                total_words=wins * 5,
                longest_word="kelime",
                best_win_streak=3
            )
            db_session.add(stats)
        
        db_session.commit()
        
        leaderboard = repo.get_leaderboard(limit=10)
        
        assert len(leaderboard) == 3
        # Should be ordered by wins (descending)
        assert leaderboard[0]['wins'] == 12
        assert leaderboard[1]['wins'] == 10
        assert leaderboard[2]['wins'] == 8
    
    def test_get_leaderboard_with_limit(self, db_session):
        """Test getting leaderboard with limit"""
        import uuid
        repo = StatsRepository(db_session)
        
        # Clean database before test
        db_session.query(UserStats).delete()
        db_session.query(User).delete()
        db_session.commit()
        
        
        # Create 5 users
        for i in range(5):
            unique_id = uuid.uuid4().hex[:8]
            user = User(
                user_id=f"user_{unique_id}",
                username=f"player_{unique_id}",
                email=f"user_{unique_id}@test.com"
            )
            db_session.add(user)
            db_session.flush()
            
            stats = UserStats(
                user_id=user.id,
                total_games=10,
                wins=10 - i,  # Descending wins
                highest_score=100,
                total_score=500,
                total_words=50,
                longest_word="test",
                best_win_streak=5
            )
            db_session.add(stats)
        
        db_session.commit()
        
        leaderboard = repo.get_leaderboard(limit=3)
        
        assert len(leaderboard) == 3
        assert leaderboard[0]['wins'] == 10
        assert leaderboard[1]['wins'] == 9
        assert leaderboard[2]['wins'] == 8
    
    def test_get_leaderboard_cached(self, db_session):
        """Test that leaderboard results are consistent across multiple calls"""
        import uuid
        repo = StatsRepository(db_session)
        
        # Clean database before test
        db_session.query(UserStats).delete()
        db_session.query(User).delete()
        db_session.commit()
        
        
        # Create a user
        unique_id = uuid.uuid4().hex[:8]
        user = User(
            user_id=f"user_{unique_id}",
            username=f"player_{unique_id}",
            email=f"user_{unique_id}@test.com"
        )
        db_session.add(user)
        db_session.flush()
        
        stats = UserStats(
            user_id=user.id,
            total_games=10,
            wins=5,
            highest_score=100,
            total_score=500,
            total_words=50,
            longest_word="test",
            best_win_streak=3
        )
        db_session.add(stats)
        db_session.commit()
        
        # First call
        leaderboard1 = repo.get_leaderboard(limit=10)
        
        # Verify structure and content
        assert len(leaderboard1) == 1
        assert leaderboard1[0]['username'] == user.username
        assert leaderboard1[0]['wins'] == 5
        
        # Second call should return same data
        leaderboard2 = repo.get_leaderboard(limit=10)
        
        assert leaderboard1 == leaderboard2
    
    def test_get_user_rank(self, db_session):
        """Test getting user rank"""
        import uuid
        repo = StatsRepository(db_session)
        
        # Clear any existing data
        from app.models.database import UserStats
        db_session.query(UserStats).delete()
        db_session.commit()
        
        # Create users with different wins
        users = []
        for i in range(5):
            unique_id = uuid.uuid4().hex[:8]
            user = User(
                user_id=f"user_rank_{unique_id}",
                username=f"ranker_{unique_id}",
                email=f"rank_{unique_id}@test.com"
            )
            db_session.add(user)
            db_session.flush()
            
            stats = UserStats(
                user_id=user.id,
                wins=10 - i * 2,
                highest_score=50 - i * 5,
                total_games=15
            )
            db_session.add(stats)
            users.append((user, stats))
        
        db_session.commit()
        
        # User with 10 wins should be rank 1
        rank = repo.get_user_rank(users[0][0].id)
        assert rank == 1
        
        # User with 6 wins should be rank 3
        rank = repo.get_user_rank(users[2][0].id)
        assert rank == 3
    
    def test_get_user_rank_not_found(self, db_session):
        """Test getting rank for non-existent user"""
        repo = StatsRepository(db_session)
        
        rank = repo.get_user_rank(99999)
        
        assert rank is None
    
    def test_cache_invalidation_after_update(self, db_session, test_user):
        """Test that caches are invalidated after stats update"""
        repo = StatsRepository(db_session)
        
        stats = UserStats(user_id=test_user.id, total_games=5, wins=3)
        db_session.add(stats)
        db_session.commit()
        
        
        # Update stats
        repo.update_after_game(
            user_id=test_user.id,
            score=30,
            words=["test"],
            won=True,
            tied=False,
            game_duration=180
        )
        
