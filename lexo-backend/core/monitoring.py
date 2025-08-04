import time
import logging
from typing import Dict, Any, Optional
from functools import wraps
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)

class PerformanceMonitor:
    def __init__(self):
        self.metrics: Dict[str, Any] = defaultdict(list)
        self.counters: Dict[str, int] = defaultdict(int)
    
    def record_timing(self, operation: str, duration: float):
        self.metrics[f"{operation}_timing"].append(duration)
        self.counters[f"{operation}_count"] += 1
    
    def increment_counter(self, metric: str):
        self.counters[metric] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        stats = {}
        
        for key, timings in self.metrics.items():
            if timings and key.endswith('_timing'):
                operation = key.replace('_timing', '')
                stats[f"{operation}_avg_ms"] = sum(timings) / len(timings) * 1000
                stats[f"{operation}_max_ms"] = max(timings) * 1000
                stats[f"{operation}_min_ms"] = min(timings) * 1000
                stats[f"{operation}_count"] = len(timings)
        
        stats.update(self.counters)
        
        return stats

monitor = PerformanceMonitor()

def timing_decorator(operation_name: str):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                monitor.record_timing(operation_name, duration)
                
                if duration > 1.0:
                    logger.warning(f"Slow operation {operation_name}: {duration:.2f}s")
        return wrapper
    return decorator

def get_system_metrics() -> Dict[str, Any]:
    try:
        import psutil
        return {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "disk_usage_percent": psutil.disk_usage('/').percent
        }
    except ImportError:
        return {"error": "psutil not available"}

class RequestMetrics:
    def __init__(self):
        self.active_requests = 0
        self.total_requests = 0
        self.error_count = 0
    
    def start_request(self):
        self.active_requests += 1
        self.total_requests += 1
    
    def end_request(self, success: bool = True):
        self.active_requests = max(0, self.active_requests - 1)
        if not success:
            self.error_count += 1
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            "active_requests": self.active_requests,
            "total_requests": self.total_requests,
            "error_count": self.error_count,
            "error_rate": self.error_count / max(1, self.total_requests)
        }

request_metrics = RequestMetrics()
