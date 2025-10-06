from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List, Dict
from datetime import datetime
import json
import logging

from database import User, GameHistory, UserStats

logger = logging.getLogger(__name__)


class UserService:
    @staticmethod
    def create_or_get_user(db: Session, clerk_id: str, username: str, email: Optional[str] = None) -> User:
        user = db.query(User).filter(User.clerk_id == clerk_id).first()
        
        if not user:
            user = User(
                clerk_id=clerk_id,
                username=username,
                email=email
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            stats = UserStats(user_id=user.id)
            db.add(stats)
            db.commit()
            
            logger.info(f"Created new user: {username} (clerk_id: {clerk_id})")
        else:
            user.last_login = datetime.utcnow()
            db.commit()
            logger.info(f"User logged in: {username}")
        
        return user
    
    @staticmethod
    def get_user_by_clerk_id(db: Session, clerk_id: str) -> Optional[User]:
        return db.query(User).filter(User.clerk_id == clerk_id).first()
    
    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        return db.query(User).filter(User.username == username).first()
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()


class GameHistoryService:
    @staticmethod
    def create_game_history(
        db: Session,
        room_id: str,
        player1_id: int,
        player2_id: int,
        player1_score: int,
        player2_score: int,
        player1_words: List[str],
        player2_words: List[str],
        winner_id: Optional[int],
        duration: int,
        letter_pool: List[str],
        started_at: datetime,
        ended_at: datetime
    ) -> GameHistory:
        game = GameHistory(
            room_id=room_id,
            player1_id=player1_id,
            player2_id=player2_id,
            player1_score=player1_score,
            player2_score=player2_score,
            player1_words=json.dumps(player1_words),
            player2_words=json.dumps(player2_words),
            winner_id=winner_id,
            duration=duration,
            letter_pool=','.join(letter_pool),
            started_at=started_at,
            ended_at=ended_at
        )
        
        db.add(game)
        db.commit()
        db.refresh(game)
        
        logger.info(f"Created game history for room: {room_id}")
        return game
    
    @staticmethod
    def get_user_games(db: Session, user_id: int, limit: int = 10) -> List[GameHistory]:
        games = db.query(GameHistory).filter(
            (GameHistory.player1_id == user_id) | (GameHistory.player2_id == user_id)
        ).order_by(desc(GameHistory.ended_at)).limit(limit).all()
        
        return games
    
    @staticmethod
    def get_game_by_room_id(db: Session, room_id: str) -> Optional[GameHistory]:
        return db.query(GameHistory).filter(GameHistory.room_id == room_id).first()


class UserStatsService:
    
    @staticmethod
    def get_user_stats(db: Session, user_id: int) -> Optional[UserStats]:
        return db.query(UserStats).filter(UserStats.user_id == user_id).first()
    
    @staticmethod
    def update_stats_after_game(
        db: Session,
        user_id: int,
        score: int,
        words: List[str],
        won: bool,
        tied: bool,
        game_duration: int
    ):
        stats = db.query(UserStats).filter(UserStats.user_id == user_id).first()
        
        if not stats:
            stats = UserStats(user_id=user_id)
            db.add(stats)
        
        stats.total_games += 1
        if won:
            stats.wins += 1
            stats.current_win_streak += 1
            if stats.current_win_streak > stats.best_win_streak:
                stats.best_win_streak = stats.current_win_streak
        elif tied:
            stats.ties += 1
            stats.current_win_streak = 0
        else:
            stats.losses += 1
            stats.current_win_streak = 0
        
        stats.total_score += score
        if score > stats.highest_score:
            stats.highest_score = score
        stats.average_score = stats.total_score / stats.total_games
        
        stats.total_words += len(words)
        for word in words:
            if len(word) > stats.longest_word_length:
                stats.longest_word = word
                stats.longest_word_length = len(word)
        
        stats.total_play_time += game_duration
        
        stats.last_updated = datetime.utcnow()
        
        db.commit()
        db.refresh(stats)
        
        logger.info(f"Updated stats for user {user_id}: total_games={stats.total_games}, wins={stats.wins}")
        return stats
    
    @staticmethod
    def get_leaderboard(db: Session, limit: int = 100) -> List[Dict]:
        stats = db.query(UserStats, User).join(User).order_by(
            desc(UserStats.wins), 
            desc(UserStats.highest_score)
        ).limit(limit).all()
        
        leaderboard = []
        for stat, user in stats:
            leaderboard.append({
                'username': user.username,
                'total_games': stat.total_games,
                'wins': stat.wins,
                'losses': stat.losses,
                'ties': stat.ties,
                'win_rate': stat.win_rate,
                'highest_score': stat.highest_score,
                'average_score': round(stat.average_score, 2),
                'total_words': stat.total_words,
                'longest_word': stat.longest_word,
                'best_win_streak': stat.best_win_streak
            })
        
        return leaderboard
    
    @staticmethod
    def get_user_rank(db: Session, user_id: int) -> Optional[int]:
        stats = db.query(UserStats).filter(UserStats.user_id == user_id).first()
        if not stats:
            return None
        
        rank = db.query(func.count(UserStats.id)).filter(
            (UserStats.wins > stats.wins) | 
            ((UserStats.wins == stats.wins) & (UserStats.highest_score > stats.highest_score))
        ).scalar()
        
        return rank + 1
