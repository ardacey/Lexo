from sqlalchemy import Column, String, Integer, ForeignKey, JSON, Boolean, Enum as SQLAlchemyEnum
from sqlalchemy.orm import relationship
from core.database import Base
import enum

class RoomStatus(str, enum.Enum):
    WAITING = "waiting"
    COUNTDOWN = "countdown"
    IN_PROGRESS = "in_progress"
    FINISHED = "finished"

class RoomDB(Base):
    __tablename__ = "rooms"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    status = Column(SQLAlchemyEnum(RoomStatus), default=RoomStatus.WAITING, nullable=False)
    letter_pool = Column(JSON, default=list)
    used_words = Column(JSON, default=list)
    started = Column(Boolean, default=False)
    time_left = Column(Integer, default=0)
    players = relationship("PlayerDB", back_populates="room", cascade="all, delete-orphan")

class PlayerDB(Base):
    __tablename__ = "players"
    id = Column(String, primary_key=True, index=True)
    username = Column(String, nullable=False)
    score = Column(Integer, default=0)
    words = Column(JSON, default=list)
    room_id = Column(String, ForeignKey("rooms.id"), nullable=False)
    room = relationship("RoomDB", back_populates="players")