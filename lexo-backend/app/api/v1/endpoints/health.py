import time
from datetime import datetime

import psutil
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.database.session import engine, get_db

router = APIRouter()

APP_START_TIME = time.time()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": int(time.time() - APP_START_TIME),
    }


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(db: AsyncSession = Depends(get_db)):
    checks: dict = {"database": "unknown", "redis": "unknown"}

    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {e}"

    try:
        redis = get_redis()
        await redis.ping()
        checks["redis"] = "healthy"
    except Exception as e:
        checks["redis"] = f"unhealthy: {e}"

    is_ready = all(v == "healthy" for v in checks.values())
    return JSONResponse(
        status_code=status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "ready" if is_ready else "not_ready",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": checks,
        },
    )


@router.get("/debug/metrics", status_code=status.HTTP_200_OK, include_in_schema=False)
async def debug_metrics():
    """Internal JSON metrics — for debugging. Prometheus metrics live at /metrics."""
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    pool = engine.pool
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": int(time.time() - APP_START_TIME),
        "system": {
            "cpu_percent": cpu_percent,
            "memory": {
                "total_mb": round(memory.total / 1_048_576, 1),
                "available_mb": round(memory.available / 1_048_576, 1),
                "percent_used": memory.percent,
            },
            "disk": {
                "total_gb": round(disk.total / 1_073_741_824, 2),
                "used_gb": round(disk.used / 1_073_741_824, 2),
                "percent_used": disk.percent,
            },
        },
        "database": {
            "pool_size": pool.size(),
            "checked_out_connections": pool.checkedout(),
        },
    }
