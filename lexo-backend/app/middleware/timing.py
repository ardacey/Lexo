"""
Request timing and performance monitoring middleware.
"""
import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger("app.middleware.timing")


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to measure and log request processing time.
    """
    
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        process_time_ms = round(process_time * 1000, 2)
        
        # Add header
        response.headers["X-Process-Time"] = str(process_time_ms)
        
        # Log slow requests (> 1 second)
        if process_time > 1.0:
            logger.warning(
                f"Slow request: {request.method} {request.url.path} "
                f"took {process_time_ms}ms"
            )
        
        # Log all requests in debug mode
        logger.debug(
            f"{request.method} {request.url.path} "
            f"- Status: {response.status_code} "
            f"- Time: {process_time_ms}ms"
        )
        
        return response
