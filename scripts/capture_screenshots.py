"""
EcoSort - Automated Screenshot Capture Suite
Uses Playwright to launch a live browser, interact with the wizard flow,
and capture high-resolution screenshots for documentation and academic defense.
"""

import os
import sys
import time
import subprocess
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent.parent
SCREENSHOTS_DIR = BASE_DIR / "docs" / "screenshots"
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_FILE = BASE_DIR / "samples" / "plastic" / "plastic10.jpg"

PORT = 5000
SERVER_URL = f"http://127.0.0.1:{PORT}"


def wait_for_server(url, timeout=60):
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"{url}/health", timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(1)
    return False


def main():
    print(f"[1/4] Starting Flask server on port {PORT}...", flush=True)
    server_proc = subprocess.Popen(
        [sys.executable, str(BASE_DIR / "app.py")],
        cwd=str(BASE_DIR),
        env={**os.environ, "PORT": str(PORT), "FLASK_ENV": "production"}
    )

    try:
        if not wait_for_server(SERVER_URL, timeout=60):
            print("ERROR: Server failed to start in time.", flush=True)
            sys.exit(1)

        print("[2/4] Server is healthy! Launching Playwright Chromium...")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": 1280, "height": 850},
                device_scale_factor=2
            )
            page = context.new_page()
            page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))
            page.on("pageerror", lambda err: print(f"BROWSER ERROR: {err}"))

            # -------------------------------------------------------------
            # Screenshot 1: Landing Page (Step 1 - Campus Location Selection)
            # -------------------------------------------------------------
            print("Capturing 01-landing.png...")
            page.goto(SERVER_URL, wait_until="networkidle")
            page.wait_for_selector("#location-cards-grid .location-card")
            page.screenshot(path=str(SCREENSHOTS_DIR / "01-landing.png"))

            # -------------------------------------------------------------
            # Select Faculty of AI and navigate to Step 2
            # -------------------------------------------------------------
            ai_card = page.locator(".location-card[data-node-id='ai']")
            if ai_card.count() > 0:
                ai_card.click()
            time.sleep(0.3)
            page.click("#btn-go-to-step-2")
            page.wait_for_selector("#wizard-step-2:not(.hidden)")

            # -------------------------------------------------------------
            # Screenshot 2: Step 2 - Upload / Scanner Dropzone
            # -------------------------------------------------------------
            print("Capturing 02-scan-upload.png...")
            time.sleep(0.5)
            page.screenshot(path=str(SCREENSHOTS_DIR / "02-scan-upload.png"))

            # -------------------------------------------------------------
            # Upload real sample & wait for classification result
            # -------------------------------------------------------------
            print(f"Uploading sample image: {SAMPLE_FILE.name}...")
            if SAMPLE_FILE.exists():
                page.set_input_files("#waste-image-input", str(SAMPLE_FILE))
                page.wait_for_selector("#card-inspection-result:not(.hidden)", timeout=20000)
                time.sleep(2)

                # -------------------------------------------------------------
                # Screenshot 3: Classification Result with Top-3 & KPIs
                # -------------------------------------------------------------
                print("Capturing 03-scan-result.png...")
                result_card = page.locator("#card-inspection-result")
                result_card.scroll_into_view_if_needed()
                time.sleep(0.5)
                page.screenshot(path=str(SCREENSHOTS_DIR / "03-scan-result.png"))

            # -------------------------------------------------------------
            # Screenshot 4: Uncertain / Quality Warning State
            # -------------------------------------------------------------
            print("Triggering and capturing 04-scan-uncertain.png...")
            page.evaluate("""
                () => {
                    const db = window.WASTE_DATABASE || [];
                    const pet = db.find(w => w.id === 'pet_bottle') || db[0];
                    window.app.handleWasteDetected({
                        item: pet,
                        isPreset: false,
                        confidence: 58.4,
                        decision: 'uncertain',
                        margin: 8.6,
                        qualityWarnings: ['IMAGE_BLURRY', 'IMAGE_TOO_DARK'],
                        topK: [
                            { className: 'plastic', materialNameAr: 'بلاستيك شفاف (PET)', materialNameEn: 'Clear Plastic (PET)', confidence: 58.4, confidenceFormatted: '58.4%' },
                            { className: 'glass', materialNameAr: 'زجاجات شفافة (Glass)', materialNameEn: 'Glass', confidence: 49.8, confidenceFormatted: '49.8%' },
                            { className: 'trash', materialNameAr: 'مخلفات مختلطة (Trash)', materialNameEn: 'Mixed Trash', confidence: 12.0, confidenceFormatted: '12.0%' }
                        ],
                        inferenceTimeMs: 24.3,
                        modelName: 'Keras Deep Learning (.keras) • Flask Server',
                        texture: 'سطح منخفض التباين مع تشويش حركي واضح',
                        opticalFeatures: 'ملامح ضوئية مشوشة'
                    });
                }
            """)
            time.sleep(0.5)
            page.locator("#card-inspection-result").scroll_into_view_if_needed()
            page.screenshot(path=str(SCREENSHOTS_DIR / "04-scan-uncertain.png"))

            # Restore confident detection for map step
            page.evaluate("""
                () => {
                    window.app.visionModule.selectPreset('pet_bottle');
                }
            """)
            time.sleep(0.3)

            # -------------------------------------------------------------
            # Navigate to Step 3: Campus Map & Path Routing
            # -------------------------------------------------------------
            print("Navigating to Step 3...")
            page.click("#btn-go-to-step-3")
            page.wait_for_selector("#wizard-step-3:not(.hidden)")
            time.sleep(1)

            # -------------------------------------------------------------
            # Screenshot 5: Campus Graph & Route
            # -------------------------------------------------------------
            print("Capturing 05-campus-map.png...")
            page.locator(".map-card-full").scroll_into_view_if_needed()
            time.sleep(0.5)
            page.screenshot(path=str(SCREENSHOTS_DIR / "05-campus-map.png"))

            # -------------------------------------------------------------
            # Screenshot 6: Academic Algorithms Benchmark
            # -------------------------------------------------------------
            print("Capturing 06-algorithms-benchmark.png...")
            page.locator(".academic-evaluation-section").scroll_into_view_if_needed()
            time.sleep(0.5)
            page.screenshot(path=str(SCREENSHOTS_DIR / "06-algorithms-benchmark.png"))

            # -------------------------------------------------------------
            # Screenshot 7: Mobile View
            # -------------------------------------------------------------
            print("Capturing 07-mobile.png...")
            mobile_context = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True
            )
            mobile_page = mobile_context.new_page()
            mobile_page.goto(SERVER_URL, wait_until="networkidle")
            time.sleep(0.5)
            mobile_page.screenshot(path=str(SCREENSHOTS_DIR / "07-mobile.png"))

            browser.close()
            print("[3/4] All 7 screenshots captured successfully in docs/screenshots/!")

    finally:
        print("[4/4] Shutting down Flask test server...")
        server_proc.terminate()
        server_proc.wait(timeout=5)


if __name__ == "__main__":
    main()
