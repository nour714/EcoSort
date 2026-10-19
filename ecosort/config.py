# -*- coding: utf-8 -*-
"""
EcoSort Configuration Module
Centralized configuration loaded from environment variables with safe defaults.
"""
import os
from pathlib import Path

class Config:
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 5000))
    DEBUG = os.environ.get('DEBUG', 'False').lower() in ('true', '1')

    # Model & Preprocessing
    MODEL_PATH = os.environ.get('MODEL_PATH', str(Path(__file__).resolve().parents[1] / "models" / "model.keras"))
    INPUT_SIZE = (224, 224)
    NORM_MODE = os.environ.get('NORM_MODE', 'zero_one')  # 'zero_one' [0, 1] empirically verified
    RESIZE_MODE = os.environ.get('RESIZE_MODE', 'direct')  # 'direct' bilinear empirically verified
    TTA_ENABLED = os.environ.get('TTA_ENABLED', 'False').lower() in ('true', '1')

    # Confidence Gating Thresholds (calibrated from Coverage Curve)
    CONF_HIGH = float(os.environ.get('CONF_HIGH', 75.0))   # >= 75% for confident decision
    CONF_LOW = float(os.environ.get('CONF_LOW', 45.0))     # < 45% for rejected decision
    MARGIN_MIN = float(os.environ.get('MARGIN_MIN', 20.0))  # Top1 - Top2 margin >= 20%

    # Image Quality Thresholds (Pre-inference heuristics)
    BLUR_VAR_MIN = float(os.environ.get('BLUR_VAR_MIN', 35.0))
    DARK_MEAN_MAX = float(os.environ.get('DARK_MEAN_MAX', 30.0))
    BRIGHT_MEAN_MIN = float(os.environ.get('BRIGHT_MEAN_MIN', 230.0))
    FLAT_STD_MIN = float(os.environ.get('FLAT_STD_MIN', 15.0))

    # Request limits (under ~4 MB)
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 4 * 1024 * 1024))  # 4 MB

    # CORS settings
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*')

    # Classes in TrashNet standard alphabetical order
    CLASS_NAMES = ['cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash']
