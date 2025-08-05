import time
import logging
from typing import Dict, Optional
from collections import defaultdict
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, list] = defaultdict(list)
    
    def is_allowed(self, identifier: str) -> bool:
        now = time.time()
        window_start = now - self.window_seconds
        
        self.requests[identifier] = [
            req_time for req_time in self.requests[identifier] 
            if req_time > window_start
        ]
        
        if len(self.requests[identifier]) >= self.max_requests:
            return False
        
        self.requests[identifier].append(now)
        return True
    
    def get_reset_time(self, identifier: str) -> int:
        if not self.requests[identifier]:
            return 0
        
        oldest_request = min(self.requests[identifier])
        reset_time = oldest_request + self.window_seconds
        return max(0, int(reset_time - time.time()))

general_limiter = RateLimiter(max_requests=100, window_seconds=60)
auth_limiter = RateLimiter(max_requests=30, window_seconds=60)  # Increased from 10 to 30
websocket_limiter = RateLimiter(max_requests=50, window_seconds=60)

def get_client_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    real_ip = request.headers.get("X-Real-IP")
    
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    elif real_ip:
        client_ip = real_ip.strip()
    else:
        client_ip = request.client.host if request.client else "unknown"
    
    user_agent = request.headers.get("User-Agent", "unknown")
    try:
        user_agent_hash = hash(user_agent)
    except Exception:
        user_agent_hash = hash("unknown")
    
    return f"{client_ip}:{user_agent_hash}"

async def rate_limit_middleware(request: Request, call_next):
    identifier = get_client_identifier(request)
    
    if request.url.path == "/api/auth/login":
        limiter = RateLimiter(max_requests=15, window_seconds=60)
    elif request.url.path in ["/api/auth/register", "/api/auth/refresh"]:
        limiter = RateLimiter(max_requests=20, window_seconds=60)
    elif request.url.path.startswith("/api/auth"):
        limiter = auth_limiter
    elif request.url.path.startswith("/api/ws"):
        limiter = websocket_limiter
    else:
        limiter = general_limiter
    
    if not limiter.is_allowed(identifier):
        reset_time = limiter.get_reset_time(identifier)
        logger.warning(f"Rate limit exceeded for {identifier} on {request.url.path}")
        
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "retry_after": reset_time,
                "message": f"Too many requests. Please try again in {reset_time} seconds."
            },
            headers={
                "Retry-After": str(reset_time),
                "X-RateLimit-Limit": str(limiter.max_requests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time()) + reset_time)
            }
        )
    
    response = await call_next(request)
    
    remaining = limiter.max_requests - len(limiter.requests[identifier])
    reset_time = limiter.get_reset_time(identifier)
    
    response.headers["X-RateLimit-Limit"] = str(limiter.max_requests)
    response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
    response.headers["X-RateLimit-Reset"] = str(int(time.time()) + reset_time)
    
    return response

class WordSubmissionLimiter:
    def __init__(self, max_words_per_minute: int = 30):
        self.max_words_per_minute = max_words_per_minute
        self.submissions: Dict[str, list] = defaultdict(list)
    
    def can_submit_word(self, player_id: str) -> bool:
        now = time.time()
        minute_ago = now - 60
        
        self.submissions[player_id] = [
            submit_time for submit_time in self.submissions[player_id] 
            if submit_time > minute_ago
        ]
        
        if len(self.submissions[player_id]) >= self.max_words_per_minute:
            return False
        
        self.submissions[player_id].append(now)
        return True

word_submission_limiter = WordSubmissionLimiter()
