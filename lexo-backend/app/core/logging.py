import logging
import sys
import json
from datetime import datetime
from typing import Optional, Any, Dict
from app.core.config import settings


class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.
    """
    
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        if hasattr(record, 'request_id'):
            log_data["request_id"] = record.request_id
        
        if hasattr(record, 'user_id'):
            log_data["user_id"] = record.user_id
        
        if hasattr(record, 'duration_ms'):
            log_data["duration_ms"] = record.duration_ms
        
        return json.dumps(log_data)


def setup_logging(log_level: Optional[str] = None) -> None:
    import os
    level = log_level or settings.log.level

    # Determine if we should use JSON formatting
    use_json = os.getenv("ENVIRONMENT", "development") == "production"
    
    if use_json:
        formatter = JSONFormatter()
    else:
        formatter = logging.Formatter(settings.log.format)
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        handlers=[handler]
    )

    logger = logging.getLogger('app')
    logger.setLevel(getattr(logging, level.upper()))

    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the given name.
    The logger will be prefixed with 'app.' automatically.
    """
    return logging.getLogger(f'app.{name}')


class LoggerAdapter(logging.LoggerAdapter):
    """
    Logger adapter for adding contextual information to logs.
    """
    
    def process(self, msg, kwargs):
        # Add extra context to the log record
        for key, value in self.extra.items():
            if 'extra' not in kwargs:
                kwargs['extra'] = {}
            kwargs['extra'][key] = value
        return msg, kwargs


def get_logger_with_context(name: str, **context) -> LoggerAdapter:
    """
    Get a logger with additional context that will be included in all log messages.
    
    Example:
        logger = get_logger_with_context('api', request_id='123', user_id='user_456')
        logger.info('Processing request')  # Will include request_id and user_id
    """
    logger = get_logger(name)
    return LoggerAdapter(logger, context)