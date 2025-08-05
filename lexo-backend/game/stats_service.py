from sqlalchemy.orm import Session
from sqlalchemy import func
from game.stats_models import UserStats, GameHistory, WordHistory
from game.logic import calculate_score
from datetime import datetime
import uuid
from typing import Optional, List

class StatsService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_or_create_user_stats(self, user_id: str) -> UserStats:
        user_stats = self.db.query(UserStats).filter(UserStats.user_id == user_id).first()
        if not user_stats:
            user_stats = UserStats(
                id=str(uuid.uuid4()),
                user_id=user_id
            )
            self.db.add(user_stats)
            self.db.commit()
            self.db.refresh(user_stats)
        return user_stats
    
    def update_game_result(
        self,
        user_id: str,
        room_id: str,
        game_mode: str,
        result: str,
        score: int,
        words_played: int,
        started_at: datetime,
        ended_at: datetime,
        final_position: Optional[int] = None,
        total_players: int = 2
    ):
        duration_seconds = int((ended_at - started_at).total_seconds())
        game_history = GameHistory(
            id=str(uuid.uuid4()),
            user_id=user_id,
            room_id=room_id,
            game_mode=game_mode,
            result=result,
            score=score,
            words_played=words_played,
            started_at=started_at,
            ended_at=ended_at,
            duration_seconds=duration_seconds,
            final_position=final_position,
            total_players=total_players
        )
        self.db.add(game_history)
        user_stats = self.get_or_create_user_stats(user_id)
        
        setattr(user_stats, 'total_games', getattr(user_stats, 'total_games', 0) + 1)
        if result == "win":
            setattr(user_stats, 'wins', getattr(user_stats, 'wins', 0) + 1)
        elif result == "loss":
            setattr(user_stats, 'losses', getattr(user_stats, 'losses', 0) + 1)
        elif result == "draw":
            setattr(user_stats, 'draws', getattr(user_stats, 'draws', 0) + 1)
        
        if game_mode == "classic":
            setattr(user_stats, 'classic_games', getattr(user_stats, 'classic_games', 0) + 1)
        elif game_mode == "battle_royale":
            setattr(user_stats, 'battle_royale_games', getattr(user_stats, 'battle_royale_games', 0) + 1)
        elif game_mode == "practice":
            setattr(user_stats, 'practice_games', getattr(user_stats, 'practice_games', 0) + 1)
        
        current_total_score = getattr(user_stats, 'total_score', 0)
        setattr(user_stats, 'total_score', current_total_score + score)
        
        current_highest = getattr(user_stats, 'highest_score', 0)
        if score > current_highest:
            setattr(user_stats, 'highest_score', score)
        
        new_total_games = getattr(user_stats, 'total_games', 0)
        new_total_score = getattr(user_stats, 'total_score', 0)
        if new_total_games > 0:
            setattr(user_stats, 'average_score', new_total_score // new_total_games)
        
        setattr(user_stats, 'total_words', getattr(user_stats, 'total_words', 0) + words_played)
        setattr(user_stats, 'total_playtime_seconds', getattr(user_stats, 'total_playtime_seconds', 0) + duration_seconds)
        
        self.db.commit()
        self.db.refresh(user_stats)
        
        return game_history
    
    def record_word_played(
        self,
        user_id: str,
        game_history_id: str,
        word: str,
        score: int,
        is_valid: bool = True
    ):
        word_history = WordHistory(
            id=str(uuid.uuid4()),
            user_id=user_id,
            game_history_id=game_history_id,
            word=word,
            score=score,
            word_length=len(word),
            is_valid=is_valid
        )
        self.db.add(word_history)
        
        if is_valid and len(word) > 0:
            user_stats = self.get_or_create_user_stats(user_id)
            current_longest = getattr(user_stats, 'longest_word_length', 0)
            if len(word) > current_longest:
                setattr(user_stats, 'longest_word_length', len(word))
                setattr(user_stats, 'longest_word', word)
                self.db.commit()
        
        self.db.commit()
        return word_history
    
    def get_user_rank(self, user_id: str, sort_by: str = "total_score") -> Optional[int]:
        user_stats = self.get_or_create_user_stats(user_id)
        
        if sort_by == "total_score":
            user_value = user_stats.total_score
        elif sort_by == "wins":
            user_value = user_stats.wins
        elif sort_by == "average_score":
            user_value = user_stats.average_score
        else:
            return None
        
        sort_field = getattr(UserStats, sort_by)
        better_count = self.db.query(UserStats).filter(
            sort_field > user_value,
            UserStats.total_games > 0
        ).count()
        
        return better_count + 1
    
    def get_recent_achievements(self, user_id: str, limit: int = 5) -> List[dict]:
        achievements = []
        user_stats = self.get_or_create_user_stats(user_id)
        
        total_games = getattr(user_stats, 'total_games', 0)
        if total_games >= 100:
            achievements.append({
                "title": "Century Player",
                "description": "Played 100+ games",
                "icon": "🏆"
            })
        
        wins = getattr(user_stats, 'wins', 0)
        if wins >= 50:
            achievements.append({
                "title": "Champion",
                "description": "Won 50+ games",
                "icon": "👑"
            })
        
        longest_word_length = getattr(user_stats, 'longest_word_length', 0)
        longest_word = getattr(user_stats, 'longest_word', '')
        if longest_word_length >= 8:
            achievements.append({
                "title": "Word Master",
                "description": f"Longest word: {longest_word}",
                "icon": "📚"
            })
        
        total_score = getattr(user_stats, 'total_score', 0)
        if total_score >= 10000:
            achievements.append({
                "title": "Score Master",
                "description": "Scored 10,000+ total points",
                "icon": "⭐"
            })
        
        return achievements[:limit]
    
