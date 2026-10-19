# -*- coding: utf-8 -*-
"""
Tests for P1-5: Environmental metrics consistency, blue paper/cardboard bin,
and plastic unlabelling from PET.
"""

import re
from pathlib import Path
from ecosort.knowledge import WASTE_KNOWLEDGE_BASE, METRIC_DISCLAIMER_AR, METRIC_DISCLAIMER_EN

ROOT = Path(__file__).resolve().parent.parent


def test_knowledge_base_metrics_alignment():
    """Verify backend knowledge base matches expected canonical metrics and sources."""
    assert METRIC_DISCLAIMER_AR
    assert METRIC_DISCLAIMER_EN

    # Cardboard
    cb = WASTE_KNOWLEDGE_BASE['cardboard']
    assert cb['co2_saved_grams'] == 140
    assert cb['water_saved_liters'] == 7.5
    assert cb['bin_color'] == '#2563eb'
    assert 'metric_source' in cb

    # Paper
    pap = WASTE_KNOWLEDGE_BASE['paper']
    assert pap['co2_saved_grams'] == 60
    assert pap['water_saved_liters'] == 4.0
    assert pap['bin_color'] == '#2563eb'
    assert 'metric_source' in pap

    # Glass
    gl = WASTE_KNOWLEDGE_BASE['glass']
    assert gl['co2_saved_grams'] == 110
    assert gl['water_saved_liters'] == 1.5
    assert 'metric_source' in gl

    # Metal
    met = WASTE_KNOWLEDGE_BASE['metal']
    assert met['co2_saved_grams'] == 175
    assert met['water_saved_liters'] == 5.2
    assert 'metric_source' in met

    # Plastic: Stop labelling TrashNet plastic as PET
    pl = WASTE_KNOWLEDGE_BASE['plastic']
    assert pl['material'] == 'Plastic'
    assert pl['resin_code'] is None
    assert pl['co2_saved_grams'] == 85
    assert pl['water_saved_liters'] == 2.1
    assert 'metric_source' in pl

    # Trash
    tr = WASTE_KNOWLEDGE_BASE['trash']
    assert tr['target_bin'] == 'trash'
    assert tr['co2_saved_grams'] == 15
    assert tr['water_saved_liters'] == 0.5


def test_waste_database_js_matches_canonical_metrics():
    """Verify static/js/data/waste-database.js matches backend metrics exactly."""
    db_file = ROOT / "static" / "js" / "data" / "waste-database.js"
    content = db_file.read_text(encoding="utf-8")

    # Cardboard
    assert "carbonSavingsGrams: 140" in content
    assert "waterSavingsLiters: 7.5" in content

    # Paper
    assert "carbonSavingsGrams: 60" in content
    assert "waterSavingsLiters: 4.0" in content

    # Glass
    assert "carbonSavingsGrams: 110" in content
    assert "waterSavingsLiters: 1.5" in content

    # Plastic general
    assert "generic_plastic" in content
    assert "carbonSavingsGrams: 85" in content
    assert "waterSavingsLiters: 2.1" in content

    # Paper and cardboard bins are blue #2563eb
    # Check paper_sheet has #2563eb
    assert re.search(r"id:\s*'paper_sheet'[\s\S]*?binColorHex:\s*'#2563eb'", content)
    # Check cardboard_box has #2563eb
    assert re.search(r"id:\s*'cardboard_box'[\s\S]*?binColorHex:\s*'#2563eb'", content)

    # generic_plastic has null resinCode
    assert re.search(r"id:\s*'generic_plastic'[\s\S]*?resinCode:\s*null", content)


def test_html_includes_metrics_disclaimer_and_no_fake_pet_default():
    """Verify HTML UI contains the metric disclaimer and does not hardcode PET."""
    html_file = ROOT / "index.html"
    content = html_file.read_text(encoding="utf-8")

    assert 'id="ir-metrics-disclaimer"' in content
    assert 'data-i18n="metricsDisclaimer"' in content
    # Default detected name is generic plastic, not hardcoded PET
    assert 'id="cv-detected-material-name">بلاستيك وبوليمرات عامة<' in content
