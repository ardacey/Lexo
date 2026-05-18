"""
Tests for StatsRepository (async SQLite via aiosqlite).
"""
import pytest
import uuid
from sqlalchemy import delete as sa_delete

from app.repositories.stats_repository import StatsRepository
from app.models.database import UserStats, User


class TestStatsRepository:

    async def test_get_by_user_id(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        stats = UserStats(user_id=async_test_user.id, total_games=5, wins=3, losses=2)
        async_db_session.add(stats)
        await async_db_session.commit()

        result = await repo.get_by_user_id(async_test_user.id)
        assert result is not None
        assert result.user_id == async_test_user.id
        assert result.total_games == 5
        assert result.wins == 3
        assert result.losses == 2

    async def test_get_by_user_id_with_user(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        stats = UserStats(user_id=async_test_user.id)
        async_db_session.add(stats)
        await async_db_session.commit()

        result = await repo.get_by_user_id(async_test_user.id, with_user=True)
        assert result is not None
        assert result.user.username == async_test_user.username

    async def test_get_by_user_id_not_found(self, async_db_session):
        repo = StatsRepository(async_db_session)

        result = await repo.get_by_user_id(99999)
        assert result is None

    async def test_create_for_user(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        stats = await repo.create_for_user(async_test_user.id)
        assert stats.id is not None
        assert stats.user_id == async_test_user.id
        assert stats.total_games == 0
        assert stats.wins == 0
        assert stats.losses == 0

    async def test_get_or_create_existing(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        initial = UserStats(user_id=async_test_user.id, total_games=5)
        async_db_session.add(initial)
        await async_db_session.commit()
        initial_id = initial.id

        result = await repo.get_or_create(async_test_user.id)
        assert result.id == initial_id
        assert result.total_games == 5

    async def test_get_or_create_new(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        result = await repo.get_or_create(async_test_user.id)
        assert result.id is not None
        assert result.user_id == async_test_user.id
        assert result.total_games == 0

    async def test_update_after_game_win(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        stats = UserStats(
            user_id=async_test_user.id,
            total_games=5, wins=2,
            current_win_streak=1, best_win_streak=2,
            total_score=150, highest_score=40,
            total_words=25, longest_word="test", longest_word_length=4
        )
        async_db_session.add(stats)
        await async_db_session.commit()

        updated = await repo.update_after_game(
            user_id=async_test_user.id,
            score=50,
            words=["kelime", "oyun", "test"],
            won=True,
            tied=False,
            game_duration=300,
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

    async def test_update_after_game_loss(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        stats = UserStats(
            user_id=async_test_user.id,
            total_games=5, wins=3, losses=1,
            current_win_streak=2, best_win_streak=3,
            total_score=150, highest_score=40,
        )
        async_db_session.add(stats)
        await async_db_session.commit()

        updated = await repo.update_after_game(
            user_id=async_test_user.id,
            score=25,
            words=["test"],
            won=False,
            tied=False,
            game_duration=180,
        )
        assert updated.total_games == 6
        assert updated.losses == 2
        assert updated.current_win_streak == 0
        assert updated.best_win_streak == 3

    async def test_update_after_game_tie(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        stats = UserStats(
            user_id=async_test_user.id,
            total_games=5, wins=2, ties=1,
            current_win_streak=1, total_score=150,
        )
        async_db_session.add(stats)
        await async_db_session.commit()

        updated = await repo.update_after_game(
            user_id=async_test_user.id,
            score=30,
            words=["test", "word"],
            won=False,
            tied=True,
            game_duration=240,
        )
        assert updated.total_games == 6
        assert updated.ties == 2
        assert updated.current_win_streak == 0
        assert updated.total_score == 180

    async def test_update_after_game_new_best_streak(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        stats = UserStats(
            user_id=async_test_user.id,
            current_win_streak=4, best_win_streak=4, total_score=100,
        )
        async_db_session.add(stats)
        await async_db_session.commit()

        updated = await repo.update_after_game(
            user_id=async_test_user.id,
            score=30,
            words=["test"],
            won=True,
            tied=False,
            game_duration=180,
        )
        assert updated.current_win_streak == 5
        assert updated.best_win_streak == 5

    async def test_update_after_game_average_score(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        stats = UserStats(
            user_id=async_test_user.id,
            total_games=4, total_score=200,
        )
        async_db_session.add(stats)
        await async_db_session.commit()

        updated = await repo.update_after_game(
            user_id=async_test_user.id,
            score=50,
            words=["test"],
            won=True,
            tied=False,
            game_duration=180,
        )
        assert updated.total_games == 5
        assert updated.total_score == 250
        assert updated.average_score == 50.0

    async def test_get_leaderboard(self, async_db_session):
        repo = StatsRepository(async_db_session)
        await async_db_session.execute(sa_delete(UserStats))
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        for wins, high_score in [(10, 50), (8, 60), (12, 45)]:
            uid = uuid.uuid4().hex[:8]
            user = User(supabase_user_id=f"u_{uid}", username=f"p_{uid}",
                        email=f"{uid}@test.com")
            async_db_session.add(user)
            await async_db_session.flush()
            async_db_session.add(UserStats(
                user_id=user.id, total_games=15, wins=wins,
                highest_score=high_score, total_score=wins * 40,
                total_words=wins * 5, longest_word="kelime", best_win_streak=3,
            ))
        await async_db_session.commit()

        leaderboard = await repo.get_leaderboard(limit=10)
        assert len(leaderboard) == 3
        assert leaderboard[0]["wins"] == 12
        assert leaderboard[1]["wins"] == 10
        assert leaderboard[2]["wins"] == 8

    async def test_get_leaderboard_with_limit(self, async_db_session):
        repo = StatsRepository(async_db_session)
        await async_db_session.execute(sa_delete(UserStats))
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        for i in range(5):
            uid = uuid.uuid4().hex[:8]
            user = User(supabase_user_id=f"u_{uid}", username=f"p_{uid}",
                        email=f"{uid}@test.com")
            async_db_session.add(user)
            await async_db_session.flush()
            async_db_session.add(UserStats(
                user_id=user.id, total_games=10, wins=10 - i,
                highest_score=100, total_score=500, total_words=50,
                longest_word="test", best_win_streak=5,
            ))
        await async_db_session.commit()

        leaderboard = await repo.get_leaderboard(limit=3)
        assert len(leaderboard) == 3
        assert leaderboard[0]["wins"] == 10
        assert leaderboard[1]["wins"] == 9
        assert leaderboard[2]["wins"] == 8

    async def test_get_leaderboard_cached(self, async_db_session):
        repo = StatsRepository(async_db_session)
        await async_db_session.execute(sa_delete(UserStats))
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        uid = uuid.uuid4().hex[:8]
        user = User(supabase_user_id=f"u_{uid}", username=f"p_{uid}",
                    email=f"{uid}@test.com")
        async_db_session.add(user)
        await async_db_session.flush()
        async_db_session.add(UserStats(
            user_id=user.id, total_games=10, wins=5,
            highest_score=100, total_score=500, total_words=50,
            longest_word="test", best_win_streak=3,
        ))
        await async_db_session.commit()

        lb1 = await repo.get_leaderboard(limit=10)
        lb2 = await repo.get_leaderboard(limit=10)
        assert len(lb1) == 1
        assert lb1[0]["username"] == user.username
        assert lb1[0]["wins"] == 5
        assert lb1 == lb2

    async def test_get_user_rank(self, async_db_session):
        repo = StatsRepository(async_db_session)
        await async_db_session.execute(sa_delete(UserStats))
        await async_db_session.execute(sa_delete(User))
        await async_db_session.commit()

        users = []
        for i in range(5):
            uid = uuid.uuid4().hex[:8]
            user = User(supabase_user_id=f"rank_{uid}", username=f"r_{uid}",
                        email=f"r_{uid}@test.com")
            async_db_session.add(user)
            await async_db_session.flush()
            async_db_session.add(UserStats(
                user_id=user.id, wins=10 - i * 2,
                highest_score=50 - i * 5, total_games=15,
            ))
            users.append(user)
        await async_db_session.commit()

        rank = await repo.get_user_rank(users[0].id)
        assert rank == 1

        rank = await repo.get_user_rank(users[2].id)
        assert rank == 3

    async def test_get_user_rank_not_found(self, async_db_session):
        repo = StatsRepository(async_db_session)
        rank = await repo.get_user_rank(99999)
        assert rank is None

    async def test_cache_invalidation_after_update(self, async_db_session, async_test_user):
        repo = StatsRepository(async_db_session)

        stats = UserStats(user_id=async_test_user.id, total_games=5, wins=3)
        async_db_session.add(stats)
        await async_db_session.commit()

        # Should not raise; return value not asserted (side-effect test)
        await repo.update_after_game(
            user_id=async_test_user.id,
            score=30,
            words=["test"],
            won=True,
            tied=False,
            game_duration=180,
        )
