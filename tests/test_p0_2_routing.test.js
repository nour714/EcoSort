const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('P0-2: General trash routing and campus bin availability', () => {
    const rootDir = path.resolve(__dirname, '..');
    const wasteDbContent = fs.readFileSync(path.join(rootDir, 'static/js/data/waste-database.js'), 'utf8');
    const campusGraphContent = fs.readFileSync(path.join(rootDir, 'static/js/data/campus-graph.js'), 'utf8');
    const visionModuleContent = fs.readFileSync(path.join(rootDir, 'static/js/modules/vision-module.js'), 'utf8');

    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(wasteDbContent, sandbox);
    vm.runInContext(campusGraphContent, sandbox);
    vm.runInContext(visionModuleContent, sandbox);

    const db = sandbox.window.WASTE_DATABASE;
    const graph = new sandbox.window.CampusGraph(sandbox.window.CAMPUS_GRAPH_DATA);
    const vision = new sandbox.window.VisionModule();

    // 1. mixed_trash must have binType === 'trash' and never resolve to 'organic'
    const mixedTrash = db.find(w => w.id === 'mixed_trash');
    assert.ok(mixedTrash, 'mixed_trash must exist in WASTE_DATABASE');
    assert.strictEqual(mixedTrash.binType, 'trash', 'mixed_trash binType must be "trash"');
    assert.notStrictEqual(mixedTrash.binType, 'organic', 'mixed_trash must never resolve to "organic"');

    // 2. VisionModule mapping for 'trash' class must resolve to mixed_trash / trash binType, not organic
    const mapped = vision.mapBackendClassToWasteItem('trash');
    assert.strictEqual(mapped.binType, 'trash', 'Backend trash class must map to an item with binType "trash"');
    assert.notStrictEqual(mapped.binType, 'organic', 'Backend trash class must never map to "organic"');

    // 3. For every WASTE_DATABASE binType, there is >=1 node with an available bin
    const uniqueBinTypes = [...new Set(db.map(w => w.binType))];
    assert.ok(uniqueBinTypes.includes('trash'), 'Unique binTypes must include "trash"');

    for (const binType of uniqueBinTypes) {
        const targetNodes = graph.getTargetNodesForWaste(binType);
        assert.ok(
            targetNodes.length >= 1,
            `Every WASTE_DATABASE binType must have >=1 node with an available bin (failed for: ${binType})`
        );
    }

    // 4. Every campus node has a general-waste ('trash') bin
    for (const node of graph.getAllNodes()) {
        const trashBin = node.bins.find(b => b.type === 'trash');
        assert.ok(trashBin, `Campus node "${node.id}" must have a trash bin`);
        assert.ok(trashBin.label, `Trash bin in "${node.id}" must have label`);
        assert.ok(trashBin.labelEn, `Trash bin in "${node.id}" must have labelEn`);
    }
});
