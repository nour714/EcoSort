#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EcoSort - Single Source of Truth Synchronization & Drift Detection Script
Maintains single sources:
- index.html (root) is the single source for the SPA frontend; synced to templates/index.html
- models/model.tflite is the single source for the neural network model
- ecosort/ is the single source for core backend logic
"""
import sys
import shutil
import hashlib
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def sync_templates(check_only=False) -> bool:
    src = ROOT_DIR / "index.html"
    dst = ROOT_DIR / "templates" / "index.html"

    if not src.exists():
        print(f"Error: source {src} does not exist.")
        return False

    if dst.exists() and sha256_file(src) == sha256_file(dst):
        print("index.html and templates/index.html are in sync.")
        return True

    if check_only:
        print("Drift detected: index.html and templates/index.html differ!")
        return False

    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    print(f"Synced {src} -> {dst}")
    return True


def check_no_drift() -> bool:
    all_ok = True

    # 1. Check index.html vs templates/index.html
    src = ROOT_DIR / "index.html"
    dst = ROOT_DIR / "templates" / "index.html"
    if src.exists() and dst.exists():
        if sha256_file(src) != sha256_file(dst):
            print("Drift detected: index.html != templates/index.html")
            all_ok = False

    # 2. Check if deprecated api/model.tflite exists and drifted
    api_model = ROOT_DIR / "api" / "model.tflite"
    root_model = ROOT_DIR / "models" / "model.tflite"
    if api_model.exists():
        if sha256_file(api_model) != sha256_file(root_model):
            print("Drift detected: api/model.tflite != models/model.tflite")
            all_ok = False

    # 3. Check if deprecated api/ecosort exists and drifted
    api_ecosort = ROOT_DIR / "api" / "ecosort"
    root_ecosort = ROOT_DIR / "ecosort"
    if api_ecosort.exists():
        for py_file in api_ecosort.glob("*.py"):
            rf = root_ecosort / py_file.name
            if rf.exists() and sha256_file(py_file) != sha256_file(rf):
                print(f"Drift detected in api/ecosort/{py_file.name} vs ecosort/{py_file.name}")
                all_ok = False

    return all_ok


if __name__ == "__main__":
    check_mode = "--check" in sys.argv
    if check_mode:
        ok = check_no_drift()
        sys.exit(0 if ok else 1)
    else:
        sync_templates()
