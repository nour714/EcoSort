# -*- coding: utf-8 -*-
"""
Tests for P2-4: GitHub Actions CI workflow validation.
Ensures CI contains:
1. Clean-venv Vercel job running test_vercel_clean_engine.py with api/requirements.txt only.
2. Node test step running node --test tests/*.test.js.
3. Playwright audit step running UI and E2E audit tests.
"""
from pathlib import Path


def test_ci_workflow_structure():
    ci_file = Path(".github") / "workflows" / "ci.yml"
    assert ci_file.exists(), ".github/workflows/ci.yml must exist"

    content = ci_file.read_text(encoding="utf-8")

    # 1. Clean-venv Vercel job
    assert "vercel-clean-runtime" in content or "clean-venv" in content
    assert "api/requirements.txt" in content
    assert "tests/test_vercel_clean_engine.py" in content

    # 2. Node test step
    assert "setup-node" in content
    assert "node --test tests/*.test.js" in content

    # 3. Playwright audit step
    assert "playwright install" in content
    assert "test_ui_audit.py" in content
