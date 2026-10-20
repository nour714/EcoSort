# -*- coding: utf-8 -*-
"""
EcoSort Preprocessing & Image Quality Inspection Module
"""
import io
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from ecosort.config import Config

# Optional pillow-heif support for iPhone photos
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

class InvalidImageError(ValueError):
    """Raised when an uploaded file is not a valid or readable image."""
    pass

def load_image(image_bytes: bytes) -> Image.Image:
    """
    Safely load and normalize orientation/color of raw image bytes.
    1. Reads via PIL and corrects EXIF rotation (critical for mobile camera captures).
    2. Blends RGBA transparency against a clean white background (prevents black background artifacts).
    3. Validates dimensions.
    """
    if not image_bytes or len(image_bytes) < 16:
        raise InvalidImageError("بيانات الصورة فارغة أو غير مكتملة.")

    try:
        img = Image.open(io.BytesIO(image_bytes))
        # 1. Correct mobile orientation
        img = ImageOps.exif_transpose(img)

        # 2. Handle transparency (composite over white background instead of black)
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGBA")
            background = Image.new("RGBA", img.size, (255, 255, 255, 255))
            img = Image.alpha_composite(background, img).convert("RGB")
        else:
            img = img.convert("RGB")

        # 3. Validation checks
        w, h = img.size
        if w < 32 or h < 32:
            raise InvalidImageError(f"أبعاد الصورة صغيرة جداً ({w}x{h}). الحد الأدنى 32x32 بكسل.")

        return img

    except Image.DecompressionBombError as e:
        raise InvalidImageError("أبعاد الصورة كبيرة جداً وغير آمنة للمعالجة (Decompression Bomb).") from e
    except (UnidentifiedImageError, OSError) as e:
        raise InvalidImageError("الملف المرفوع ليس ملف صورة صالح أو أنه تالف.") from e


def check_image_quality(img: Image.Image, blur_min: float = None, dark_max: float = None, bright_min: float = None, flat_min: float = None) -> list:
    """
    Inspect visual quality and return list of actionable warning codes:
    - 'image_blurry': Laplacian variance below threshold.
    - 'image_too_dark': Mean luminance < dark_max.
    - 'image_too_bright': Mean luminance > bright_min.
    - 'image_empty_or_flat': Standard deviation < flat_min (solid color/flat).
    """
    blur_min = blur_min if blur_min is not None else getattr(Config, 'BLUR_VAR_MIN', 35.0)
    dark_max = dark_max if dark_max is not None else getattr(Config, 'DARK_MEAN_MAX', 30.0)
    bright_min = bright_min if bright_min is not None else getattr(Config, 'BRIGHT_MEAN_MIN', 230.0)
    flat_min = flat_min if flat_min is not None else getattr(Config, 'FLAT_STD_MIN', 15.0)

    warnings = []

    # Grayscale thumbnail for fast statistical checks
    thumb = img.resize((128, 128), Image.Resampling.BILINEAR).convert('L')
    arr = np.array(thumb, dtype=np.float32)

    # 1. Luminance checks
    mean_val = float(np.mean(arr))
    if mean_val < dark_max:
        warnings.append("image_too_dark")
    elif mean_val > bright_min:
        warnings.append("image_too_bright")

    # 2. Flat / Blank image check
    std_val = float(np.std(arr))
    if std_val < flat_min:
        warnings.append("image_empty_or_flat")

    # 3. Simple Laplacian blur check (convolution)
    sub = arr[1:-1, 1:-1]
    lap = (arr[:-2, 1:-1] + arr[2:, 1:-1] + arr[1:-1, :-2] + arr[1:-1, 2:] - 4 * sub)
    var_lap = float(np.var(lap))
    if var_lap < blur_min and "image_empty_or_flat" not in warnings:
        warnings.append("image_blurry")

    return warnings

def preprocess_image(image_bytes: bytes, target_size=(224, 224), resize_mode='direct', norm_mode='zero_one') -> tuple:
    """
    Full preprocessing pipeline:
    1. Loads, transposes EXIF, and handles transparency.
    2. Runs quality checks.
    3. Resizes according to proven direct bilinear strategy.
    4. Normalizes pixel intensities to [0, 1] (or config mode).
    5. Returns (tensor_batch, quality_warnings).
    """
    img = load_image(image_bytes)
    warnings = check_image_quality(img)

    if resize_mode == 'direct':
        # Smart mobile adaptation: if an image is strongly portrait (height > 1.15 * width,
        # typical for vertical mobile camera captures), direct squashing distorts the item
        # into a pancake. Centering the square region preserves the natural 1:1 geometry.
        if img.height > 1.15 * img.width:
            min_dim = img.width
            top = (img.height - min_dim) // 2
            img_crop = img.crop((0, top, min_dim, top + min_dim))
            img_resized = img_crop.resize(target_size, Image.Resampling.BILINEAR)
        else:
            img_resized = img.resize(target_size, Image.Resampling.BILINEAR)
    elif resize_mode == 'crop':
        w, h = img.size
        min_dim = min(w, h)
        left = (w - min_dim) // 2
        top = (h - min_dim) // 2
        img_cropped = img.crop((left, top, left + min_dim, top + min_dim))
        img_resized = img_cropped.resize(target_size, Image.Resampling.BILINEAR)
    elif resize_mode == 'pad':
        w, h = img.size
        scale = min(target_size[0] / w, target_size[1] / h)
        nw, nh = int(w * scale), int(h * scale)
        scaled = img.resize((nw, nh), Image.Resampling.BILINEAR)
        img_resized = Image.new('RGB', target_size, (128, 128, 128))
        img_resized.paste(scaled, ((target_size[0] - nw) // 2, (target_size[1] - nh) // 2))
    else:
        img_resized = img.resize(target_size, Image.Resampling.BILINEAR)

    arr = np.array(img_resized, dtype=np.float32)

    if norm_mode == 'zero_one':
        arr = arr / 255.0
    elif norm_mode == 'signed':
        arr = (arr / 127.5) - 1.0

    batch = np.expand_dims(arr, axis=0)
    return batch, warnings
