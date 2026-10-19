# -*- coding: utf-8 -*-
"""
Playwright test for P0-4: Uncertain classification flow.
Verifies that:
1. When /predict returns an 'uncertain' decision, candidate chips are shown and the Next button is disabled.
2. Clicking a candidate chip applies the chosen item as a user-confirmed correction.
3. The result card updates and the Next button is enabled.
"""
import json
import os
import sys
import threading
import pytest
from werkzeug.serving import make_server
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app


@pytest.fixture(scope="module")
def live_server():
    server = make_server("127.0.0.1", 0, app)
    port = server.port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}"
    yield url
    server.shutdown()


def test_uncertain_state_candidate_chips_flow(live_server):
    uncertain_response = {
        "status": "success",
        "decision": "uncertain",
        "class_name": "cardboard",
        "confidence": 62.5,
        "confidence_formatted": "62.5%",
        "margin": 4.5,
        "top_k": [
            {
                "class_name": "cardboard",
                "confidence": 62.5,
                "confidence_formatted": "62.5%",
                "material_name_ar": "صندوق كرتون وأوراق تغليف",
                "material_name_en": "Cardboard Box"
            },
            {
                "class_name": "plastic",
                "confidence": 58.0,
                "confidence_formatted": "58.0%",
                "material_name_ar": "زجاجة مياه بلاستيكية (PET)",
                "material_name_en": "Plastic Bottle (PET)"
            },
            {
                "class_name": "metal",
                "confidence": 12.0,
                "confidence_formatted": "12.0%",
                "material_name_ar": "علبة كانز معدنية",
                "material_name_en": "Aluminum Can"
            }
        ],
        "quality_warnings": [],
        "model_version": "2.0.0 (LiteRT Neural Model)",
        "inference_time_ms": 14.5,
        "material": "Cardboard",
        "material_name_ar": "صندوق كرتون",
        "material_name_en": "Cardboard Box",
        "target_bin": "paper",
        "bin_color": "#2563eb",
        "bin_name_ar": "الحاوية الزرقاء (ورق وكرتون)",
        "bin_name_en": "Blue Bin (Paper & Cardboard)",
        "co2_saved_grams": 140,
        "all_probabilities": {"cardboard": 62.5, "plastic": 58.0, "metal": 12.0, "glass": 2.0, "trash": 1.0, "paper": 0.5}
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Mock /predict route
        page.route("**/predict", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps(uncertain_response)
        ))

        page.goto(live_server, wait_until="networkidle")
        page.wait_for_selector("#wizard-step-1")

        # Trigger prediction with mock image
        page.evaluate("""
            const blob = new Blob(['mock-image-data'], { type: 'image/jpeg' });
            const file = new File([blob], 'uncertain_sample.jpg', { type: 'image/jpeg' });
            window.app.visionModule.processUploadedImage(file);
        """)

        # Wait for result card and decision banner
        page.wait_for_selector("#card-inspection-result:not(.hidden)")
        page.wait_for_selector(".decision-banner-uncertain")

        # Assert Next button is disabled initially in uncertain state
        assert page.is_disabled("#btn-go-to-route"), "Next button must be disabled in uncertain state before confirmation"

        # Assert candidate chips are visible
        chips = page.locator(".candidate-chip-btn")
        assert chips.count() == 3, f"Expected 3 candidate chips, got {chips.count()}"

        # Click the 2nd chip (Plastic)
        chips.nth(1).click()

        # After user confirmation:
        # 1. Decision banner transitions to confident
        page.wait_for_selector(".decision-banner-confident")

        # 2. Next button must now be enabled
        assert page.is_enabled("#btn-go-to-route"), "Next button must be enabled after candidate chip is selected"

        # 3. Target bin badge should reflect plastic
        badge_text = page.locator("#ir-target-bin-badge").text_content()
        assert "بلاستيك" in badge_text or "Plastic" in badge_text or "الصفراء" in badge_text

        browser.close()
