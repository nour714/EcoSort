# -*- coding: utf-8 -*-
import os
from ecosort.knowledge import WASTE_KNOWLEDGE_BASE

def test_knowledge_base_completeness():
    expected_classes = ['cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash']
    for cls in expected_classes:
        assert cls in WASTE_KNOWLEDGE_BASE
        info = WASTE_KNOWLEDGE_BASE[cls]
        assert 'material' in info
        assert 'material_name_ar' in info
        assert 'resin_code' in info
        assert 'target_bin' in info
        assert 'co2_saved_grams' in info
        assert info['co2_saved_grams'] > 0
        assert len(info['guide']) > 0

def test_js_waste_database_consistency():
    js_path = os.path.join(os.path.dirname(__file__), '..', 'static', 'js', 'data', 'waste-database.js')
    assert os.path.exists(js_path), "static/js/data/waste-database.js must exist"

    with open(js_path, 'r', encoding='utf-8') as f:
        js_content = f.read()

    # Verify key target bins are declared consistently in JS database
    for cls in ['paper', 'glass', 'metal', 'plastic']:
        assert f"binType: '{cls}'" in js_content or f'binType: "{cls}"' in js_content
