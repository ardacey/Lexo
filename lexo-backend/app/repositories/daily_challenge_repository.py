from typing import List, Optional
from datetime import date
import json

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.models.database import DailyChallenge, DailyChallengeEntry, User
from app.core.logging import get_logger

logger = get_logger(__name__)


class DailyChallengeRepository:

    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Daily challenge (the shared pool)
    # ------------------------------------------------------------------

    async def get_challenge_by_date(self, challenge_date: date) -> Optional[DailyChallenge]:
        stmt = select(DailyChallenge).where(DailyChallenge.date == challenge_date)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_challenge(self, challenge_date: date, pool: List[str]) -> DailyChallenge:
        challenge = DailyChallenge(
            date=challenge_date,
            letter_pool=",".join(pool),
        )
        self.db.add(challenge)
        await self.db.commit()
        await self.db.refresh(challenge)
        logger.info(f"Created daily challenge for {challenge_date}")
        return challenge

    # ------------------------------------------------------------------
    # User entries
    # ------------------------------------------------------------------

    async def get_entry(self, user_id: int, challenge_date: date) -> Optional[DailyChallengeEntry]:
        stmt = select(DailyChallengeEntry).where(
            DailyChallengeEntry.user_id == user_id,
            DailyChallengeEntry.challenge_date == challenge_date,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create_entry(
        self,
        user_id: int,
        challenge_date: date,
        score: int,
        words: List[str],
    ) -> DailyChallengeEntry:
        entry = DailyChallengeEntry(
            user_id=user_id,
            challenge_date=challenge_date,
            score=score,
            words=json.dumps(words),
            word_count=len(words),
        )
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        logger.info(f"Created daily challenge entry for user {user_id} on {challenge_date}")
        return entry

    async def get_leaderboard(self, challenge_date: date, limit: int = 20) -> List[dict]:
        stmt = (
            select(DailyChallengeEntry, User)
            .join(User, DailyChallengeEntry.user_id == User.id)
            .where(DailyChallengeEntry.challenge_date == challenge_date)
            .order_by(desc(DailyChallengeEntry.score), desc(DailyChallengeEntry.word_count))
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        rows = result.all()

        leaderboard = []
        for entry, user in rows:
            leaderboard.append({
                "username": user.username,
                "score": entry.score,
                "word_count": entry.word_count,
                "completed_at": entry.completed_at.isoformat(),
            })
        return leaderboard
