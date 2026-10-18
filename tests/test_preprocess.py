# -*- coding: utf-8 -*-
import io
import numpy as np
import pytest
from PIL import Image

from ecosort.preprocess import load_image, check_image_quality, preprocess_image, InvalidImageError

def test_load_image_rgb(sample_jpeg_bytes):
    img = load_image(sample_jpeg_bytes)
    assert img.mode == 'RGB'
    assert img.size == (300, 300)

def test_load_image_alpha_composite_white(sample_rgba_bytes):
    img = load_image(sample_rgba_bytes)
    assert img.mode == 'RGB'
    # Red with alpha=128 over white (255,255,255) -> blended, not black!
    pixel = img.getpixel((10, 10))
    assert pixel[0] > 200  # High red
    assert pixel[1] > 100  # Blended white, NOT 0 (black)!
    assert pixel[2] > 100

def test_invalid_bytes_raises_error():
    with pytest.raises(InvalidImageError):
        load_image(b'invalid random noise')

def test_quality_checks_dark_and_flat():
    # Completely black image
    black_img = Image.new('RGB', (100, 100), color=(0, 0, 0))
    warnings = check_image_quality(black_img)
    assert 'image_too_dark' in warnings
    assert 'image_empty_or_flat' in warnings

def test_quality_checks_bright_image():
    # Completely white image
    white_img = Image.new('RGB', (100, 100), color=(250, 250, 250))
    warnings = check_image_quality(white_img)
    assert 'image_too_bright' in warnings
    assert 'image_empty_or_flat' in warnings

def test_preprocess_tensor_shape_and_range(sample_jpeg_bytes):
    tensor, warnings = preprocess_image(sample_jpeg_bytes)
    assert tensor.shape == (1, 224, 224, 3)
    assert tensor.dtype == np.float32
    assert np.min(tensor) >= 0.0
    assert np.max(tensor) <= 1.0
