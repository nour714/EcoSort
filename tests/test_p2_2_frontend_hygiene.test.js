const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEnvironment() {
    let capturedSortedBinsHtml = '';
    const mockContainer = {
        set innerHTML(val) { capturedSortedBinsHtml = val; },
        get innerHTML() { return capturedSortedBinsHtml; },
        querySelectorAll: () => []
    };

    const sandbox = {
        window: {},
        document: {
            documentElement: { lang: 'ar' },
            getElementById: (id) => {
                if (id === 'sorted-bins-list-container') return mockContainer;
                return null;
            },
            querySelectorAll: () => []
        },
        console: console,
        FormData: class {
            constructor() { this.entries = []; }
            append(k, v) { this.entries.push([k, v]); }
        }
    };
    sandbox.window = sandbox;
    sandbox.getCapturedSortedBinsHtml = () => capturedSortedBinsHtml;

    const transCode = fs.readFileSync(path.join(__dirname, '../static/js/data/translations.js'), 'utf8');
    vm.runInNewContext(transCode, sandbox);

    const wasteDbCode = fs.readFileSync(path.join(__dirname, '../static/js/data/waste-database.js'), 'utf8');
    vm.runInNewContext(wasteDbCode, sandbox);

    const visionModCode = fs.readFileSync(path.join(__dirname, '../static/js/modules/vision-module.js'), 'utf8');
    vm.runInNewContext(visionModCode, sandbox);

    const evalUiCode = fs.readFileSync(path.join(__dirname, '../static/js/modules/evaluation-ui.js'), 'utf8');
    vm.runInNewContext(evalUiCode, sandbox);

    return sandbox;
}

test('P2-2: VisionModule does not fabricate 18.5ms latency when backend returns null', async () => {
    const sandbox = loadEnvironment();
    const { VisionModule } = sandbox;
    const vmInstance = new VisionModule();

    // Mock fetch returning backend response with inference_time_ms = null
    sandbox.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => ({
            status: 'success',
            class_name: 'paper',
            material: 'Paper',
            confidence: 95,
            inference_time_ms: null,
            top_k: []
        })
    });

    const file = { size: 100, type: 'image/jpeg' };
    const result = await vmInstance.classifyWithBackend(file);

    assert.equal(result.inferenceTimeMs, null, 'inferenceTimeMs must be null when backend does not provide it');
});

test('P2-2: EvaluationUI sorted bins HTML contains zero inline onclick handlers', () => {
    const sandbox = loadEnvironment();
    const { EvaluationUI } = sandbox;
    const evalUI = new EvaluationUI();

    evalUI.renderSortedBinsTable([
        { nodeId: 'ai', name: 'كلية الذكاء الاصطناعي', binLabel: 'ورق', distance: 0, available: true }
    ]);

    const capturedHtml = sandbox.getCapturedSortedBinsHtml();
    assert.ok(capturedHtml.length > 0);
    assert.equal(capturedHtml.includes('onclick='), false, 'Generated HTML must not have inline onclick');
    assert.ok(capturedHtml.includes('btn-navigate-target'), 'Should use class-based target button');
    assert.ok(capturedHtml.includes('data-target-node="ai"'), 'Should use data attribute for node id');
});

test('P2-2: Translations contain localized Step 3 algorithm toasts in ar and en', () => {
    const { ECOSORT_TRANSLATIONS } = loadEnvironment();

    assert.ok(ECOSORT_TRANSLATIONS.ar.toastDijkstraTitle);
    assert.ok(ECOSORT_TRANSLATIONS.ar.toastAStarTitle);
    assert.ok(ECOSORT_TRANSLATIONS.ar.toastNoRouteTitle);

    assert.ok(ECOSORT_TRANSLATIONS.en.toastDijkstraTitle);
    assert.ok(ECOSORT_TRANSLATIONS.en.toastAStarTitle);
    assert.ok(ECOSORT_TRANSLATIONS.en.toastNoRouteTitle);
});
