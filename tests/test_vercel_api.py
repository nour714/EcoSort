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

