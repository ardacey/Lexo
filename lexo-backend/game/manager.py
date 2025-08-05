import uuid
import time
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Tuple, cast, Optional
from fastapi import WebSocket
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, select
from .models_db import RoomDB, PlayerDB, RoomStatus, GameMode
from .logic import calculate_score, has_letters_in_pool, generate_letter_pool, generate_initial_balanced_pool, generate_balanced_replacement_letters
from .word_list import is_word_valid
from .stats_service import StatsService
from .constants import (
    BATTLE_ROYALE_COUNTDOWN_SECONDS, BATTLE_ROYALE_MIN_PLAYERS, BATTLE_ROYALE_MAX_PLAYERS,
    BATTLE_ROYALE_INITIAL_POOL_SIZE, BATTLE_ROYALE_GAME_DURATION, BATTLE_ROYALE_ELIMINATION_INTERVAL,
    BATTLE_ROYALE_MIN_SURVIVING_PLAYERS, MIN_WORD_LENGTH
)

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self, max_connections_per_room: int = 50):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
        self.cleanup_tasks: Dict[str, asyncio.Task] = {}
        self.max_connections_per_room = max_connections_per_room

    async def connect(self, ws: WebSocket, room_id: str, player_id: str) -> bool:
        current_connections = len(self.active_connections.get(room_id, {}))
        if current_connections >= self.max_connections_per_room:
            logger.warning(f"Room {room_id} connection limit reached ({current_connections})")
            await ws.accept()
            await ws.close(code=4008, reason="Room connection limit reached")
            return False
            
        await ws.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = {}
        self.active_connections[room_id][player_id] = ws
        logger.info(f"Player {player_id} connected to room {room_id}")
        return True

    def disconnect(self, room_id: str, player_id: str):
        if room_id in self.active_connections and player_id in self.active_connections[room_id]:
            del self.active_connections[room_id][player_id]
            logger.info(f"Player {player_id} disconnected from room {room_id}")
            
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
                if room_id in self.cleanup_tasks:
                    self.cleanup_tasks[room_id].cancel()
                self.cleanup_tasks[room_id] = asyncio.create_task(
                    self._cleanup_empty_room(room_id)
                )
    
    async def _cleanup_empty_room(self, room_id: str):
        try:
            await asyncio.sleep(30)
            from core.database import SessionLocal
            db = SessionLocal()
            try:
                service = RoomService(db)
                service.cleanup_empty_room(room_id)
                logger.info(f"Cleaned up empty room: {room_id}")
            except Exception as e:
                logger.error(f"Error cleaning up room {room_id}: {e}")
            finally:
                db.close()
                if room_id in self.cleanup_tasks:
                    del self.cleanup_tasks[room_id]
        except asyncio.CancelledError:
            logger.debug(f"Cleanup task cancelled for room {room_id}")
        except Exception as e:
            logger.error(f"Error during room cleanup {room_id}: {e}")
    
    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id not in self.active_connections:
            return
            
        disconnected = []
        connections = self.active_connections[room_id].copy()
        
        for player_id, ws in connections.items():
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send message to player {player_id}: {e}")
                disconnected.append(player_id)
        
        for player_id in disconnected:
            self.disconnect(room_id, player_id)

    def get_room_connections(self, room_id: str) -> int:
        return len(self.active_connections.get(room_id, {}))

connection_manager = ConnectionManager()
class RoomService:
    def __init__(self, db: Session):
        self.db = db

    def get_room(self, room_id: str) -> Optional[RoomDB]:
        return self.db.query(RoomDB).options(joinedload(RoomDB.players)).filter(RoomDB.id == room_id).first()

    def calculate_elimination_strategy(self, total_players: int, game_duration: int, elimination_interval: int) -> dict:
        max_eliminations = game_duration // elimination_interval
        players_to_eliminate = total_players - BATTLE_ROYALE_MIN_SURVIVING_PLAYERS
        
        if players_to_eliminate <= 0:
            return {"players_per_elimination": 0, "elimination_rounds": 0}
        
        if players_to_eliminate <= max_eliminations:
            return {"players_per_elimination": 1, "elimination_rounds": players_to_eliminate}
        else:
            players_per_round = (players_to_eliminate + max_eliminations - 1) // max_eliminations
            return {"players_per_elimination": players_per_round, "elimination_rounds": max_eliminations}

    def get_player(self, player_id: str) -> Optional[PlayerDB]:
        return self.db.query(PlayerDB).filter(PlayerDB.id == player_id).first()

    def get_all_rooms(self) -> List[RoomDB]:
        return self.db.query(RoomDB).options(joinedload(RoomDB.players)).all()

    def get_joinable_rooms(self) -> List[RoomDB]:
        return (
            self.db.query(RoomDB)
            .filter(RoomDB.status == RoomStatus.WAITING)
            .filter(func.coalesce(func.count(PlayerDB.id), 0) < RoomDB.max_players)
            .outerjoin(PlayerDB)
            .group_by(RoomDB.id)
            .having(func.count(PlayerDB.id) > 0)
            .all()
        )

    def get_viewable_rooms(self) -> List[RoomDB]:
        return (
            self.db.query(RoomDB)
            .filter(RoomDB.status.in_([RoomStatus.IN_PROGRESS, RoomStatus.COUNTDOWN]))
            .filter(func.count(PlayerDB.id) > 0)
            .join(PlayerDB)
            .group_by(RoomDB.id)
            .all()
        )

    def cleanup_empty_room(self, room_id: str):
        room = self.get_room(room_id)
        if room and room.should_be_deleted: # type: ignore
            self.db.delete(room)
            self.db.commit()
            print(f"Cleaned up empty room: {room_id}")

    def cleanup_finished_rooms(self):
        finished_room_ids = (
            self.db.query(RoomDB.id)
            .filter(
                (RoomDB.status == RoomStatus.FINISHED) |
                (~RoomDB.players.any())
            )
            .all()
        )
        
        if finished_room_ids:
            room_ids_to_delete = [r.id for r in finished_room_ids]
            self.db.query(RoomDB).filter(
                RoomDB.id.in_(room_ids_to_delete)
            ).delete(synchronize_session=False)
            self.db.commit()
            print(f"Cleaned up {len(finished_room_ids)} finished/empty rooms")

    def create_room(self, name: str, username: str, user_id: Optional[str] = None, game_mode: GameMode = GameMode.CLASSIC) -> Tuple[RoomDB, PlayerDB]:
        room_id = str(uuid.uuid4())
        player_id = str(uuid.uuid4())
        
        if game_mode == GameMode.BATTLE_ROYALE:
            max_players = BATTLE_ROYALE_MAX_PLAYERS
            min_players = BATTLE_ROYALE_MIN_PLAYERS
            pool_size = BATTLE_ROYALE_INITIAL_POOL_SIZE
            total_game_time = BATTLE_ROYALE_GAME_DURATION
            elimination_interval = BATTLE_ROYALE_ELIMINATION_INTERVAL
        else:
            max_players = 2
            min_players = 2
            pool_size = 16
            total_game_time = 60
            elimination_interval = 0
        
        new_room = RoomDB(
            id=room_id, 
            name=name, 
            status=RoomStatus.WAITING,
            game_mode=game_mode,
            max_players=max_players,
            min_players=min_players,
            total_game_time=total_game_time,
            elimination_interval=elimination_interval,
            letter_pool=generate_initial_balanced_pool(pool_size), 
            used_words=[]
        )
        new_player = PlayerDB(
            id=player_id, 
            username=username, 
            room_id=room_id, 
            user_id=user_id,
            words=[],
            is_viewer=False
        )
        self.db.add(new_room)
        self.db.add(new_player)
        self.db.commit()
        self.db.refresh(new_room)
        self.db.refresh(new_player)
        return new_room, new_player

    def join_room(self, room_id: str, username: str, user_id: Optional[str] = None, as_viewer: bool = False) -> Tuple[RoomDB, PlayerDB]:
        room = self.get_room(room_id)
        if not room: 
            raise ValueError("Room not found")
        
        if not as_viewer:
            if not room.is_joinable: # type: ignore
                if room.status != RoomStatus.WAITING: # type: ignore
                    as_viewer = True
                else:
                    raise ValueError("Room is full")
        
        player_id = str(uuid.uuid4())
        new_player = PlayerDB(
            id=player_id, 
            username=username, 
            room_id=room_id, 
            user_id=user_id,
            words=[],
            is_viewer=as_viewer
        )
        self.db.add(new_player)
        self.db.commit()
        self.db.refresh(room)
        return room, new_player

    def start_game_for_room(self, room: RoomDB):
        active_players = [p for p in room.players if not getattr(p, 'is_viewer', False)]
        
        if room.game_mode.value == GameMode.CLASSIC.value:
            if len(active_players) != 2:
                return False
            time_left = 60
        elif room.game_mode.value == GameMode.BATTLE_ROYALE.value:
            if len(active_players) < getattr(room, 'min_players', 3):
                return False
            time_left = getattr(room, 'total_game_time', 300)

            elimination_strategy = self.calculate_elimination_strategy(
                total_players=len(active_players),
                game_duration=time_left,
                elimination_interval=getattr(room, 'elimination_interval', 30)
            )

            setattr(room, 'players_per_elimination', elimination_strategy['players_per_elimination'])
            print(f"Battle Royale başlıyor: {len(active_players)} oyuncu, {elimination_strategy['players_per_elimination']} kişi/elimizasyon, {elimination_strategy['elimination_rounds']} elimizasyon turu")
        else:
            return False
            
        setattr(room, 'started', True)
        setattr(room, 'status', RoomStatus.IN_PROGRESS)
        setattr(room, 'time_left', time_left)
        setattr(room, 'game_start_time', datetime.now())
        setattr(room, 'used_words', [])
        
        for player in active_players:
            setattr(player, 'score', 0)
            setattr(player, 'words', [])
            setattr(player, 'is_eliminated', False)
            setattr(player, 'elimination_time', None)

        self.db.commit()
        self.db.refresh(room)
        return True

    def process_word(self, room_id: str, player_id: str, word: str) -> Tuple[bool, dict]:
        room = self.get_room(room_id)
        player = self.db.query(PlayerDB).filter(PlayerDB.id == player_id).first()

        if not room:
            return False, {"type": "error", "message": "Game or room not found."}
        
        if not player:
            return False, {"type": "error", "message": "Player not found in this room."}
        
        if getattr(player, 'is_viewer', False):
            return False, {"type": "error", "message": "Viewers cannot submit words."}
        
        if getattr(player, 'is_eliminated', False):
            return False, {"type": "error", "message": "You have been eliminated from the game."}
        
        room_status = getattr(room, 'status', None)
        room_started = getattr(room, 'started', False)
        
        if room_status == RoomStatus.FINISHED:
            return False, {"type": "error", "message": "Game has already ended."}
        
        if not room_started or room_status != RoomStatus.IN_PROGRESS:
            return False, {"type": "error", "message": "Game is not currently in progress."}

        lower_word = word.lower()

        if len(lower_word) < MIN_WORD_LENGTH:
            return False, {"type": "error", "message": f"Word must be at least {MIN_WORD_LENGTH} characters long."}

        room_used_words = cast(List[str], room.used_words)
        room_letter_pool = cast(List[str], room.letter_pool)
        player_words = cast(List[str], player.words)
        
        if lower_word in room_used_words:
            return False, {"type": "error", "message": f'"{lower_word}" has already been played.'}
        
        if not has_letters_in_pool(lower_word, room_letter_pool):
            return False, {"type": "error", "message": f'Not enough letters for "{lower_word}".'}
        
        if not is_word_valid(lower_word):
            return False, {"type": "word_result", "word": lower_word, "valid": False, "message": f'"{lower_word}" is not a valid word.'}

        score = calculate_score(lower_word)

        new_letter_pool = list(room_letter_pool)
        used_letters = []
        for letter in lower_word:
            new_letter_pool.remove(letter)
            used_letters.append(letter)
        
        replacement_letters = generate_balanced_replacement_letters(used_letters, new_letter_pool)
        new_letter_pool.extend(replacement_letters)
        
        current_score = getattr(player, 'score', 0) or 0
        new_score = current_score + score
        
        self.db.query(PlayerDB).filter(PlayerDB.id == player.id).update({
            'score': new_score,
            'words': player_words + [lower_word]
        })
        
        setattr(room, 'used_words', room_used_words + [lower_word])
        setattr(room, 'letter_pool', new_letter_pool)
        
        self.db.commit()
        self.db.refresh(room)
        self.db.refresh(player)
        
        active_players = [p for p in room.players if not getattr(p, 'is_viewer', False) and not getattr(p, 'is_eliminated', False)]
        success_data = {
            "word": lower_word,
            "score": score,
            "player_total_score": player.score,
            "new_letter_pool": room.letter_pool,
            "current_scores": [{"username": getattr(p, 'username', 'Unknown'), "score": getattr(p, 'score', 0)} for p in active_players]
        }
        
        return True, success_data

    def end_game(self, room_id: str) -> Tuple[RoomDB, dict]:
        print(f"DEBUG: *** END_GAME CALLED FOR ROOM {room_id} ***")
        room = self.get_room(room_id)
        if not room: 
            print(f"DEBUG: Room {room_id} not found!")
            raise ValueError("Cannot end a non-existent room.")
            
        setattr(room, 'started', False)
        setattr(room, 'status', RoomStatus.FINISHED)
        game_end_time = datetime.now()
        setattr(room, 'game_end_time', game_end_time)
        
        active_players = [p for p in room.players if not getattr(p, 'is_viewer', False)]
        scores = sorted([{"username": p.username, "score": p.score} for p in active_players], key=lambda x: x["score"], reverse=True)
        winner_data, is_tie = None, False
        
        print(f"DEBUG: Active players: {[p.username for p in active_players]}")
        print(f"DEBUG: Scores: {scores}")
        
        if scores:
            highest_score = scores[0]["score"]
            winners = [p for p in scores if p["score"] == highest_score]
            if len(winners) > 1: is_tie = True
            winner_data = {"usernames": [w["username"] for w in winners], "score": highest_score}

        print(f"DEBUG: About to call _record_game_stats...")
        self._record_game_stats(room, active_players, scores, game_end_time)
        print(f"DEBUG: _record_game_stats completed, now committing...")
        self.db.commit()
        self.db.refresh(room)
        
        print(f"DEBUG: *** END_GAME COMPLETED FOR ROOM {room_id} ***")
        
        if room.game_mode.value == GameMode.BATTLE_ROYALE.value:
            asyncio.create_task(self._schedule_room_cleanup(room_id, delay=300))
        else:
            asyncio.create_task(self._schedule_room_cleanup(room_id, delay=60))
        
        return room, {"scores": scores, "winner_data": winner_data, "is_tie": is_tie}

    def _record_game_stats(self, room: RoomDB, active_players: List[PlayerDB], scores: List[dict], game_end_time: datetime):
        try:
            print(f"DEBUG: *** RECORDING GAME STATS STARTED ***")
            print(f"DEBUG: Room ID: {getattr(room, 'id', 'unknown')}")
            print(f"DEBUG: Game mode: {getattr(room, 'game_mode', 'unknown')}")
            print(f"DEBUG: Active players count: {len(active_players)}")
            print(f"DEBUG: Scores: {scores}")
            
            stats_service = StatsService(self.db)

            game_start_time = getattr(room, 'created_at', game_end_time)
            if hasattr(room, 'started_at') and getattr(room, 'started_at'):
                game_start_time = getattr(room, 'started_at')

            game_mode = "classic"
            if hasattr(room, 'game_mode'):
                room_game_mode = getattr(room, 'game_mode', None)
                if room_game_mode and room_game_mode.value == GameMode.BATTLE_ROYALE.value:
                    game_mode = "battle_royale"

            score_lookup = {score_data["username"]: score_data["score"] for score_data in scores}

            winner_usernames = []
            if scores:
                highest_score = scores[0]["score"]
                winner_usernames = [p["username"] for p in scores if p["score"] == highest_score]
            
            for player in active_players:
                if getattr(player, 'is_viewer', False):
                    continue

                user_id = getattr(player, 'user_id', None)
                print(f"DEBUG: Processing player {player.username}, user_id: {user_id}")
                
                if not user_id:
                    print(f"DEBUG: Skipping player {player.username} - no user_id")
                    continue
                
                player_score = score_lookup.get(player.username, 0)

                if player.username in winner_usernames:
                    result = "win" if len(winner_usernames) == 1 else "draw"
                else:
                    result = "loss"
                
                final_position = None
                if game_mode == "battle_royale":
                    for idx, score_data in enumerate(scores):
                        if score_data["username"] == player.username:
                            final_position = idx + 1
                            break
                
                words_played = max(1, player_score // 10)
                
                print(f"DEBUG: Recording game result for {player.username} - result: {result}, score: {player_score}")
                stats_service.update_game_result(
                    user_id=str(user_id),
                    room_id=str(getattr(room, 'id', '')),
                    game_mode=game_mode,
                    result=result,
                    score=player_score,
                    words_played=words_played,
                    started_at=game_start_time,
                    ended_at=game_end_time,
                    final_position=final_position,
                    total_players=len(active_players)
                )
                print(f"DEBUG: Game result recorded successfully for {player.username}")
                
            print(f"DEBUG: *** RECORDING GAME STATS COMPLETED ***")
                
        except Exception as e:
            print(f"ERROR: Failed to record game stats: {e}")
            logger.error(f"Failed to record game stats: {e}")

    async def _schedule_room_cleanup(self, room_id: str, delay: int = 60):
        await asyncio.sleep(delay)
        self.cleanup_empty_room(room_id)

    def handle_disconnect(self, room_id: str, player_id: str) -> Tuple[Optional[RoomDB], Optional[PlayerDB], bool]:
        room = self.get_room(room_id)
        if not room:
            return None, None, False
            
        player_leaving = self.db.query(PlayerDB).filter(PlayerDB.id == player_id).first()
        if not player_leaving:
            return room, None, False

        if getattr(player_leaving, 'is_viewer', False):
            self.db.delete(player_leaving)
            self.db.commit()
            return self.get_room(room_id), player_leaving, False

        if room.status in [RoomStatus.IN_PROGRESS, RoomStatus.COUNTDOWN]:
            active_players = [p for p in room.players if not getattr(p, 'is_viewer', False)]
            
            if room.game_mode.value == GameMode.CLASSIC.value and len(active_players) == 2:
                self.db.delete(player_leaving)
                self.db.commit()
                
                updated_room = self.get_room(room_id)
                if updated_room:
                    remaining_active = [p for p in updated_room.players if not p.is_viewer]
                    if len(remaining_active) == 1:
                        print(f"DEBUG: Classic game ending due to disconnect")
                        _, end_result = self.end_game(room_id)
                        return updated_room, player_leaving, True
            
            elif room.game_mode.value == GameMode.BATTLE_ROYALE.value:
                non_eliminated_players = [p for p in room.players if not getattr(p, 'is_viewer', False) and not getattr(p, 'is_eliminated', False)]
                
                if not getattr(player_leaving, 'is_eliminated', False):
                    self.db.delete(player_leaving)
                    self.db.commit()
                    
                    updated_room = self.get_room(room_id)
                    if updated_room:
                        remaining_non_eliminated = [p for p in updated_room.players if not getattr(p, 'is_viewer', False) and not getattr(p, 'is_eliminated', False)]
                        if len(remaining_non_eliminated) <= 1:
                            print(f"DEBUG: Battle royale game ending due to disconnect")
                            _, end_result = self.end_game(room_id)
                            return updated_room, player_leaving, True
        
        self.db.delete(player_leaving)
        self.db.commit()
        
        final_room_state = self.get_room(room_id)
        
        if final_room_state and (len(final_room_state.players) == 0 or getattr(final_room_state, 'status', None) == RoomStatus.FINISHED):
            if final_room_state.game_mode.value == GameMode.BATTLE_ROYALE.value and getattr(final_room_state, 'status', None) == RoomStatus.FINISHED:
                asyncio.create_task(self._schedule_room_cleanup(room_id, delay=300))
                return final_room_state, player_leaving, False
            else:
                self.cleanup_empty_room(room_id)
                return None, player_leaving, False
            
        return final_room_state, player_leaving, False

    def start_battle_royale_countdown(self, room: RoomDB) -> bool:
        if room.game_mode.value != GameMode.BATTLE_ROYALE.value:
            return False
            
        active_players = [p for p in room.players if not getattr(p, 'is_viewer', False)]
        if len(active_players) < getattr(room, 'min_players', 3):
            return False
            
        setattr(room, 'status', RoomStatus.COUNTDOWN)
        setattr(room, 'countdown_start_time', datetime.now())
        setattr(room, 'time_left', BATTLE_ROYALE_COUNTDOWN_SECONDS)
        
        self.db.commit()
        self.db.refresh(room)
        return True
    
    def get_battle_royale_leaderboard(self, room: RoomDB) -> List[dict]:
        active_players = [p for p in room.players if not getattr(p, 'is_viewer', False) and not getattr(p, 'is_eliminated', False)]
        eliminated_players = [p for p in room.players if not getattr(p, 'is_viewer', False) and getattr(p, 'is_eliminated', False)]

        active_sorted = sorted(active_players, key=lambda p: getattr(p, 'score', 0), reverse=True)
        eliminated_sorted = sorted(eliminated_players, key=lambda p: getattr(p, 'elimination_time', datetime.min), reverse=True)
        
        leaderboard = []
        
        for i, player in enumerate(active_sorted):
            leaderboard.append({
                "rank": i + 1,
                "username": player.username,
                "score": getattr(player, 'score', 0),
                "is_eliminated": False,
                "is_active": True
            })
        
        for i, player in enumerate(eliminated_sorted):
            elimination_time = getattr(player, 'elimination_time', None)
            leaderboard.append({
                "rank": len(active_sorted) + i + 1,
                "username": player.username,
                "score": getattr(player, 'score', 0),
                "is_eliminated": True,
                "is_active": False,
                "elimination_time": elimination_time.isoformat() if elimination_time else None
            })
            
        return leaderboard
    
    def eliminate_worst_players(self, room: RoomDB) -> List[PlayerDB]:
        if room.game_mode.value != GameMode.BATTLE_ROYALE.value:
            print(f"Not a battle royale room, skipping elimination")
            return []

        fresh_room = self.db.query(RoomDB).filter(RoomDB.id == room.id).first()
        if not fresh_room:
            print(f"Room not found, skipping elimination")
            return []
            
        fresh_players = self.db.query(PlayerDB).filter(PlayerDB.room_id == room.id).all()
        active_players = [p for p in fresh_players if not getattr(p, 'is_viewer', False) and not getattr(p, 'is_eliminated', False)]
        
        print(f"=== ELIMINATION DEBUG ===")
        print(f"Room ID: {room.id}")
        print(f"Active players count: {len(active_players)}, min surviving: {BATTLE_ROYALE_MIN_SURVIVING_PLAYERS}")

        if len(active_players) <= BATTLE_ROYALE_MIN_SURVIVING_PLAYERS:
            print(f"Not enough players to eliminate ({len(active_players)} <= {BATTLE_ROYALE_MIN_SURVIVING_PLAYERS})")
            return []

        fresh_scores = {}
        for player in active_players:
            db_score = self.db.query(PlayerDB.score).filter(PlayerDB.id == player.id).scalar()
            fresh_scores[player.id] = db_score or 0
            print(f"Player {player.username}: DB score = {fresh_scores[player.id]}")

        sorted_players = sorted(active_players, key=lambda p: fresh_scores.get(p.id, 0))
        print(f"Elimination order (lowest first): {[(p.username, fresh_scores.get(p.id, 0)) for p in sorted_players]}")
        
        players_per_elimination = getattr(fresh_room, 'players_per_elimination', 1)
        print(f"Players per elimination: {players_per_elimination}")
        
        remaining_after_elimination = len(active_players) - players_per_elimination
        if remaining_after_elimination < BATTLE_ROYALE_MIN_SURVIVING_PLAYERS:
            players_per_elimination = len(active_players) - BATTLE_ROYALE_MIN_SURVIVING_PLAYERS
            print(f"Adjusted to prevent over-elimination: {players_per_elimination}")

        players_to_eliminate = sorted_players[:players_per_elimination] if players_per_elimination > 0 else []
        print(f"Eliminating {len(players_to_eliminate)} players: {[(p.username, fresh_scores.get(p.id, 0)) for p in players_to_eliminate]}")
        
        for player in players_to_eliminate:
            setattr(player, 'is_eliminated', True)
            setattr(player, 'elimination_time', datetime.now())
            print(f"Eliminating player: {player.username} with DB score: {fresh_scores.get(player.id, 0)}")
        
        if players_to_eliminate:
            self.db.commit()
            print(f"Successfully eliminated {len(players_to_eliminate)} players")
            
        return players_to_eliminate
    
    def check_battle_royale_end_condition(self, room: RoomDB) -> bool:
        if room.game_mode.value != GameMode.BATTLE_ROYALE.value:
            return False
            
        active_players = [p for p in room.players if not getattr(p, 'is_viewer', False) and not getattr(p, 'is_eliminated', False)]

        time_left = getattr(room, 'time_left', 0)
        return len(active_players) <= BATTLE_ROYALE_MIN_SURVIVING_PLAYERS or time_left <= 0
    
    def get_next_elimination_info(self, room: RoomDB, current_elapsed_time: Optional[int] = None) -> dict:
        if room.game_mode.value != GameMode.BATTLE_ROYALE.value:
            return {}

        fresh_players = self.db.query(PlayerDB).filter(PlayerDB.room_id == room.id).all()
        active_players = [p for p in fresh_players if not getattr(p, 'is_viewer', False) and not getattr(p, 'is_eliminated', False)]
        
        if len(active_players) <= BATTLE_ROYALE_MIN_SURVIVING_PLAYERS:
            return {"next_elimination_time": 0, "next_elimination_player": None}
        
        fresh_scores = {}
        for player in active_players:
            db_score = self.db.query(PlayerDB.score).filter(PlayerDB.id == player.id).scalar()
            fresh_scores[player.id] = db_score or 0

        sorted_players = sorted(active_players, key=lambda p: fresh_scores.get(p.id, 0))
        next_elimination_player = sorted_players[0] if sorted_players else None

        fresh_room = self.db.query(RoomDB).filter(RoomDB.id == room.id).first()
        players_per_elimination = getattr(fresh_room, 'players_per_elimination', 1) if fresh_room else 1

        next_elimination_players = []
        if sorted_players and players_per_elimination > 0:
            remaining_after_elimination = len(active_players) - players_per_elimination
            if remaining_after_elimination < BATTLE_ROYALE_MIN_SURVIVING_PLAYERS:
                players_per_elimination = len(active_players) - BATTLE_ROYALE_MIN_SURVIVING_PLAYERS
            
            next_elimination_players = [getattr(p, 'username', 'Unknown') for p in sorted_players[:max(0, players_per_elimination)]]

        if current_elapsed_time and current_elapsed_time % 20 == 0:
            if len(next_elimination_players) > 1:
                print(f"Next elimination: {', '.join(next_elimination_players)} ({players_per_elimination} players)")
            else:
                print(f"Next elimination: {next_elimination_player.username if next_elimination_player else None} (score: {fresh_scores.get(next_elimination_player.id, 0) if next_elimination_player else 'N/A'})")
        
        elimination_interval = getattr(fresh_room, 'elimination_interval', 30) if fresh_room else 30
        
        if current_elapsed_time is not None:
            elapsed_time = current_elapsed_time
        else:
            game_start_time = getattr(fresh_room, 'game_start_time', None)
            if game_start_time:
                elapsed_time = (datetime.now() - game_start_time).total_seconds()
            else:
                elapsed_time = 0
        
        next_elimination_cycle = int(elapsed_time // elimination_interval) + 1
        next_elimination_time = next_elimination_cycle * elimination_interval
        time_until_elimination = next_elimination_time - elapsed_time
        
        return {
            "next_elimination_time": max(0, int(time_until_elimination)),
            "next_elimination_player": next_elimination_player.username if next_elimination_player else None,
            "next_elimination_players": next_elimination_players,
            "players_per_elimination": players_per_elimination
        }