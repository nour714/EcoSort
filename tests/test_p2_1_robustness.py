# -*- coding: utf-8 -*-
"""
Tests for P2-1: Robustness, Error Sanitization, DecompressionBombError, and Rate Limiting.
"""

import io
from unittest.mock import patch
from PIL import Image
import pytest
from ecosort.preprocess import load_image, InvalidImageError
from ecosort.rate_limiter import RateLimiter
from app import app as flask_app
from api.index import flask_app as vercel_app


def test_decompression_bomb_error_caught_as_invalid_image():
    """Verify PIL.Image.DecompressionBombError is caught and raised as InvalidImageError."""
    # Create a small valid test image in bytes
    img = Image.new("RGB", (64, 64), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    original_max = Image.MAX_IMAGE_PIXELS
    try:
        # Set limit lower than 64*64=4096 pixels to trigger decompression bomb check
        Image.MAX_IMAGE_PIXELS = 100
        with pytest.raises(InvalidImageError) as exc_info:
            load_image(raw_bytes)
        assert "Decompression Bomb" in str(exc_info.value)
    finally:
        Image.MAX_IMAGE_PIXELS = original_max


def test_endpoint_returns_400_on_decompression_bomb():
    """Verify /predict returns 400 when decompression bomb is submitted."""
    img = Image.new("RGB", (64, 64), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    client = flask_app.test_client()
    original_max = Image.MAX_IMAGE_PIXELS
    try:
        Image.MAX_IMAGE_PIXELS = 100
        data = {"file": (io.BytesIO(raw_bytes), "bomb.png")}
        resp = client.post("/predict", data=data, content_type="multipart/form-data")
        assert resp.status_code == 400
        data = resp.get_json()
        assert data["status"] == "error"
        assert "Decompression Bomb" in data["message"]
    finally:
        Image.MAX_IMAGE_PIXELS = original_max


def test_never_return_str_exception_to_clients_in_flask():
    """Verify app.py /predict never leaks str(exception) or internal trace details."""
    client = flask_app.test_client()

    # 1. Invalid Base64
    resp = client.post("/predict", json={"image": "not-valid-base64-content!@#$%"})
    assert resp.status_code == 400
    json_data = resp.get_json()
    assert json_data["status"] == "error"
    assert "binascii" not in json_data["message"]
    assert "Traceback" not in json_data["message"]

    # 2. Mocked internal exception with sensitive leak
    sensitive_leak = "FATAL: secret_db_password_123 failed at /etc/shadow"
    img = Image.new("RGB", (64, 64), color=(50, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    with patch("app.engine.predict", side_effect=Exception(sensitive_leak)):
        data = {"file": (io.BytesIO(raw_bytes), "sample.png")}
        resp = client.post("/predict", data=data, content_type="multipart/form-data")
        assert resp.status_code == 500
        json_data = resp.get_json()
        assert sensitive_leak not in json_data["message"]
        assert "حدث خطأ" in json_data["message"]

    # 3. Mocked RuntimeError
    with patch("app.engine.predict", side_effect=RuntimeError("internal engine stack overflow")):
        data = {"file": (io.BytesIO(raw_bytes), "sample.png")}
        resp = client.post("/predict", data=data, content_type="multipart/form-data")
        assert resp.status_code == 503
        json_data = resp.get_json()
        assert "stack overflow" not in json_data["message"]


def test_never_return_str_exception_to_clients_in_vercel_api():
    """Verify api/index.py /predict never leaks str(exception) or internal trace details."""
    client = vercel_app.test_client()

    # 1. Invalid Base64
    resp = client.post("/predict", json={"image": "invalid_base64_%%%!!"})
    assert resp.status_code == 400
    json_data = resp.get_json()
    assert json_data["status"] == "error"
    assert "binascii" not in json_data["message"]

    # 2. Mocked internal exception
    sensitive_leak = "CRITICAL: internal AWS key leaked AKIAIOSFODNN7EXAMPLE"
    img = Image.new("RGB", (64, 64), color=(50, 50, 50))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    from api.index import engine
    with patch.object(engine, "predict", side_effect=Exception(sensitive_leak)):
        data = {"file": (io.BytesIO(raw_bytes), "sample.png")}
        resp = client.post("/predict", data=data, content_type="multipart/form-data")
        assert resp.status_code == 500
        json_data = resp.get_json()
        assert sensitive_leak not in json_data["message"]


def test_rate_limiter_unit_and_integration():
    """Verify RateLimiter blocks requests exceeding threshold and returns 429."""
    limiter = RateLimiter(max_requests=3, window_seconds=10)
    ip = "192.168.1.100"

    allowed, _ = limiter.is_allowed(ip)
    assert allowed is True
    allowed, _ = limiter.is_allowed(ip)
    assert allowed is True
    allowed, _ = limiter.is_allowed(ip)
    assert allowed is True

    # 4th request must be rejected
    allowed, retry_after = limiter.is_allowed(ip)
    assert allowed is False
    assert retry_after > 0

    # Different IP is still allowed
    allowed_other, _ = limiter.is_allowed("192.168.1.200")
    assert allowed_other is True

    # Integration test with Flask client
    from app import rate_limiter as app_limiter
    app_limiter.reset()

    client = flask_app.test_client()
    # Mock rate_limiter to max 2 requests
    with patch.object(app_limiter, "max_requests", 2):
        resp1 = client.post("/predict", json={"image": "not_real"})
        assert resp1.status_code in (400, 429)

        resp2 = client.post("/predict", json={"image": "not_real"})
        assert resp2.status_code in (400, 429)

        # 3rd request should hit rate limit
        resp3 = client.post("/predict", json={"image": "not_real"})
        assert resp3.status_code == 429
        data = resp3.get_json()
        assert data["status"] == "error"
        assert "معدل الطلبات" in data["message"]
        assert "Retry-After" in resp3.headers

    app_limiter.reset()


def test_request_entity_too_large_413():
    """Verify Flask returns a 413 response when MAX_CONTENT_LENGTH is exceeded."""
    client = flask_app.test_client()
    # Temporarily set MAX_CONTENT_LENGTH to 500 bytes for this test
    with patch.dict(flask_app.config, {"MAX_CONTENT_LENGTH": 500}):
        huge_payload = b"X" * 1000
        data = {"file": (io.BytesIO(huge_payload), "large.jpg")}
        resp = client.post("/predict", data=data, content_type="multipart/form-data")
        assert resp.status_code == 413
        json_data = resp.get_json()
        assert json_data["status"] == "error"
        assert "4 ميجابايت" in json_data["message"]


def test_get_client_ip_prefers_trusted_headers():
    """Verify rate_limiter.get_client_ip prefers Vercel edge headers over user X-Forwarded-For."""
    from ecosort.rate_limiter import get_client_ip

    class DummyRequest:
        def __init__(self, headers, remote_addr="127.0.0.1"):
            self.headers = headers
            self.remote_addr = remote_addr

    # 1. x-real-ip preferred over x-forwarded-for
    req1 = DummyRequest({"X-Real-IP": "198.51.100.1", "X-Forwarded-For": "203.0.113.195, 10.0.0.1"})
    assert get_client_ip(req1) == "198.51.100.1"

    # 2. x-vercel-forwarded-for preferred over x-forwarded-for
    req2 = DummyRequest({"X-Vercel-Forwarded-For": "198.51.100.2", "X-Forwarded-For": "203.0.113.195"})
    assert get_client_ip(req2) == "198.51.100.2"

    # 3. Fallback to first x-forwarded-for
    req3 = DummyRequest({"X-Forwarded-For": "203.0.113.50, 10.0.0.1"})
    assert get_client_ip(req3) == "203.0.113.50"

    # 4. Fallback to remote_addr
    req4 = DummyRequest({}, remote_addr="192.168.1.5")
    assert get_client_ip(req4) == "192.168.1.5"


def test_vercel_path_fixer_trusts_only_vercel_headers():
    """Verify VercelPathFixer trusts only Vercel headers and ignores spoofable rewrite headers."""
    from api.index import VercelPathFixer

    def dummy_app(environ, start_response):
        return [b"OK"]

    fixer = VercelPathFixer(dummy_app)

    # Trust x-vercel-matched-path
    env1 = {"PATH_INFO": "/api", "HTTP_X_VERCEL_MATCHED_PATH": "/predict?foo=bar"}
    fixer(env1, None)
    assert env1["PATH_INFO"] == "/predict"

    # Trust x-matched-path
    env2 = {"PATH_INFO": "/api", "HTTP_X_MATCHED_PATH": "/health"}
    fixer(env2, None)
    assert env2["PATH_INFO"] == "/health"

    # Do NOT trust x-forwarded-path
    env3 = {"PATH_INFO": "/api", "HTTP_X_FORWARDED_PATH": "/admin-secret"}
    fixer(env3, None)
    assert env3["PATH_INFO"] == "/api"

    # Do NOT trust x-rewrite-url
    env4 = {"PATH_INFO": "/api", "HTTP_X_REWRITE_URL": "/admin-secret"}
    fixer(env4, None)
    assert env4["PATH_INFO"] == "/api"
