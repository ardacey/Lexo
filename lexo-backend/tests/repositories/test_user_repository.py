"""
Tests for UserRepository (async SQLite via aiosqlite).
"""
import pytest
import uuid
from sqlalchemy import delete as sa_delete

from app.repositories.user_repository import UserRepository
from app.models.database import UserStats, User


class TestUserRepository:

    async def test_get_by_supabase_user_id(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        user = User(supabase_user_id="test_user_123", username="testuser",
                    email="test@example.com")
        async_db_session.add(user)
        await async_db_session.commit()

        found = await repo.get_by_supabase_user_id("test_user_123")
        assert found is not None
        assert found.supabase_user_id == "test_user_123"
        assert found.username == "testuser"
        assert found.email == "test@example.com"

    async def test_get_by_supabase_user_id_not_found(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        found = await repo.get_by_supabase_user_id("nonexistent_user")
        assert found is None

    async def test_get_by_supabase_user_id_with_stats(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(UserStats))
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        user = User(supabase_user_id="test_user_456", username="statuser",
                    email="stats@example.com")
        async_db_session.add(user)
        await async_db_session.flush()

        stats = UserStats(
            user_id=user.id, total_games=10, wins=5,
            highest_score=100, total_score=500, total_words=50,
            longest_word="python", best_win_streak=3
        )
        async_db_session.add(stats)
        await async_db_session.commit()

        found = await repo.get_by_supabase_user_id("test_user_456", with_stats=True)
        assert found is not None
        assert found.username == "statuser"
        assert found.stats is not None
        assert found.stats.wins == 5
        assert found.stats.highest_score == 100

    async def test_get_by_username(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        user = User(supabase_user_id="user_789", username="uniqueuser",
                    email="unique@example.com")
        async_db_session.add(user)
        await async_db_session.commit()

        found = await repo.get_by_username("uniqueuser")
        assert found is not None
        assert found.username == "uniqueuser"
        assert found.supabase_user_id == "user_789"

    async def test_get_by_username_not_found(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        found = await repo.get_by_username("nonexistent")
        assert found is None

    async def test_get_by_email(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        user = User(supabase_user_id="user_email", username="emailuser",
                    email="email@test.com")
        async_db_session.add(user)
        await async_db_session.commit()

        found = await repo.get_by_email("email@test.com")
        assert found is not None
        assert found.email == "email@test.com"
        assert found.username == "emailuser"

    async def test_get_by_email_not_found(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        found = await repo.get_by_email("nonexistent@email.com")
        assert found is None

    async def test_get_multiple_by_ids(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        users = []
        for i in range(3):
            u = User(supabase_user_id=f"user_batch_{i}",
                     username=f"batchuser{i}", email=f"batch{i}@test.com")
            async_db_session.add(u)
            await async_db_session.flush()
            users.append(u)
        await async_db_session.commit()

        ids = [u.id for u in users]
        found = await repo.get_multiple_by_ids(ids)
        assert len(found) == 3
        names = {u.username for u in found}
        assert "batchuser0" in names
        assert "batchuser1" in names
        assert "batchuser2" in names

    async def test_get_multiple_by_ids_with_stats(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(UserStats))
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        users = []
        for i in range(2):
            u = User(supabase_user_id=f"user_stats_{i}",
                     username=f"statsuser{i}", email=f"stats{i}@test.com")
            async_db_session.add(u)
            await async_db_session.flush()
            s = UserStats(user_id=u.id, total_games=i + 1, wins=i,
                          highest_score=100 * (i + 1), total_score=100,
                          total_words=10, longest_word="test", best_win_streak=1)
            async_db_session.add(s)
            users.append(u)
        await async_db_session.commit()

        ids = [u.id for u in users]
        found = await repo.get_multiple_by_ids(ids, with_stats=True)
        assert len(found) == 2
        for u in found:
            assert u.stats is not None
            assert u.stats.total_games > 0

    async def test_create_user(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        new_user = await repo.create_user(
            supabase_user_id="new_supabase_user",
            username="newuser",
            email="new@test.com"
        )
        assert new_user.id is not None
        assert new_user.supabase_user_id == "new_supabase_user"
        assert new_user.username == "newuser"
        assert new_user.email == "new@test.com"
        assert new_user.created_at is not None

        found = await repo.get_by_supabase_user_id("new_supabase_user")
        assert found is not None
        assert found.username == "newuser"

    async def test_create_user_without_email(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        new_user = await repo.create_user(
            supabase_user_id="no_email_user",
            username="noemail"
        )
        assert new_user.id is not None
        assert new_user.supabase_user_id == "no_email_user"
        assert new_user.username == "noemail"
        assert new_user.email is None

    async def test_update_last_login(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        user = User(supabase_user_id="login_user", username="loginuser",
                    email="login@test.com")
        async_db_session.add(user)
        await async_db_session.commit()

        updated = await repo.update_last_login(user)
        assert updated.last_login is not None

    async def test_get_or_create_existing_user(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        existing = User(supabase_user_id="existing_user", username="existing",
                        email="existing@test.com")
        async_db_session.add(existing)
        await async_db_session.commit()
        original_id = existing.id

        user, created = await repo.get_or_create(
            supabase_user_id="existing_user",
            username="existing",
            email="existing@test.com"
        )
        assert created is False
        assert user.id == original_id
        assert user.username == "existing"
        assert user.last_login is not None

    async def test_get_or_create_new_user(self, async_db_session):
        repo = UserRepository(async_db_session)
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        user, created = await repo.get_or_create(
            supabase_user_id="brand_new_supabase_user",
            username="brandnew",
            email="brandnew@test.com"
        )
        assert created is True
        assert user.id is not None
        assert user.supabase_user_id == "brand_new_supabase_user"
        assert user.username == "brandnew"
        assert user.email == "brandnew@test.com"

        found = await repo.get_by_supabase_user_id("brand_new_supabase_user")
        assert found is not None
        assert found.username == "brandnew"
