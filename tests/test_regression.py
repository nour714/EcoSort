# -*- coding: utf-8 -*-
import os
import pytest
from ecosort.inference import ModelEngine

def test_regression_on_fixture_samples():
    """Verify that predictions on representative samples achieve high reliability."""
    engine = ModelEngine.get_instance()
    assert engine.model is not None

    samples_dir = os.path.join(os.path.dirname(__file__), '..', 'samples')
    if not os.path.isdir(samples_dir):
        pytest.skip("samples/ directory not present")

    classes = ['cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash']
    correct = 0
    total = 0

    for cls in classes:
        cls_dir = os.path.join(samples_dir, cls)
        if not os.path.isdir(cls_dir):
            continue
        # Check first 5 images of each class
        files = [f for f in os.listdir(cls_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))][:5]
        for f in files:
            p = os.path.join(cls_dir, f)
            with open(p, 'rb') as fp:
                res = engine.predict(fp.read())
            if res['class_name'] == cls:
                correct += 1
            total += 1

    if total > 0:
        accuracy = (correct / total) * 100
        print(f"Regression accuracy on test fixtures: {accuracy:.1f}% ({correct}/{total})")
        # Ensure model achieves at least 70% on standard fixture subset
        assert accuracy >= 70.0
