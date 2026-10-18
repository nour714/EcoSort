# -*- coding: utf-8 -*-
import io
import sys
import os
import pytest
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

@pytest.fixture
def sample_jpeg_bytes():
    img = Image.new('RGB', (300, 300), color=(50, 120, 200))
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    return buf.getvalue()

@pytest.fixture
def sample_rgba_bytes():
    img = Image.new('RGBA', (250, 250), color=(255, 0, 0, 128))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()
