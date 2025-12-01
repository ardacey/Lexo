"""
Tests for UserRepository
"""
import pytest
from datetime import datetime
from app.repositories.user_repository import UserRepository
from app.models.database import User, UserStats


class TestUserRepository:
    """Test suite for UserRepository"""
    
    def test_get_by_supabase_user_id(self, db_session):
        """Test getting user by supabase_user_id"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        # Create a user
        user = User(
            supabase_user_id="test_user_123",
            username="testuser",
            email="test@example.com"
        )
        db_session.add(user)
        db_session.commit()
        
        
        # Get by supabase_user_id
        found_user = repo.get_by_supabase_user_id("test_user_123")
        
        assert found_user is not None
        assert found_user.supabase_user_id == "test_user_123"
        assert found_user.username == "testuser"
        assert found_user.email == "test@example.com"
    
    def test_get_by_supabase_user_id_not_found(self, db_session):
        """Test getting user by supabase_user_id that doesn't exist"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        
        found_user = repo.get_by_supabase_user_id("nonexistent_user")
        
        assert found_user is None
    
    def test_get_by_supabase_user_id_with_stats(self, db_session):
        """Test getting user with eager-loaded stats"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(UserStats).delete()
        db_session.query(User).delete()
        db_session.commit()
        
        
        # Create user with stats
        user = User(
            supabase_user_id="test_user_456",
            username="statuser",
            email="stats@example.com"
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
            longest_word="python",
            best_win_streak=3
        )
        db_session.add(stats)
        db_session.commit()
        
        # Get with stats
        found_user = repo.get_by_supabase_user_id("test_user_456", with_stats=True)
        
        assert found_user is not None
        assert found_user.username == "statuser"
        # Stats should be loaded (not trigger additional query)
        assert found_user.stats is not None
        assert found_user.stats.wins == 5
        assert found_user.stats.highest_score == 100
    
    def test_get_by_username(self, db_session):
        """Test getting user by username"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        # Create user
        user = User(
            supabase_user_id="user_789",
            username="uniqueuser",
            email="unique@example.com"
        )
        db_session.add(user)
        db_session.commit()
        
        # Get by username
        found_user = repo.get_by_username("uniqueuser")
        
        assert found_user is not None
        assert found_user.username == "uniqueuser"
        assert found_user.supabase_user_id == "user_789"
    
    def test_get_by_username_not_found(self, db_session):
        """Test getting user by username that doesn't exist"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        found_user = repo.get_by_username("nonexistent")
        
        assert found_user is None
    
    def test_get_by_email(self, db_session):
        """Test getting user by email"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        # Create user
        user = User(
            supabase_user_id="user_email",
            username="emailuser",
            email="email@test.com"
        )
        db_session.add(user)
        db_session.commit()
        
        # Get by email
        found_user = repo.get_by_email("email@test.com")
        
        assert found_user is not None
        assert found_user.email == "email@test.com"
        assert found_user.username == "emailuser"
    
    def test_get_by_email_not_found(self, db_session):
        """Test getting user by email that doesn't exist"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        found_user = repo.get_by_email("nonexistent@email.com")
        
        assert found_user is None
    
    def test_get_multiple_by_ids(self, db_session):
        """Test batch fetching multiple users by IDs"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        # Create multiple users
        users = []
        for i in range(3):
            user = User(
                supabase_user_id=f"user_batch_{i}",
                username=f"batchuser{i}",
                email=f"batch{i}@test.com"
            )
            db_session.add(user)
            db_session.flush()
            users.append(user)
        
        db_session.commit()
        
        # Get multiple by IDs
        user_ids = [u.id for u in users]
        found_users = repo.get_multiple_by_ids(user_ids)
        
        assert len(found_users) == 3
        found_usernames = {u.username for u in found_users}
        assert "batchuser0" in found_usernames
        assert "batchuser1" in found_usernames
        assert "batchuser2" in found_usernames
    
    def test_get_multiple_by_ids_with_stats(self, db_session):
        """Test batch fetching users with stats"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(UserStats).delete()
        db_session.query(User).delete()
        db_session.commit()
        
        # Create users with stats
        users = []
        for i in range(2):
            user = User(
                supabase_user_id=f"user_stats_{i}",
                username=f"statsuser{i}",
                email=f"stats{i}@test.com"
            )
            db_session.add(user)
            db_session.flush()
            
            stats = UserStats(
                user_id=user.id,
                total_games=i + 1,
                wins=i,
                highest_score=100 * (i + 1),
                total_score=100,
                total_words=10,
                longest_word="test",
                best_win_streak=1
            )
            db_session.add(stats)
            users.append(user)
        
        db_session.commit()
        
        # Get multiple with stats
        user_ids = [u.id for u in users]
        found_users = repo.get_multiple_by_ids(user_ids, with_stats=True)
        
        assert len(found_users) == 2
        # Check that stats are loaded
        for user in found_users:
            assert user.stats is not None
            assert user.stats.total_games > 0
    
    def test_create_user(self, db_session):
        """Test creating a new user"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        # Create user
        new_user = repo.create_user(
            supabase_user_id="new_supabase_user",
            username="newuser",
            email="new@test.com"
        )
        
        assert new_user.id is not None
        assert new_user.supabase_user_id == "new_supabase_user"
        assert new_user.username == "newuser"
        assert new_user.email == "new@test.com"
        assert new_user.created_at is not None
        
        # Verify it's in the database
        found_user = repo.get_by_supabase_user_id("new_supabase_user")
        assert found_user is not None
        assert found_user.username == "newuser"
    
    def test_create_user_without_email(self, db_session):
        """Test creating user without email"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        # Create user without email
        new_user = repo.create_user(
            supabase_user_id="no_email_user",
            username="noemail"
        )
        
        assert new_user.id is not None
        assert new_user.supabase_user_id == "no_email_user"
        assert new_user.username == "noemail"
        assert new_user.email is None
    
    def test_update_last_login(self, db_session):
        """Test updating user's last login timestamp"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        # Create user
        user = User(
            supabase_user_id="login_user",
            username="loginuser",
            email="login@test.com"
        )
        db_session.add(user)
        db_session.commit()
        
        # Store original timestamps
        original_login = user.last_login
        
        # Update last login
        updated_user = repo.update_last_login(user)
        
        assert updated_user.last_login is not None
        if original_login:
            assert updated_user.last_login >= original_login
    
    def test_get_or_create_existing_user(self, db_session):
        """Test get_or_create with existing user"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        
        # Create user first
        existing_user = User(
            supabase_user_id="existing_user",
            username="existing",
            email="existing@test.com"
        )
        db_session.add(existing_user)
        db_session.commit()
        
        original_id = existing_user.id
        
        # Get or create (should get existing)
        user, created = repo.get_or_create(
            supabase_user_id="existing_user",
            username="existing",
            email="existing@test.com"
        )
        
        assert created is False
        assert user.id == original_id
        assert user.username == "existing"
        # Last login should be updated
        assert user.last_login is not None
    
    def test_get_or_create_new_user(self, db_session):
        """Test get_or_create with new user"""
        repo = UserRepository(db_session)
        
        # Clean database
        db_session.query(User).delete()
        db_session.commit()
        
        
        # Get or create (should create new)
        user, created = repo.get_or_create(
            supabase_user_id="brand_new_supabase_user",
            username="brandnew",
            email="brandnew@test.com"
        )
        
        assert created is True
        assert user.id is not None
        assert user.supabase_user_id == "brand_new_supabase_user"
        assert user.username == "brandnew"
        assert user.email == "brandnew@test.com"
        
        # Verify in database
        found_user = repo.get_by_supabase_user_id("brand_new_supabase_user")
        assert found_user is not None
        assert found_user.username == "brandnew"
