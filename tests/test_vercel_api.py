# -*- coding: utf-8 -*-
"""
Tests for EcoSort Vercel Serverless Function API (api/index.py)
"""
import io
import base64
import pytest
from api.index import app as vercel_app

@pytest.fixture
def vercel_client():
    vercel_app.config['TESTING'] = True
    with vercel_app.test_client() as client:
        yield client

def test_vercel_health_endpoint(vercel_client):
    res = vercel_client.get('/health')
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'healthy'
    assert 'classes' in data
    assert len(data['classes']) == 6

def test_vercel_predict_valid_multipart(vercel_client, sample_jpeg_bytes):
    data = {
        'file': (io.BytesIO(sample_jpeg_bytes), 'waste_test.jpg')
    }
    res = vercel_client.post('/predict', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    body = res.get_json()
    assert body['status'] == 'success'
    assert body['decision'] in ('confident', 'uncertain', 'rejected')
    assert 'class_name' in body
    assert 'confidence' in body
    assert 'top_k' in body
    assert len(body['top_k']) == 3
    assert 'co2_saved_grams' in body
    assert 'target_bin' in body
    assert 'guide' in body

def test_vercel_predict_valid_base64_json(vercel_client, sample_jpeg_bytes):
    b64 = base64.b64encode(sample_jpeg_bytes).decode('utf-8')
    payload = {'image': f'data:image/jpeg;base64,{b64}'}
    res = vercel_client.post('/predict', json=payload)
    assert res.status_code == 200
    body = res.get_json()
    assert body['status'] == 'success'
    assert 'class_name' in body

def test_vercel_predict_empty_request_400(vercel_client):
    res = vercel_client.post('/predict', data={})
    assert res.status_code == 400
    body = res.get_json()
    assert body['status'] == 'error'

def test_vercel_predict_corrupt_file_400(vercel_client):
    data = {
        'file': (io.BytesIO(b'Not an image at all'), 'corrupt.txt')
    }
    res = vercel_client.post('/predict', data=data, content_type='multipart/form-data')
    assert res.status_code == 400
    body = res.get_json()
    assert body['status'] == 'error'

def test_vercel_security_headers(vercel_client):
    res = vercel_client.get('/health')
    assert res.headers.get('X-Content-Type-Options') == 'nosniff'
    assert res.headers.get('X-Frame-Options') == 'SAMEORIGIN'
    assert res.headers.get('Referrer-Policy') == 'strict-origin-when-cross-origin'


def test_vercel_startup_error_forces_500_and_no_leak():
    """Forces a startup error in api.index and asserts no Traceback or sys_path appears in response."""
    import json
    import sys
    from unittest.mock import patch
    from werkzeug.test import Client
    from werkzeug.wrappers import Response

    with patch.dict(sys.modules):
        sys.modules.pop("api.index", None)
        with patch("flask.Flask", side_effect=RuntimeError("Simulated critical startup error")):
            import api.index as error_module
            assert error_module.STARTUP_ERROR is not None

            client = Client(error_module.app, Response)
            resp = client.get("/health")
            assert resp.status_code == 500

            text = resp.get_data(as_text=True)
            assert "Traceback" not in text
            assert "sys_path" not in text
            assert "python_version" not in text
            assert "Simulated critical startup error" not in text

            payload = json.loads(text)
            assert payload == {
                "status": "error",
                "message": "Service temporarily unavailable"
            }

