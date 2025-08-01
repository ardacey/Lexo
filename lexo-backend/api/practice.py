from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from game.logic import generate_letter_pool, calculate_score, has_letters_in_pool
from game.word_list import is_word_valid
from typing import List, Dict, Any
from pydantic import BaseModel
import uuid
import time

router = APIRouter()

practice_sessions: Dict[str, Dict[str, Any]] = {}

class PracticeSession(BaseModel):
    session_id: str
    letter_pool: List[str]
    score: int
    words_found: List[str]
    time_started: float
    duration: int

class WordSubmission(BaseModel):
    word: str

class PracticeStartRequest(BaseModel):
    duration: int = 300

@router.post("/practice/start")
def start_practice_session(request: PracticeStartRequest, db: Session = Depends(get_db)):
    session_id = str(uuid.uuid4())
    
    letter_pool = generate_letter_pool(12)
    
    session = {
        "session_id": session_id,
        "letter_pool": letter_pool,
        "score": 0,
        "words_found": [],
        "used_words": set(),
        "time_started": time.time(),
        "duration": request.duration,
        "is_active": True
    }
    
    practice_sessions[session_id] = session
    
    return {
        "session_id": session_id,
        "letter_pool": letter_pool,
        "score": 0,
        "words_found": [],
        "time_remaining": request.duration
    }

@router.post("/practice/{session_id}/submit")
def submit_word(session_id: str, submission: WordSubmission, db: Session = Depends(get_db)):
    if session_id not in practice_sessions:
        raise HTTPException(status_code=404, detail="Practice session not found")
    
    session = practice_sessions[session_id]
    
    elapsed_time = time.time() - session["time_started"]
    if elapsed_time >= session["duration"]:
        session["is_active"] = False
        raise HTTPException(status_code=400, detail="Practice session has ended")
    
    if not session["is_active"]:
        raise HTTPException(status_code=400, detail="Practice session is not active")
    
    word = submission.word.lower().strip()
    
    if word in session["used_words"]:
        return {
            "success": False,
            "message": f'"{word}" has already been used in this session.',
            "score": session["score"],
            "letter_pool": session["letter_pool"],
            "time_remaining": max(0, session["duration"] - elapsed_time)
        }
    
    if not has_letters_in_pool(word, session["letter_pool"]):
        return {
            "success": False,
            "message": f'Not enough letters in the pool for "{word}".',
            "score": session["score"],
            "letter_pool": session["letter_pool"],
            "time_remaining": max(0, session["duration"] - elapsed_time)
        }
    
    if not is_word_valid(word):
        return {
            "success": False,
            "message": f'"{word}" is not a valid Turkish word.',
            "score": session["score"],
            "letter_pool": session["letter_pool"],
            "time_remaining": max(0, session["duration"] - elapsed_time)
        }
    
    word_score = calculate_score(word)
    session["score"] += word_score
    session["words_found"].append(word)
    session["used_words"].add(word)
    
    temp_pool = session["letter_pool"].copy()
    for letter in word:
        temp_pool.remove(letter)
    
    new_letters = generate_letter_pool(len(word))
    session["letter_pool"] = temp_pool + new_letters
    
    time_remaining = max(0, session["duration"] - elapsed_time)
    
    return {
        "success": True,
        "message": f'"{word}" is valid! +{word_score} points',
        "word": word,
        "word_score": word_score,
        "total_score": session["score"],
        "letter_pool": session["letter_pool"],
        "words_found": session["words_found"],
        "time_remaining": time_remaining
    }

@router.get("/practice/{session_id}/status")
def get_practice_status(session_id: str, db: Session = Depends(get_db)):
    if session_id not in practice_sessions:
        raise HTTPException(status_code=404, detail="Practice session not found")
    
    session = practice_sessions[session_id]
    elapsed_time = time.time() - session["time_started"]
    time_remaining = max(0, session["duration"] - elapsed_time)
    
    if elapsed_time >= session["duration"]:
        session["is_active"] = False
    
    return {
        "session_id": session_id,
        "letter_pool": session["letter_pool"],
        "score": session["score"],
        "words_found": session["words_found"],
        "time_remaining": time_remaining,
        "is_active": session["is_active"]
    }

@router.post("/practice/{session_id}/end")
def end_practice_session(session_id: str, db: Session = Depends(get_db)):
    if session_id not in practice_sessions:
        raise HTTPException(status_code=404, detail="Practice session not found")
    
    session = practice_sessions[session_id]
    session["is_active"] = False
    
    elapsed_time = time.time() - session["time_started"]
    actual_duration = min(elapsed_time, session["duration"])
    
    results = {
        "session_id": session_id,
        "final_score": session["score"],
        "words_found": session["words_found"],
        "total_words": len(session["words_found"]),
        "duration": actual_duration,
        "words_per_minute": len(session["words_found"]) / (actual_duration / 60) if actual_duration > 0 else 0
    }
    
    return results
