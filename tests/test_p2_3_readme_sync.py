# -*- coding: utf-8 -*-
"""
Tests for P2-3: README sync, Dockerfile single-stage, and docker-compose version check.
"""
import re
from pathlib import Path


def test_docker_compose_no_version():
    """Verify docker-compose.yml does not use obsolete top-level version key."""
    compose_path = Path("docker-compose.yml")
    assert compose_path.exists(), "docker-compose.yml missing"
    content = compose_path.read_text(encoding="utf-8")
    assert not re.search(r"^\s*version\s*:", content, re.MULTILINE), (
        "docker-compose.yml should not have obsolete 'version:' attribute"
    )


def test_dockerfile_is_single_stage():
    """Verify Dockerfile is a single-stage build using python:3.11-slim."""
    dockerfile_path = Path("Dockerfile")
    assert dockerfile_path.exists(), "Dockerfile missing"
    lines = dockerfile_path.read_text(encoding="utf-8").splitlines()
    from_lines = [line.strip() for line in lines if line.strip().startswith("FROM")]
    assert len(from_lines) == 1, f"Expected single-stage build (1 FROM instruction), got {len(from_lines)}"
    assert "python:3.11-slim" in from_lines[0]


def test_readme_no_leaflet_and_no_proper_handling():
    """Verify README does not reference Leaflet or obsolete proper_handling."""
    readme_path = Path("README.md")
    assert readme_path.exists(), "README.md missing"
    content = readme_path.read_text(encoding="utf-8")
    assert "leaflet" not in content.lower(), "README.md should not reference Leaflet"
    assert "proper_handling" not in content, "README.md API response should not have 'proper_handling'"
    assert '"guide":' in content, "README.md API response must use 'guide'"


def test_readme_mentions_deployment_and_api():
    """Verify README includes Deployment: Flask vs Vercel section and api/ in repo tree."""
    readme_path = Path("README.md")
    content = readme_path.read_text(encoding="utf-8")
    assert "Deployment: Flask vs Vercel" in content, "README missing 'Deployment: Flask vs Vercel' section"
    assert "api/" in content, "README directory tree missing 'api/'"
    assert "index.html" in content, "README directory tree missing 'index.html'"


def test_readme_no_hardcoded_test_count():
    """Verify README does not hardcode static test counts like 'All 21 test cases'."""
    readme_path = Path("README.md")
    content = readme_path.read_text(encoding="utf-8")
    assert "All 21 test cases" not in content, "README.md still contains hardcoded 'All 21 test cases'"


def test_deployment_check_script_and_readme_doc():
    """Verify scripts/check_deployment.py exists and README documents LiteRT and bundle confirmation."""
    check_script = Path("scripts/check_deployment.py")
    assert check_script.exists(), "scripts/check_deployment.py must exist"

    readme_content = Path("README.md").read_text(encoding="utf-8")
    assert "check_deployment.py" in readme_content
    assert "model_loaded" in readme_content
    assert "LiteRT" in readme_content
    assert "models/model.tflite" in readme_content
    assert "ecosort/" in readme_content

    from scripts.check_deployment import generate_sample_image_bytes
    img_bytes = generate_sample_image_bytes()
    assert len(img_bytes) > 0
