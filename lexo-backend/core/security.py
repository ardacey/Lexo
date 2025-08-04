from fastapi import Request
from fastapi.responses import Response
import secrets
import time
from typing import Dict

class SecurityHeaders:

    @staticmethod
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "font-src 'self'; "
            "img-src 'self' data:; "
            "connect-src 'self' ws: wss:; "
            "object-src 'none'; "
            "base-uri 'self'"
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response

class CSRFProtection:
    
    def __init__(self):
        self.tokens: Dict[str, float] = {}
        self.token_lifetime = 3600
    
    def generate_token(self) -> str:
        token = secrets.token_urlsafe(32)
        self.tokens[token] = time.time()
        return token
    
    def validate_token(self, token: str) -> bool:
        if token not in self.tokens:
            return False

        if time.time() - self.tokens[token] > self.token_lifetime:
            del self.tokens[token]
            return False
        
        return True
    
    def cleanup_expired_tokens(self):
        current_time = time.time()
        expired_tokens = [
            token for token, created_time in self.tokens.items()
            if current_time - created_time > self.token_lifetime
        ]
        for token in expired_tokens:
            del self.tokens[token]

csrf_protection = CSRFProtection()
