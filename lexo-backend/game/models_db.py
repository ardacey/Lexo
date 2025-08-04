from sqlalchemy import Column, String, Integer, ForeignKey, JSON, Boolean, Enum as SQLAlchemyEnum, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum

class RoomStatus(str, enum.Enum):
    WAITING = "waiting"
    COUNTDOWN = "countdown"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"

class GameMode(str, enum.Enum):
    CLASSIC = "classic"
    BATTLE_ROYALE = "battle_royale"

class RoomDB(Base):
    __tablename__ = "rooms"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    status = Column(SQLAlchemyEnum(RoomStatus), default=RoomStatus.WAITING, nullable=False, index=True)
    game_mode = Column(SQLAlchemyEnum(GameMode), default=GameMode.CLASSIC, nullable=False, index=True)
    letter_pool = Column(JSON, default=list)
    used_words = Column(JSON, default=list)
    started = Column(Boolean, default=False, index=True)
    time_left = Column(Integer, default=0)
    total_game_time = Column(Integer, default=60)  # Battle royale için daha uzun
    game_start_time = Column(DateTime, nullable=True)
    countdown_start_time = Column(DateTime, nullable=True)  # 1 dakikalık geri sayım için
    created_at = Column(DateTime, server_default=func.now(), index=True)
    max_players = Column(Integer, default=2)
    min_players = Column(Integer, default=2)  # Battle royale için min 3
    elimination_interval = Column(Integer, default=30)  # Saniye cinsinden eleme aralığı
    players_per_elimination = Column(Integer, default=1)  # Her eleme turunda kaç kişi elenir
    players = relationship("PlayerDB", back_populates="room", cascade="all, delete-orphan")

    @property
    def is_joinable(self):
        active_players = [p for p in self.players if not p.is_viewer]
        if self.game_mode.value == GameMode.CLASSIC.value:
            return self.status == RoomStatus.WAITING and len(active_players) < self.max_players
        elif self.game_mode.value == GameMode.BATTLE_ROYALE.value:
            return (self.status in [RoomStatus.WAITING, RoomStatus.COUNTDOWN] and 
                   len(active_players) < self.max_players)
        return False
    
    @property
    def is_viewable(self):
        return self.status in [RoomStatus.IN_PROGRESS, RoomStatus.COUNTDOWN] and len(self.players) > 0
    
    @property 
    def should_be_deleted(self):
        return len(self.players) == 0 or self.status == RoomStatus.FINISHED

    def is_word_used_in_room(self, word: str) -> bool:
        return word in (self.used_words or [])
    
    def add_used_word(self, word: str):
        if self.used_words is None:
            self.used_words = []
        if word not in self.used_words:
            self.used_words.append(word)
    
    def get_scores(self) -> dict:
        return {player.username: player.score for player in self.players}

class PlayerDB(Base):
    __tablename__ = "players"
    id = Column(String, primary_key=True, index=True)
    username = Column(String, nullable=False, index=True)
    score = Column(Integer, default=0)
    words = Column(JSON, default=list)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    is_viewer = Column(Boolean, default=False, index=True)
    is_eliminated = Column(Boolean, default=False, index=True)
    elimination_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    room = relationship("RoomDB", back_populates="players")