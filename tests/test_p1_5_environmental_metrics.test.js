const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadEnvironment() {
    const sandbox = {
        window: {},
        document: {
            getElementById: () => null
        },
        console: console
    };
    sandbox.window = sandbox;

    const wasteDbCode = fs.readFileSync(path.join(__dirname, '../static/js/data/waste-database.js'), 'utf8');
    vm.runInNewContext(wasteDbCode, sandbox);

    const visionModCode = fs.readFileSync(path.join(__dirname, '../static/js/modules/vision-module.js'), 'utf8');
    vm.runInNewContext(visionModCode, sandbox);

    return sandbox;
}

test('P1-5: Paper and cardboard items have unified blue bin color (#2563eb)', () => {
    const { WASTE_DATABASE, IR_EXPANDED_CATALOG } = loadEnvironment();

    const paperItems = [...WASTE_DATABASE, ...IR_EXPANDED_CATALOG].filter(item => item.binType === 'paper');
    assert.ok(paperItems.length >= 2, 'Should have paper items');

    for (const item of paperItems) {
        assert.equal(item.binColorHex, '#2563eb', `Item ${item.id} must have blue binColorHex #2563eb`);
        assert.match(item.binColorName, /زرق|blue/i, `Item ${item.id} binColorName must reference Blue`);
    }
});

test('P1-5: Canonical CO2 and water metrics match single source of truth', () => {
    const { WASTE_DATABASE } = loadEnvironment();

    const cardboard = WASTE_DATABASE.find(item => item.id === 'cardboard_box');
    assert.equal(cardboard.carbonSavingsGrams, 140);
    assert.equal(cardboard.waterSavingsLiters, 7.5);
    assert.ok(cardboard.metricSource);

    const paper = WASTE_DATABASE.find(item => item.id === 'paper_sheet');
    assert.equal(paper.carbonSavingsGrams, 60);
    assert.equal(paper.waterSavingsLiters, 4.0);
    assert.ok(paper.metricSource);

    const glass = WASTE_DATABASE.find(item => item.id === 'glass_bottle');
    assert.equal(glass.carbonSavingsGrams, 110);
    assert.equal(glass.waterSavingsLiters, 1.5);
    assert.ok(glass.metricSource);

    const metal = WASTE_DATABASE.find(item => item.id === 'alu_can');
    assert.equal(metal.carbonSavingsGrams, 175);
    assert.equal(metal.waterSavingsLiters, 5.2);
    assert.ok(metal.metricSource);

    const plastic = WASTE_DATABASE.find(item => item.id === 'generic_plastic');
    assert.equal(plastic.carbonSavingsGrams, 85);
    assert.equal(plastic.waterSavingsLiters, 2.1);
    assert.equal(plastic.resinCode, null);
    assert.ok(plastic.metricSource);

    const trash = WASTE_DATABASE.find(item => item.id === 'mixed_trash');
    assert.equal(trash.carbonSavingsGrams, 15);
    assert.equal(trash.waterSavingsLiters, 0.5);
    assert.ok(trash.metricSource);
});

test('P1-5: TrashNet plastic class maps to generic_plastic without resin code unless user picks PET/HDPE', () => {
    const { VisionModule, WASTE_DATABASE } = loadEnvironment();
    const vmInstance = new VisionModule();

    // Generic TrashNet prediction: class 'plastic', material 'Plastic'
    const defaultPlastic = vmInstance.mapBackendClassToWasteItem('plastic', 'Plastic');
    assert.equal(defaultPlastic.id, 'generic_plastic');
    assert.equal(defaultPlastic.resinCode, null);

    // Only explicit user/model selection of PET produces PET bottle
    const petItem = vmInstance.mapBackendClassToWasteItem('plastic', 'PET');
    assert.equal(petItem.id, 'pet_bottle');
    assert.ok(petItem.resinCode);

    // Explicit HDPE produces HDPE container
    const hdpeItem = vmInstance.mapBackendClassToWasteItem('plastic', 'HDPE');
    assert.equal(hdpeItem.id, 'hdpe_container');
    assert.ok(hdpeItem.resinCode);
});
