"""
Tests for health check and monitoring endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import time

from app.main import app
# Use the `client` fixture from conftest for tests so the app is started
# with the test database. Individual test functions accept `client`.


class TestHealthEndpoints:
    """Test health check endpoints."""
    
    def test_health_check(self, client):
        """Test basic health check endpoint."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], int)
        assert data["uptime_seconds"] >= 0
    
    def test_readiness_check_healthy(self, client):
        """Test readiness check when all services are healthy."""
        response = client.get("/ready")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "ready"
        assert "timestamp" in data
        assert "checks" in data
        assert data["checks"]["database"] == "healthy"
    
    def test_readiness_check_database_unhealthy(self, client):
        """Test readiness check when database is unhealthy."""
        from app.database.session import get_db
        from sqlalchemy import text
        
        # Create a mock database session that raises exception
        def override_get_db():
            mock_db = MagicMock()
            mock_db.execute.side_effect = Exception("Database connection failed")
            yield mock_db
        
        # Override the dependency
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.get("/ready")
            
            assert response.status_code == 503
            data = response.json()
            
            assert data["status"] == "not_ready"
            assert "database connection failed" in data["checks"]["database"].lower()
        finally:
            # Clean up the override
            app.dependency_overrides.clear()
    
    def test_metrics_endpoint(self, client):
        """Test metrics endpoint."""
        response = client.get("/metrics")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check basic structure
        assert "timestamp" in data
        assert "uptime_seconds" in data
        assert "system" in data
        assert "database" in data
        
        # Check system metrics
        system = data["system"]
        assert "cpu_percent" in system
        assert "memory" in system
        assert "disk" in system
        
        # Check memory metrics
        memory = system["memory"]
        assert "total_mb" in memory
        assert "available_mb" in memory
        assert "percent_used" in memory
        assert 0 <= memory["percent_used"] <= 100
        
        # Check disk metrics
        disk = system["disk"]
        assert "total_gb" in disk
        assert "used_gb" in disk
        assert "percent_used" in disk
        assert 0 <= disk["percent_used"] <= 100


class TestRequestTiming:
    """Test request timing middleware."""
    
    def test_request_timing_header(self, client):
        """Test that X-Process-Time header is added."""
        response = client.get("/health")
        
        assert "X-Process-Time" in response.headers
        process_time = float(response.headers["X-Process-Time"])
        
        # Should be a reasonable time (< 1000ms for health check)
        assert 0 < process_time < 1000
    
    def test_timing_on_different_endpoints(self, client):
        """Test timing on various endpoints."""
        endpoints = ["/health", "/ready", "/metrics"]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert "X-Process-Time" in response.headers
            process_time = float(response.headers["X-Process-Time"])
            assert process_time > 0


class TestLogging:
    """Test structured logging functionality."""
    
    def test_logger_creation(self):
        """Test that loggers can be created."""
        from app.core.logging import get_logger, get_logger_with_context
        
        logger = get_logger("test")
        assert logger is not None
        assert logger.name == "app.test"
        
        # Test logger with context
        context_logger = get_logger_with_context("test", request_id="123")
        assert context_logger is not None
    
    def test_json_formatter(self):
        """Test JSON formatter."""
        import logging
        import json
        from app.core.logging import JSONFormatter
        
        formatter = JSONFormatter()
        record = logging.LogRecord(
            name="app.test",
            level=logging.INFO,
            pathname="test.py",
            lineno=1,
            msg="Test message",
            args=(),
            exc_info=None
        )
        
        formatted = formatter.format(record)
        
        # Should be valid JSON
        log_data = json.loads(formatted)
        
        assert log_data["level"] == "INFO"
        assert log_data["logger"] == "app.test"
        assert log_data["message"] == "Test message"
        assert "timestamp" in log_data
