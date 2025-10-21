"""
Health check and monitoring endpoints.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
import psutil
import time

from app.database.session import get_db

router = APIRouter()

# Store application start time
APP_START_TIME = time.time()


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """
    Basic health check endpoint.
    Returns OK if the service is running.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": int(time.time() - APP_START_TIME)
    }


@router.get("/ready", status_code=status.HTTP_200_OK)
async def readiness_check(db: Session = Depends(get_db)):
    """
    Readiness check endpoint.
    Verifies that all critical dependencies are available.
    """
    checks = {
        "database": "unknown",
    }
    
    # Check database connection
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = f"unhealthy: {str(e)}"
    
    
    # Determine overall status
    is_ready = checks["database"] == "healthy"
    response_status = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE
    
    return JSONResponse(
        status_code=response_status,
        content={
            "status": "ready" if is_ready else "not_ready",
            "timestamp": datetime.utcnow().isoformat(),
            "checks": checks
        }
    )


@router.get("/metrics", status_code=status.HTTP_200_OK)
async def metrics(db: Session = Depends(get_db)):
    """
    Application metrics endpoint.
    Returns system and application metrics.
    """
    # System metrics
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Database metrics
    db_pool_size = 0
    db_pool_checked_out = 0
    try:
        if hasattr(db.get_bind(), 'pool'):
            pool = db.get_bind().pool
            db_pool_size = pool.size()
            db_pool_checked_out = pool.checkedout()
    except:
        pass
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "uptime_seconds": int(time.time() - APP_START_TIME),
        "system": {
            "cpu_percent": cpu_percent,
            "memory": {
                "total_mb": memory.total / (1024 * 1024),
                "available_mb": memory.available / (1024 * 1024),
                "percent_used": memory.percent
            },
            "disk": {
                "total_gb": disk.total / (1024 * 1024 * 1024),
                "used_gb": disk.used / (1024 * 1024 * 1024),
                "percent_used": disk.percent
            }
        },
        "database": {
            "pool_size": db_pool_size,
            "checked_out_connections": db_pool_checked_out
        }
    }
