# -*- coding: utf-8 -*-
import io
import base64

def test_health_endpoint(client):
    res = client.get('/health')
    assert res.status_code == 200
    data = res.get_json()
    assert data['status'] == 'healthy'
    assert data['model_loaded'] is True
    assert 'classes' in data
    assert len(data['classes']) == 6

def test_predict_valid_multipart(client, sample_jpeg_bytes):
    data = {
        'file': (io.BytesIO(sample_jpeg_bytes), 'waste_test.jpg')
    }
    res = client.post('/predict', data=data, content_type='multipart/form-data')
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

def test_predict_valid_base64_json(client, sample_jpeg_bytes):
    b64 = base64.b64encode(sample_jpeg_bytes).decode('utf-8')
    payload = {'image': f'data:image/jpeg;base64,{b64}'}
    res = client.post('/predict', json=payload)
    assert res.status_code == 200
    body = res.get_json()
    assert body['status'] == 'success'
    assert 'class_name' in body

def test_predict_transparent_png(client, sample_rgba_bytes):
    data = {
        'image': (io.BytesIO(sample_rgba_bytes), 'transparent.png')
    }
    res = client.post('/predict', data=data, content_type='multipart/form-data')
    assert res.status_code == 200
    body = res.get_json()
    assert body['status'] == 'success'

def test_predict_empty_request_400(client):
    res = client.post('/predict', data={})
    assert res.status_code == 400
    body = res.get_json()
    assert body['status'] == 'error'

def test_predict_corrupt_file_400(client):
    data = {
        'file': (io.BytesIO(b'Not an image at all'), 'corrupt.txt')
    }
    res = client.post('/predict', data=data, content_type='multipart/form-data')
    assert res.status_code == 400
    body = res.get_json()
    assert body['status'] == 'error'

def test_security_headers(client):
    res = client.get('/health')
    assert res.headers.get('X-Content-Type-Options') == 'nosniff'
    assert res.headers.get('X-Frame-Options') == 'SAMEORIGIN'
    assert res.headers.get('Referrer-Policy') == 'strict-origin-when-cross-origin'
    assert res.headers.get('Permissions-Policy') == 'camera=(self), geolocation=(), microphone=()'

def test_robots_and_sitemap(client):
    res_robots = client.get('/robots.txt')
    assert res_robots.status_code == 200
    assert b'User-agent' in res_robots.data

    res_sitemap = client.get('/sitemap.xml')
    assert res_sitemap.status_code == 200
    assert b'urlset' in res_sitemap.data

