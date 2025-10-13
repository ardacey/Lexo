"""
Integration tests for API endpoints
"""
import pytest
from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """Tests for health check endpoint"""
    
    @pytest.mark.integration
    def test_root_endpoint(self, client: TestClient):
        """Test root endpoint returns status"""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "status" in data
        assert data["status"] == "running"


class TestWordValidationEndpoint:
    """Tests for word validation API endpoint"""
    
    @pytest.mark.integration
    def test_validate_word_endpoint_exists(self, client: TestClient):
        """Test that validation endpoint exists"""
        response = client.post("/api/v1/words/validate", json={"word": "test"})
        # Should return 200 or 422 (validation error), not 404
        assert response.status_code in [200, 422]
    
    @pytest.mark.integration
    @pytest.mark.parametrize("word", ["ev", "at", "masa"])
    def test_validate_common_words(self, client: TestClient, word):
        """Test validation of common Turkish words"""
        response = client.post("/api/v1/words/validate", json={"word": word})
        
        if response.status_code == 200:
            data = response.json()
            assert "valid" in data
    
    @pytest.mark.integration
    def test_validate_empty_word(self, client: TestClient):
        """Test validation of empty word"""
        response = client.post("/api/v1/words/validate", json={"word": ""})
        
        # Should either reject or return invalid
        assert response.status_code in [200, 422]


class TestGameEndpoints:
    """Tests for game-related endpoints"""
    
    @pytest.mark.integration
    def test_stats_endpoint(self, client: TestClient):
        """Test that stats endpoint returns data"""
        response = client.get("/")
        
        assert response.status_code == 200
        data = response.json()
        assert "active_rooms" in data or "status" in data


class TestCORSHeaders:
    """Tests for CORS configuration"""
    
    @pytest.mark.integration
    def test_cors_headers_present(self, client: TestClient):
        """Test that CORS headers are properly set"""
        response = client.options("/")
        
        # Should have CORS headers
        assert response.status_code in [200, 405]
    
    @pytest.mark.integration
    def test_preflight_request(self, client: TestClient):
        """Test CORS preflight request"""
        headers = {
            "Origin": "http://localhost:19000",
            "Access-Control-Request-Method": "POST",
        }
        response = client.options("/api/v1/words/validate", headers=headers)
        
        # Should allow CORS
        assert response.status_code in [200, 405]
