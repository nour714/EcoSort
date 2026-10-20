# -*- coding: utf-8 -*-
"""
Tests for P2-2: Frontend hygiene, fabricated inference time removal,
user-friendly error messages, translated toasts, and zero inline onclick handlers.
"""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent


def test_no_fabricated_inference_time_in_vision_module():
    """Verify vision-module.js does not contain fabricated 18.5 inference time fallback."""
    vision_file = ROOT / "static" / "js" / "modules" / "vision-module.js"
    content = vision_file.read_text(encoding="utf-8")

    assert "18.5" not in content, "Fabricated 18.5ms inference time fallback must be removed"


def test_no_python_app_py_in_client_error_messages():
    """Verify user-facing error messages do not leak internal dev instruction 'python app.py'."""
    vision_file = ROOT / "static" / "js" / "modules" / "vision-module.js"
    content = vision_file.read_text(encoding="utf-8")

    assert "python app.py" not in content, "Client-facing error message must not instruct users to run python app.py"


def test_zero_inline_onclick_handlers_across_web_assets():
    """Verify there are zero inline onclick handlers in HTML or JS for strict CSP compatibility."""
    targets = [
        ROOT / "index.html",
        ROOT / "templates" / "index.html",
        ROOT / "static" / "js" / "app.js",
        ROOT / "static" / "js" / "modules" / "evaluation-ui.js",
        ROOT / "static" / "js" / "modules" / "vision-module.js"
    ]

    for target in targets:
        content = target.read_text(encoding="utf-8")
        # Check for inline onclick attributes: onclick=
        matches = re.findall(r"\bonclick\s*=", content, re.IGNORECASE)
        assert len(matches) == 0, f"Found inline onclick in {target.name}: {matches}"


def test_translations_contain_step3_toasts():
    """Verify translations.js contains localized toasts for Step 3 algorithm switching."""
    trans_file = ROOT / "static" / "js" / "data" / "translations.js"
    content = trans_file.read_text(encoding="utf-8")

    assert "toastDijkstraTitle" in content
    assert "toastAStarTitle" in content
    assert "toastNoRouteTitle" in content

def test_cancel_scan_button_and_translations_present():
    """Verify cancel scan button is present in HTML templates, localized, and handled in JS."""
    index_html = (ROOT / "index.html").read_text(encoding="utf-8")
    tmpl_html = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")
    app_js = (ROOT / "static" / "js" / "app.js").read_text(encoding="utf-8")
    trans_js = (ROOT / "static" / "js" / "data" / "translations.js").read_text(encoding="utf-8")
    css = (ROOT / "static" / "css" / "components.css").read_text(encoding="utf-8")

    assert 'id="btn-cancel-scan"' in index_html
    assert 'id="btn-cancel-scan"' in tmpl_html
    assert 'btnCancelScan' in trans_js
    assert 'cancelScan()' in app_js
    assert '.btn-cancel-scan' in css
