from typing import Dict, List, Optional
from datetime import date, datetime
import json

from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.repositories.daily_challenge_repository import DailyChallengeRepository
from app.utils.game_logic import generate_balanced_letter_pool
from app.core.logging import get_logger

logger = get_logger(__name__)


class DailyChallengeService:

    def __init__(self, db: AsyncSession):
        self.repo = DailyChallengeRepository(db)

    # ------------------------------------------------------------------
    # Get or create today's challenge
    # ------------------------------------------------------------------

    async def get_or_create_today(self) -> Dict:
        """Return today's challenge, creating it if it doesn't exist yet."""
        today = date.today()
        challenge = await self.repo.get_challenge_by_date(today)
        if not challenge:
            pool = generate_balanced_letter_pool(15)
            challenge = await self.repo.create_challenge(today, pool)
            logger.info(f"Auto-created daily challenge for {today}")
        return {
            "date": challenge.date.isoformat(),
            "letter_pool": challenge.letter_pool.split(","),
        }

    # ------------------------------------------------------------------
    # Submit entry
    # ------------------------------------------------------------------

    async def submit(
        self,
        user_db_id: int,
        words: List[str],
        score: int,
    ) -> Dict:
        """
        Save a user's daily challenge entry.
        Raises 409 if the user has already submitted today.
        """
        today = date.today()
        existing = await self.repo.get_entry(user_db_id, today)
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Bu günün yarışmasına zaten katıldınız",
            )

        await self.repo.create_entry(user_db_id, today, score, words)
        leaderboard = await self.repo.get_leaderboard(today, limit=10)

        # Determine the user's rank in today's leaderboard
        rank = next(
            (i + 1 for i, entry in enumerate(leaderboard)
             if entry["score"] <= score),
            len(leaderboard),
        )
        return {"score": score, "rank": rank, "leaderboard": leaderboard}

    # ------------------------------------------------------------------
    # Full challenge state (GET endpoint response)
    # ------------------------------------------------------------------

    async def get_challenge_state(self, user_db_id: int) -> Dict:
        """
        Return the challenge pool plus the user's existing entry (if any)
        and today's leaderboard.
        """
        today = date.today()
        challenge = await self.repo.get_challenge_by_date(today)
        if not challenge:
            pool = generate_balanced_letter_pool(15)
            challenge = await self.repo.create_challenge(today, pool)

        entry = await self.repo.get_entry(user_db_id, today)
        leaderboard = await self.repo.get_leaderboard(today, limit=10)

        user_entry = None
        if entry:
            try:
                user_entry = {
                    "score": entry.score,
                    "words": json.loads(entry.words) if entry.words else [],
                    "word_count": entry.word_count,
                    "completed_at": entry.completed_at.isoformat(),
                }
            except Exception:
                user_entry = {"score": entry.score, "words": [], "word_count": entry.word_count}

        return {
            "date": challenge.date.isoformat(),
            "letter_pool": challenge.letter_pool.split(","),
            "already_played": entry is not None,
            "user_entry": user_entry,
            "leaderboard": leaderboard,
        }
