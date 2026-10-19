# -*- coding: utf-8 -*-
"""
Tests for P1-3: Vercel static hosting, security headers, metadata, and manifest icons.
"""
import json
import re
from pathlib import Path
from PIL import Image

ROOT_DIR = Path(__file__).resolve().parent.parent


def test_vercel_json_rewrites_and_headers():
    vercel_path = ROOT_DIR / "vercel.json"
    assert vercel_path.exists(), "vercel.json must exist"

    with open(vercel_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    rewrites = {r.get("source"): r.get("destination") for r in config.get("rewrites", [])}
    assert "/robots.txt" in rewrites, "vercel.json must rewrite /robots.txt"
    assert "/sitemap.xml" in rewrites, "vercel.json must rewrite /sitemap.xml"

    headers_list = config.get("headers", [])
    assert len(headers_list) > 0, "vercel.json must contain headers"

    all_headers = {}
    for entry in headers_list:
        for h in entry.get("headers", []):
            all_headers[h["key"].lower()] = h["value"]

    assert "x-content-type-options" in all_headers
    assert all_headers["x-content-type-options"] == "nosniff"

    assert "referrer-policy" in all_headers
    assert "strict-origin" in all_headers["referrer-policy"]

    assert "permissions-policy" in all_headers
    assert "camera" in all_headers["permissions-policy"]

    assert "content-security-policy" in all_headers
    csp = all_headers["content-security-policy"]
    assert "default-src" in csp
    assert "object-src 'none'" in csp


def test_robots_and_sitemap_exist():
    root_robots = ROOT_DIR / "robots.txt"
    static_robots = ROOT_DIR / "static" / "robots.txt"
    assert root_robots.exists() and root_robots.stat().st_size > 0
    assert static_robots.exists() and static_robots.stat().st_size > 0

    root_sitemap = ROOT_DIR / "sitemap.xml"
    static_sitemap = ROOT_DIR / "static" / "sitemap.xml"
    assert root_sitemap.exists() and root_sitemap.stat().st_size > 0
    assert static_sitemap.exists() and static_sitemap.stat().st_size > 0

    content = root_robots.read_text(encoding="utf-8")
    assert "https://ecosort.vercel.app/sitemap.xml" in content


def test_canonical_and_absolute_social_meta():
    for filename in ["index.html", "templates/index.html"]:
        path = ROOT_DIR / filename
        assert path.exists(), f"{filename} must exist"
        html = path.read_text(encoding="utf-8")

        # Canonical tag
        assert '<link rel="canonical" href="https://ecosort.vercel.app/">' in html, (
            f"Canonical link missing in {filename}"
        )

        # Absolute og:image and twitter:image
        og_match = re.search(r'<meta property="og:image" content="(.*?)"', html)
        assert og_match and og_match.group(1).startswith("https://"), (
            f"og:image must be absolute in {filename}, got: {og_match.group(1) if og_match else None}"
        )

        tw_match = re.search(r'<meta name="twitter:image" content="(.*?)"', html)
        assert tw_match and tw_match.group(1).startswith("https://"), (
            f"twitter:image must be absolute in {filename}, got: {tw_match.group(1) if tw_match else None}"
        )


def test_manifest_icons_real_dimensions():
    manifest_path = ROOT_DIR / "static" / "manifest.webmanifest"
    assert manifest_path.exists(), "manifest.webmanifest must exist"

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    icons = manifest.get("icons", [])
    sizes_found = {icon.get("sizes"): icon.get("src") for icon in icons}

    assert "192x192" in sizes_found, "192x192 icon must be in manifest"
    assert "512x512" in sizes_found, "512x512 icon must be in manifest"

    # Verify actual image dimensions on disk
    src_192 = ROOT_DIR / sizes_found["192x192"].lstrip("/").replace("/", "\\")
    assert src_192.exists(), f"192 icon file {src_192} must exist"
    im192 = Image.open(src_192)
    assert im192.size == (192, 192), f"Expected 192x192, got {im192.size}"

    src_512 = ROOT_DIR / sizes_found["512x512"].lstrip("/").replace("/", "\\")
    assert src_512.exists(), f"512 icon file {src_512} must exist"
    im512 = Image.open(src_512)
    assert im512.size == (512, 512), f"Expected 512x512, got {im512.size}"


def test_vercelignore_does_not_ignore_static_data():
    """Verify .vercelignore uses root-anchored paths and does not ignore static/js/data/."""
    ignore_path = ROOT_DIR / ".vercelignore"
    assert ignore_path.exists(), ".vercelignore must exist"
    content = ignore_path.read_text(encoding="utf-8").splitlines()
    for line in content:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "data" in stripped:
            assert stripped.startswith("/"), (
                f"Rule '{stripped}' in .vercelignore must be root-anchored with leading '/' "
                "to avoid ignoring static/js/data/ during deployment."
            )
