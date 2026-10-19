const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('P0-5: Quality warnings map real backend codes and never expose raw codes', () => {
    const rootDir = path.resolve(__dirname, '..');
    const appJsContent = fs.readFileSync(path.join(rootDir, 'static/js/app.js'), 'utf8');

    // Minimal DOM mocking to execute handleWasteDetected in Node.js
    const elements = {};
    const getMockElement = (id) => {
        if (!elements[id]) {
            elements[id] = {
                id,
                classList: {
                    _classes: new Set(),
                    add(...cls) { cls.forEach(c => this._classes.add(c)); },
                    remove(...cls) { cls.forEach(c => this._classes.delete(c)); },
                    contains(c) { return this._classes.has(c); }
                },
                style: {},
                children: [],
                innerHTML: '',
                textContent: '',
                appendChild(child) { this.children.push(child); },
                setAttribute() {}
            };
        }
        return elements[id];
    };

    const sandbox = {
        window: {},
        localStorage: {
            getItem: () => null,
            setItem: () => {}
        },
        document: {
            addEventListener: () => {},
            getElementById: (id) => getMockElement(id),
            querySelector: (sel) => getMockElement(sel),
            querySelectorAll: () => [],
            createElement: (tag) => ({
                tag,
                children: [],
                classList: { add() {}, remove() {} },
                style: {},
                textContent: '',
                innerHTML: '',
                appendChild(c) { this.children.push(c); },
                addEventListener() {}
            })
        },
        console: console,
        ECOSORT_TRANSLATIONS: {
            ar: {},
            en: {}
        }
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);

    // Load dependencies first
    const depFiles = [
        'static/js/data/waste-database.js',
        'static/js/data/campus-graph.js',
        'static/js/modules/vision-module.js'
    ];
    for (const f of depFiles) {
        const code = fs.readFileSync(path.join(rootDir, f), 'utf8');
        vm.runInContext(code, sandbox);
    }

    // Load EcoSortApp
    vm.runInContext(appJsContent, sandbox);

    const testCases = [
        'image_blurry',
        'image_too_dark',
        'image_too_bright',
        'image_empty_or_flat',
        'unknown_custom_warning_code'
    ];

    const mockItem = {
        id: 'cardboard_box',
        name: 'صندوق كرتون',
        nameEn: 'Cardboard Box',
        binType: 'paper',
        binColorName: 'الزرقاء',
        binColorHex: '#2563eb'
    };

    const detection = {
        item: mockItem,
        isPreset: false,
        confidence: 50.0,
        decision: 'uncertain',
        qualityWarnings: testCases,
        topK: []
    };

    const ctx = { currentLang: 'ar' };
    sandbox.window.EcoSortApp.prototype.handleWasteDetected.call(ctx, detection);

    const warningsList = getMockElement('cv-quality-warnings-list');
    assert.strictEqual(warningsList.children.length, testCases.length);

    warningsList.children.forEach((child, idx) => {
        const rawCode = testCases[idx];
        const renderedText = child.textContent;

        // Rendered text must never be the raw code
        assert.notStrictEqual(
            renderedText,
            rawCode,
            `Warning item must not display raw code "${rawCode}"`
        );
        assert.ok(renderedText.length > 5, `Warning text should be a descriptive message: got "${renderedText}"`);
    });

    // Verify unknown code receives generic translated message
    const unknownChild = warningsList.children[4];
    assert.ok(
        !unknownChild.textContent.includes('unknown_custom_warning_code'),
        'Unknown code must not be exposed in user-facing message'
    );
});
