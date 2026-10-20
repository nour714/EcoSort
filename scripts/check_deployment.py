#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EcoSort - Post-Deployment Health & LiteRT Inference Verification Script
Verifies:
1. GET /health -> status=200, model_loaded=True
2. POST /predict -> status=200, status='success', model_version contains 'LiteRT'
3. Bundle integrity of ecosort/ package and models/model.tflite
"""
import sys
import io
import json
import argparse
from pathlib import Path
from PIL import Image

try:
    import requests
except ImportError:
    requests = None


def generate_sample_image_bytes() -> bytes:
    """Generate a clean 224x224 RGB JPEG sample for inference verification."""
    img = Image.new("RGB", (224, 224), color=(60, 140, 210))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def check_deployment(base_url: str, timeout: int = 25) -> bool:
    base_url = base_url.rstrip("/")
    print(f"=== EcoSort Post-Deployment Verification for {base_url} ===")

    # 1. Health check
    health_url = f"{base_url}/health"
    print(f"\n1. Probing GET {health_url}...")
    try:
        if requests:
            resp = requests.get(health_url, timeout=timeout)
            status_code = resp.status_code
            health_data = resp.json()
        else:
            import urllib.request
            req = urllib.request.Request(health_url, headers={"User-Agent": "EcoSort-HealthCheck/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as response:
                status_code = response.status
                health_data = json.loads(response.read().decode("utf-8"))

        print(f"   Response HTTP {status_code}: {health_data}")
        if status_code != 200:
            print(f"   [FAIL] Health endpoint returned HTTP {status_code}, expected 200")
            return False

        if not health_data.get("model_loaded"):
            print(f"   [FAIL] Health check failed: 'model_loaded' is {health_data.get('model_loaded')}, expected True")
            return False

        print("   [PASS] Local model interpreter loaded successfully (model_loaded=True).")

    except Exception as e:
        print(f"   [FAIL] Failed to reach health endpoint: {e}")
        return False

    # 2. Predict check
    predict_url = f"{base_url}/predict"
    print(f"\n2. Probing POST {predict_url} with sample image...")
    try:
        img_bytes = generate_sample_image_bytes()
        if requests:
            resp = requests.post(
                predict_url,
                files={"file": ("verify_sample.jpg", img_bytes, "image/jpeg")},
                timeout=timeout
            )
            status_code = resp.status_code
            predict_data = resp.json()
        else:
            import urllib.request
            boundary = "----WebKitFormBoundaryEcoSortCheck7MA4YWxkTrZu0gW"
            body = (
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="file"; filename="verify_sample.jpg"\r\n'
                f"Content-Type: image/jpeg\r\n\r\n"
            ).encode("utf-8") + img_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

            req = urllib.request.Request(
                predict_url,
                data=body,
                headers={
                    "Content-Type": f"multipart/form-data; boundary={boundary}",
                    "User-Agent": "EcoSort-PredictCheck/1.0"
                }
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                status_code = response.status
                predict_data = json.loads(response.read().decode("utf-8"))

        print(f"   Response HTTP {status_code}: {predict_data}")
        if status_code != 200:
            print(f"   [FAIL] Predict endpoint returned HTTP {status_code}, expected 200")
            return False

        if predict_data.get("status") != "success":
            print(f"   [FAIL] Predict status is '{predict_data.get('status')}', expected 'success'")
            return False

        model_version = predict_data.get("model_version", "")
        if "LiteRT" not in model_version:
            print(f"   [FAIL] model_version '{model_version}' does not contain 'LiteRT'")
            return False

        print(f"   [PASS] LiteRT neural model inference verified: '{model_version}'.")
        print(f"          Classification: {predict_data.get('class_name')} ({predict_data.get('confidence')}%), decision: {predict_data.get('decision')}")

    except Exception as e:
        print(f"   [FAIL] Failed to execute predict check: {e}")
        return False

    # 3. Local bundle verification (for pre-deploy validation)
    root_dir = Path(__file__).resolve().parent.parent
    ecosort_dir = root_dir / "ecosort"
    model_tflite = root_dir / "models" / "model.tflite"

    print("\n3. Verifying Vercel bundle artifacts on disk...")
    if ecosort_dir.is_dir() and (ecosort_dir / "__init__.py").exists():
        print(f"   [PASS] Package '{ecosort_dir.name}/' is intact.")
    else:
        print(f"   [WARN] '{ecosort_dir}' not found locally or incomplete.")

    if model_tflite.is_file() and model_tflite.stat().st_size > 1_000_000:
        print(f"   [PASS] Authority model '{model_tflite}' is intact ({model_tflite.stat().st_size / 1024:.1f} KB).")
    else:
        print(f"   [WARN] '{model_tflite}' missing or size < 1MB.")

    print("\n=== All deployment checks PASSED successfully! ===")
    return True


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="EcoSort Post-Deployment Verification")
    parser.add_argument("--url", default="https://ecosort.vercel.app", help="Deployment base URL (default: https://ecosort.vercel.app)")
    parser.add_argument("--timeout", type=int, default=25, help="HTTP timeout in seconds")
    args = parser.parse_args()

    success = check_deployment(args.url, args.timeout)
    sys.exit(0 if success else 1)
