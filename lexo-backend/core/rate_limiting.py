import time
import logging
from typing import Dict, Optional, Union, List
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
auth_limiter = RateLimiter(max_requests=30, window_seconds=60)
websocket_limiter = RateLimiter(max_requests=100, window_seconds=60)
room_creation_limiter = RateLimiter(max_requests=5, window_seconds=60)
lobby_limiter = RateLimiter(max_requests=30, window_seconds=60)

def get_client_identifier(request: Request, user_id: Optional[str] = None) -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    real_ip = request.headers.get("X-Real-IP")
    
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    elif real_ip:
        client_ip = real_ip.strip()
    else:
        client_ip = request.client.host if request.client else "unknown"
    
    if user_id:
        return f"user:{user_id}:ip:{client_ip}"
    
    user_agent = request.headers.get("User-Agent", "unknown")
    try:
        user_agent_hash = hash(user_agent)
    except Exception:
        user_agent_hash = hash("unknown")
    
    return f"ip:{client_ip}:ua:{user_agent_hash}"

async def rate_limit_middleware(request: Request, call_next):
    user_agent = request.headers.get("User-Agent", "")
    if not security_limiter.validate_user_agent(user_agent):
        logger.warning(f"Invalid or suspicious User-Agent: {user_agent}")
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Invalid client"}
        )
    
    user_id = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        try:
            from jose import jwt
            from auth.utils import SECRET_KEY, ALGORITHM
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
        except Exception:
            pass
    
    identifier = get_client_identifier(request, user_id)
    
    if security_limiter.is_suspicious_pattern(identifier):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"error": "Suspicious activity detected", "retry_after": 300}
        )
    
    if request.url.path == "/api/rooms" and request.method == "POST":
        limiter = room_creation_limiter
    elif request.url.path == "/api/rooms" and request.method == "GET":
        limiter = lobby_limiter
    elif request.url.path.startswith("/api/rooms/") and "/join" in request.url.path:
        limiter = lobby_limiter
    elif request.url.path == "/api/auth/login":
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
        limit_type = "room_creation" if limiter == room_creation_limiter else "general"
        
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

class SecurityLimiter:
    def __init__(self):
        self.suspicious_ips: Dict[str, float] = {}
        self.request_patterns: Dict[str, List[float]] = defaultdict(list)
        
    def is_suspicious_pattern(self, identifier: str) -> bool:
        now = time.time()

        if identifier in self.suspicious_ips:
            if now < self.suspicious_ips[identifier]:
                return True
            else:
                del self.suspicious_ips[identifier]
        
        recent_requests = [req for req in self.request_patterns[identifier] if req > now - 10]
        self.request_patterns[identifier] = recent_requests
        if len(recent_requests) > 10:
            self.suspicious_ips[identifier] = now + 300
            logger.warning(f"Suspicious pattern detected for {identifier}, banned for 5 minutes")
            return True
            
        self.request_patterns[identifier].append(now)
        return False
    
    def validate_user_agent(self, user_agent: str) -> bool:
        if not user_agent or user_agent in ["unknown", ""]:
            return False

        bot_patterns = ["bot", "crawler", "spider", "scraper", "curl", "wget", "python-requests"]
        user_agent_lower = user_agent.lower()
        
        for pattern in bot_patterns:
            if pattern in user_agent_lower:
                return False
                
        return True

security_limiter = SecurityLimiter()
