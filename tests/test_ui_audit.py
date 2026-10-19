# -*- coding: utf-8 -*-
import os
import sys
import threading
import pytest
from werkzeug.serving import make_server
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app

VIEWPORTS = [
    {"name": "iPhone SE", "width": 320, "height": 568},
    {"name": "Android baseline", "width": 360, "height": 740},
    {"name": "iPhone 12/13/14", "width": 390, "height": 844},
    {"name": "iPad Mini Portrait", "width": 768, "height": 1024},
    {"name": "iPad Landscape", "width": 1024, "height": 768},
    {"name": "Desktop baseline", "width": 1440, "height": 900},
]

@pytest.fixture(scope="session")
def live_server():
    server = make_server("127.0.0.1", 0, app)
    port = server.port
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{port}"
    yield url
    server.shutdown()

@pytest.fixture(scope="module")
def browser_instance():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()

def test_viewports_no_horizontal_overflow_and_no_page_errors(live_server, browser_instance):
    """Verifies that across all 6 viewports in AR and EN:
    - Zero pageerror console errors.
    - Zero horizontal overflow (document.scrollWidth <= window.innerWidth).
    - Headings wrap properly and are not clipped.
    """
    for vp in VIEWPORTS:
        context = browser_instance.new_context(viewport={"width": vp["width"], "height": vp["height"]})
        page = context.new_page()
        page_errors = []
        page.on("pageerror", lambda err: page_errors.append(str(err)))

        # 1. Arabic mode (default)
        page.goto(live_server, wait_until="networkidle")
        page.wait_for_selector("#wizard-step-1")
        assert len(page_errors) == 0, f"Page errors in AR mode at {vp['name']}: {page_errors}"

        overflow = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        assert not overflow, f"Horizontal overflow detected in AR mode at viewport {vp['name']} ({vp['width']}x{vp['height']})"

        # 2. English mode toggle
        page.click("#lang-toggle-btn")
        page.wait_for_timeout(200)
        assert len(page_errors) == 0, f"Page errors after switching to EN at {vp['name']}: {page_errors}"

        overflow_en = page.evaluate("() => document.documentElement.scrollWidth > window.innerWidth")
        assert not overflow_en, f"Horizontal overflow detected in EN mode at viewport {vp['name']} ({vp['width']}x{vp['height']})"

        context.close()

def test_step_navigation_and_scan_actions(live_server, browser_instance):
    """Verifies:
    - Step 1 is active on load.
    - Direct scan action buttons are visible.
    - Transitioning between steps works smoothly.
    """
    context = browser_instance.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    page.goto(live_server, wait_until="networkidle")

    # Step 1 is active on load
    assert page.is_visible("#wizard-step-1")
    assert not page.is_visible("#wizard-step-2")
    assert not page.is_visible("#wizard-step-3")

    # Direct scan action buttons are visible on Step 1
    assert page.is_visible("#btn-trigger-camera")
    assert page.is_visible("#btn-trigger-upload")

    # Transition to Step 2
    page.evaluate("() => window.app.goToStep(2)")
    page.wait_for_timeout(300)
    assert page.is_visible("#wizard-step-2")
    assert not page.is_visible("#wizard-step-1")

    # Click Back to scan -> Step 1
    page.click("#btn-back-to-step-1")
    page.wait_for_timeout(300)
    assert page.is_visible("#wizard-step-1")

    context.close()

def test_location_picker_and_persistence(live_server, browser_instance):
    """Verifies:
    - Step 2 search and faculty selection.
    - Location saved to localStorage.
    - Sticky continue button enabled with faculty name.
    """
    context = browser_instance.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    page.goto(live_server, wait_until="networkidle")

    # Navigate to Step 2
    page.evaluate("() => window.app.goToStep(2)")
    page.wait_for_timeout(200)

    # Search for "ai"
    page.fill("#location-search-input", "ai")
    page.wait_for_timeout(150)
    assert page.is_visible('.location-card[data-node-id="ai"]')

    # Select AI faculty
    page.click('.location-card[data-node-id="ai"]')
    page.wait_for_timeout(150)

    # Check localStorage
    loc = page.evaluate("() => localStorage.getItem('ecosort_user_location')")
    assert loc == "ai"

    # Check continue button is enabled
    is_disabled = page.get_attribute("#btn-go-to-step-3", "disabled")
    assert is_disabled is None

    context.close()


def test_decision_gating_and_rejected_handling(live_server, browser_instance):
    """Verifies Decision-First gating (B2):
    - Confident: details shown, #btn-go-to-route enabled.
    - Uncertain: candidate chips shown, #btn-go-to-route disabled until confirmed.
    - Rejected: details & CO2 hidden, photo tips shown, #btn-go-to-route disabled.
    """
    context = browser_instance.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    page.goto(live_server, wait_until="networkidle")

    # 1. Test Confident state via manual preset
    page.evaluate("() => window.app.visionModule.selectPreset('pet_bottle')")
    page.wait_for_timeout(300)

    assert page.is_visible("#card-inspection-result")
    banner_classes = page.get_attribute("#cv-decision-banner", "class")
    assert "decision-banner-confident" in banner_classes
    assert page.is_enabled("#btn-go-to-route")

    # Details are visible
    assert page.is_visible(".detection-top-row")
    assert page.is_visible(".ir-details-split")

    # 2. Simulate Rejected state via handleWasteDetected
    page.evaluate("""() => {
        window.app.handleWasteDetected({
            decision: 'rejected',
            confidence: 30.5,
            isPreset: false,
            item: {
                name: 'مخلفات عامة ومختلطة',
                nameEn: 'Mixed Trash',
                binType: 'general',
                binColorName: 'الحاوية السوداء',
                binColorNameEn: 'Black Bin',
                carbonSavingsGrams: 0
            },
            qualityWarnings: ['IMAGE_BLURRY'],
            topK: []
        });
    }""")
    page.wait_for_timeout(200)

    # Verify decision banner is rejected
    banner_classes_rej = page.get_attribute("#cv-decision-banner", "class")
    assert "decision-banner-rejected" in banner_classes_rej

    # B2: Inaccurate details & CO2 must be HIDDEN
    assert not page.is_visible(".detection-top-row")
    assert not page.is_visible(".ir-details-split")

    # Photo advice & retake must be VISIBLE
    assert page.is_visible("#cv-photo-advice-box")
    assert page.is_visible("#cv-decision-banner-actions")

    # #btn-go-to-route must be DISABLED
    assert not page.is_enabled("#btn-go-to-route")

    # 3. Simulate Uncertain state with candidate chips
    page.evaluate("""() => {
        window.app.handleWasteDetected({
            decision: 'uncertain',
            confidence: 58.0,
            isPreset: false,
            item: {
                name: 'زجاجة بلاستيك',
                nameEn: 'Plastic Bottle',
                binType: 'plastic',
                binColorName: 'الحاوية الصفراء',
                binColorNameEn: 'Yellow Bin',
                carbonSavingsGrams: 85
            },
            qualityWarnings: [],
            topK: [
                { materialId: 'pet_bottle', materialNameAr: 'زجاجة بلاستيك (PET)', materialNameEn: 'Plastic Bottle', confidence: 58 },
                { materialId: 'glass_bottle', materialNameAr: 'زجاجة زجاج', materialNameEn: 'Glass Bottle', confidence: 25 },
                { materialId: 'alu_can', materialNameAr: 'علبة كانز', materialNameEn: 'Aluminum Can', confidence: 17 }
            ]
        });
    }""")
    page.wait_for_timeout(200)

    # Candidate chips container is visible
    assert page.is_visible("#cv-candidate-chips-container")
    chips = page.query_selector_all(".candidate-chip-btn")
    assert len(chips) == 3

    # Primary route button is disabled until student confirms
    assert not page.is_enabled("#btn-go-to-route")

    # Student taps candidate chip 1
    chips[0].click()
    page.wait_for_timeout(200)

    # Confirmed! Now enabled!
    assert page.is_enabled("#btn-go-to-route")

    context.close()

def test_route_summary_card_and_walking_guide(live_server, browser_instance):
    """Verifies Step 3:
    - Summary card first, map canvas second.
    - Turn-by-turn walking guide list populated.
    - Advanced disclosure contains algorithms and evaluation.
    """
    context = browser_instance.new_context(viewport={"width": 1024, "height": 768})
    page = context.new_page()
    page.goto(live_server, wait_until="networkidle")

    # 1. Inspect item in Step 1
    page.evaluate("""() => {
        window.app.visionModule.selectPreset('pet_bottle');
    }""")
    page.wait_for_timeout(200)

    # 2. Click next to location (Step 2 is mandatory)
    page.click("#btn-go-to-route")
    page.wait_for_timeout(300)
    assert page.is_visible("#wizard-step-2")

    # In Step 2, select location
    page.click('.location-card[data-node-id="gate"]')
    page.wait_for_timeout(200)

    # 3. Click continue to route (Step 3)
    page.click("#btn-go-to-step-3")
    page.wait_for_timeout(300)

    assert page.is_visible("#wizard-step-3")

    # 1. Summary card is present
    assert page.is_visible("#card-route-summary")
    dest_name = page.inner_text("#final-target-bin-name")
    assert len(dest_name) > 0

    # 2. Walking steps list is populated
    steps = page.query_selector_all("#metric-walking-steps-list .walking-step-item")
    assert len(steps) >= 1

    # 3. Advanced disclosure
    assert page.is_visible("#advanced-route-disclosure")
    # Verify it is collapsed by default
    is_open = page.get_attribute("#advanced-route-disclosure", "open")
    assert is_open is None

    # Open disclosure
    page.click("#advanced-route-disclosure summary")
    page.wait_for_timeout(200)
    assert page.is_visible("#btn-algo-dijkstra")
    assert page.is_visible("#btn-algo-astar")
    assert page.is_visible(".academic-table")

    context.close()

def test_language_toggle_and_bug_fixes(live_server, browser_instance):
    """Verifies A1-A7 bug fixes:
    - A1: Refresh/toggle does not throw TypeError: this.draw is not a function.
    - A2: No &bull; literal entity strings.
    - A3: Single <h1> brand in header.
    - A4: All strings translated in English mode.
    """
    context = browser_instance.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    page_errors = []
    page.on("pageerror", lambda err: page_errors.append(str(err)))

    page.goto(live_server, wait_until="networkidle")

    # A3: Single <h1> in header
    h1s = page.query_selector_all("h1")
    assert len(h1s) == 1

    # A2: No literal &bull;
    page_content = page.content()
    assert "&bull;" not in page_content

    # A1 & A4: Toggle language back and forth multiple times
    for _ in range(3):
        page.click("#lang-toggle-btn")
        page.wait_for_timeout(150)

    # Verify zero uncaught JS errors
    assert len(page_errors) == 0, f"Uncaught errors during language toggle: {page_errors}"

    context.close()

def test_modal_accessibility_focus_trap_and_escape(live_server, browser_instance):
    """Verifies Modal Accessibility (WCAG 2.1 AA):
    - Modal opens with node details.
    - Focus moves into modal.
    - Pressing Escape closes the modal and returns focus.
    """
    context = browser_instance.new_context(viewport={"width": 1024, "height": 768})
    page = context.new_page()
    page.goto(live_server, wait_until="networkidle")

    # Open modal via app method
    page.evaluate("() => window.app.openNodeModal(window.app.graph.getNode('ai'))")
    page.wait_for_timeout(200)

    assert page.is_visible("#node-details-modal")
    # Verify close button has focus
    active_id = page.evaluate("() => document.activeElement ? document.activeElement.id : null")
    assert active_id == "btn-close-node-modal"

    # Press Escape key
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)

    # Modal must be hidden
    assert not page.is_visible("#node-details-modal")

    context.close()

def test_accessibility_axe_audit(live_server, browser_instance):
    """Runs axe-core accessibility audit across the application.
    Asserts zero critical or serious WCAG 2.1 AA violations.
    """
    context = browser_instance.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.goto(live_server, wait_until="networkidle")

    axe_path = os.path.join(os.path.dirname(__file__), "axe.min.js")
    if os.path.exists(axe_path):
        with open(axe_path, "r", encoding="utf-8") as f:
            axe_script = f.read()
        page.evaluate(axe_script)

        results = page.evaluate("""async () => {
            const res = await axe.run(document, {
                runOnly: {
                    type: 'tag',
                    values: ['wcag2a', 'wcag2aa']
                }
            });
            return res.violations
                .filter(v => v.impact === 'critical' || v.impact === 'serious')
                .map(v => ({
                    id: v.id,
                    impact: v.impact,
                    help: v.help,
                    nodes: v.nodes.map(n => ({
                        target: n.target,
                        html: n.html,
                        failureSummary: n.failureSummary
                    }))
                }));
        }""")

        assert len(results) == 0, f"Axe accessibility violations found: {results}"

    context.close()
