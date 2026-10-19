# -*- coding: utf-8 -*-
"""Regression: Vercel only builds api/index.py as a function when `app` is assigned
at module level (column 0). Inside if/else it is served as a static file (HTTP 405)."""
import re
from pathlib import Path

SRC = (Path(__file__).resolve().parent.parent / "api" / "index.py").read_text(encoding="utf-8")


def test_app_is_assigned_at_module_level():
    assert re.search(r"^app\s*=", SRC, re.MULTILINE), (
        "api/index.py must contain a top-level `app = ...` line for Vercel detection"
    )


def test_startup_error_does_not_leak_internals():
    assert "'traceback': STARTUP_ERROR" not in SRC
    assert "'sys_path'" not in SRC
    assert "'python_version'" not in SRC
