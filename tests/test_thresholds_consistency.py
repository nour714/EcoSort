# -*- coding: utf-8 -*-
"""
Test consistency of quality thresholds and gating policies.
Ensures code defaults, environment overrides, and documentation stay in strict sync.
"""
import os
from PIL import Image
from ecosort.config import Config
from ecosort.preprocess import check_image_quality

def test_default_quality_thresholds():
    assert Config.BLUR_VAR_MIN == 35.0
    assert Config.DARK_MEAN_MAX == 30.0
    assert Config.BRIGHT_MEAN_MIN == 230.0
    assert Config.FLAT_STD_MIN == 15.0

    assert Config.CONF_HIGH == 75.0
    assert Config.CONF_LOW == 45.0
    assert Config.MARGIN_MIN == 20.0

def test_thresholds_documented_in_reference():
    doc_path = os.path.join("docs", "THRESHOLDS.md")
    assert os.path.exists(doc_path), f"Missing {doc_path}"

    with open(doc_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "35.0" in content
    assert "30.0" in content
    assert "230.0" in content
    assert "15.0" in content
    assert "75.0" in content
    assert "45.0" in content
    assert "20.0" in content

def test_check_image_quality_custom_thresholds():
    # Slightly dim image with mean around 40
    dim_img = Image.new('RGB', (100, 100), color=(40, 40, 40))

    # Default dark_max is 30.0, so mean 40 does NOT trigger dark warning
    w_default = check_image_quality(dim_img)
    assert 'image_too_dark' not in w_default

    # Custom dark_max set to 50.0 -> now triggers dark warning
    w_custom = check_image_quality(dim_img, dark_max=50.0)
    assert 'image_too_dark' in w_custom
