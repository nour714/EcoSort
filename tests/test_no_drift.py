# -*- coding: utf-8 -*-
"""
Tests for P1-4: Drift prevention across single sources of truth.
Ensures:
1. index.html and templates/index.html are identical (no drift).
2. models/model.tflite is the authoritative model, and no divergent api/model.tflite exists.
3. ecosort/ is the authoritative package, and no divergent api/ecosort exists.
4. vercel.json includes models and ecosort for serverless packaging.
"""
import json
import hashlib
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_no_drift_index_html():
    """Verify index.html and templates/index.html are byte-for-byte identical."""
    src = ROOT_DIR / "index.html"
    dst = ROOT_DIR / "templates" / "index.html"

    assert src.exists(), "Root index.html must exist as primary source of truth"
    assert dst.exists(), "templates/index.html must exist for Flask rendering"

    src_hash = sha256_file(src)
    dst_hash = sha256_file(dst)
    assert src_hash == dst_hash, (
        f"Drift detected between index.html ({src_hash[:8]}) and templates/index.html ({dst_hash[:8]}). "
        "Run `python scripts/sync_sources.py` to synchronize."
    )


def test_no_drift_models():
    """Verify models/model.tflite is the single model source of truth."""
    root_model = ROOT_DIR / "models" / "model.tflite"
    assert root_model.exists(), "models/model.tflite must exist"
    assert root_model.stat().st_size > 1_000_000, "models/model.tflite must be a valid model binary"

    api_model = ROOT_DIR / "api" / "model.tflite"
    if api_model.exists():
        assert sha256_file(api_model) == sha256_file(root_model), (
            "Drift detected between api/model.tflite and models/model.tflite!"
        )


def test_no_drift_ecosort_package():
    """Verify ecosort/ is the single package source of truth."""
    root_ecosort = ROOT_DIR / "ecosort"
    assert (root_ecosort / "config.py").exists()
    assert (root_ecosort / "knowledge.py").exists()
    assert (root_ecosort / "preprocess.py").exists()

    api_ecosort = ROOT_DIR / "api" / "ecosort"
    if api_ecosort.exists():
        for f in api_ecosort.glob("*.py"):
            rf = root_ecosort / f.name
            if rf.exists():
                assert sha256_file(f) == sha256_file(rf), (
                    f"Drift detected between api/ecosort/{f.name} and ecosort/{f.name}!"
                )


def test_vercel_includes_single_sources():
    """Verify vercel.json packages single sources models and ecosort."""
    vercel_path = ROOT_DIR / "vercel.json"
    with open(vercel_path, "r", encoding="utf-8") as fp:
        config = json.load(fp)

    funcs = config.get("functions", {})
    api_func = funcs.get("api/index.py", {})
    include_files = api_func.get("includeFiles", "")

    assert "models" in include_files, "vercel.json must include models in includeFiles"
    assert "ecosort" in include_files, "vercel.json must include ecosort in includeFiles"
