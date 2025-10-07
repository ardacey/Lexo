import logging
import sys
from typing import Optional
from app.core.config import settings


def setup_logging(log_level: Optional[str] = None) -> None:
    level = log_level or settings.log.level

    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format=settings.log.format,
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )

    logger = logging.getLogger('app')
    logger.setLevel(getattr(logging, level.upper()))

    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f'app.{name}')