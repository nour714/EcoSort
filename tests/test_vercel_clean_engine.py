# -*- coding: utf-8 -*-
"""
Test verifying that Vercel serverless engine runs real LiteRT neural inference
without fallback/calibrated heuristics and achieves >= 75% accuracy on the
fixed 60-image benchmark subset.
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.index import engine, flask_app


def test_vercel_engine_interpreter_loaded():
    """Ensure engine.interpreter is loaded with real TFLite/LiteRT model."""
    assert engine.interpreter is not None, "engine.interpreter must not be None in production"


def test_vercel_engine_benchmark_subset_accuracy():
    """Verify >=75% accuracy on fixed 60-image subset of data/benchmark."""
    assert engine.interpreter is not None
    benchmark_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'benchmark')
    if not os.path.isdir(benchmark_dir):
        pytest.skip("data/benchmark directory not found")

    classes = ['cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash']
    correct = 0
    total = 0

    for cls in classes:
        cls_dir = os.path.join(benchmark_dir, cls)
        if not os.path.isdir(cls_dir):
            continue
        files = sorted([f for f in os.listdir(cls_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])[:10]
        for f in files:
            img_path = os.path.join(cls_dir, f)
            with open(img_path, 'rb') as fp:
                img_bytes = fp.read()
            res = engine.predict(img_bytes)
            assert res['status'] == 'success'
            # Must NEVER use fake calibrated engine
            assert res['model_version'] != '2.0.0 (Calibrated Edge Engine)'
            assert 'LiteRT' in res['model_version']
            if res['class_name'] == cls:
                correct += 1
            total += 1

    assert total == 60, f"Expected 60 benchmark images (10 per class), found {total}"
    accuracy = (correct / total) * 100.0
    print(f"\nVercel LiteRT engine accuracy on 60 samples: {accuracy:.2f}% ({correct}/{total})")
    assert accuracy >= 75.0, f"Expected >= 75.0% accuracy, got {accuracy:.2f}%"


def test_vercel_health_and_unavailable_fallback():
    """Verify health endpoint computes model_loaded and predict returns 503 when model is unavailable."""
    flask_app.config['TESTING'] = True
    with flask_app.test_client() as client:
        # Standard health check
        res = client.get('/health')
        assert res.status_code == 200
        data = res.get_json()
        assert data['model_loaded'] is True

        # Simulate unavailable interpreter
        original_interp = engine.interpreter
        try:
            engine.interpreter = None
            h_res = client.get('/health')
            assert h_res.status_code == 200
            assert h_res.get_json()['model_loaded'] is False

            # Prediction attempt when model is unavailable must return HTTP 503
            import io
            pred_res = client.post('/predict', data={'file': (io.BytesIO(b'\xff\xd8\xff\xe0test'), 't.jpg')}, content_type='multipart/form-data')
            assert pred_res.status_code == 503
            p_data = pred_res.get_json()
            assert p_data['status'] == 'error'
        finally:
            engine.interpreter = original_interp
