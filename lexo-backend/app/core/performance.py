"""
Performance monitoring utilities
"""
from time import time
from functools import wraps
from typing import Callable, Any
import asyncio

from app.core.logging import get_logger

logger = get_logger(__name__)


def measure_time(func: Callable) -> Callable:
    """
    Decorator to measure function execution time
    
    Example:
        @measure_time
        def slow_function():
            time.sleep(1)
    """
    @wraps(func)
    async def async_wrapper(*args, **kwargs) -> Any:
        start_time = time()
        try:
            result = await func(*args, **kwargs)
            return result
        finally:
            duration = time() - start_time
            if duration > 1.0:  # Log slow operations (>1 second)
                logger.warning(
                    f"⚠️  SLOW OPERATION: {func.__name__} took {duration:.2f}s"
                )
            else:
                logger.debug(f"⏱️  {func.__name__} took {duration:.3f}s")
    
    @wraps(func)
    def sync_wrapper(*args, **kwargs) -> Any:
        start_time = time()
        try:
            result = func(*args, **kwargs)
            return result
        finally:
            duration = time() - start_time
            if duration > 1.0:  # Log slow operations (>1 second)
                logger.warning(
                    f"⚠️  SLOW OPERATION: {func.__name__} took {duration:.2f}s"
                )
            else:
                logger.debug(f"⏱️  {func.__name__} took {duration:.3f}s")
    
    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    return sync_wrapper


class PerformanceMonitor:
    """Context manager for monitoring code block performance"""
    
    def __init__(self, operation_name: str, threshold: float = 1.0):
        """
        Args:
            operation_name: Name of the operation being monitored
            threshold: Warning threshold in seconds (default: 1.0)
        """
        self.operation_name = operation_name
        self.threshold = threshold
        self.start_time = None
        self.duration = None
    
    def __enter__(self):
        self.start_time = time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.duration = time() - self.start_time
        
        if self.duration > self.threshold:
            logger.warning(
                f"⚠️  SLOW: {self.operation_name} took {self.duration:.2f}s"
            )
        else:
            logger.debug(
                f"⏱️  {self.operation_name} took {self.duration:.3f}s"
            )
        
        return False  # Don't suppress exceptions


class QueryCounter:
    """Track number of database queries in a code block"""
    
    def __init__(self, operation_name: str):
        self.operation_name = operation_name
        self.query_count = 0
    
    def __enter__(self):
        # This is a simplified version - you'd need to hook into SQLAlchemy
        # event system for accurate query counting
        self.query_count = 0
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.query_count > 10:
            logger.warning(
                f"⚠️  HIGH QUERY COUNT: {self.operation_name} executed "
                f"{self.query_count} queries (possible N+1 problem)"
            )
        return False


# Metrics collection
_metrics = {
    "requests_total": 0,
    "requests_slow": 0,
    "db_queries": 0,
}


def increment_metric(metric_name: str, amount: int = 1):
    """Increment a metric counter"""
    if metric_name in _metrics:
        _metrics[metric_name] += amount


def get_metrics() -> dict:
    """Get current metrics"""
    return _metrics.copy()


def reset_metrics():
    """Reset all metrics to zero"""
    for key in _metrics:
        _metrics[key] = 0
