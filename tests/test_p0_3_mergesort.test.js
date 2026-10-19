const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('P0-3: Merge Sort list retains user own-location bin at distance 0', () => {
    const rootDir = path.resolve(__dirname, '..');
    const files = [
        'static/js/data/campus-graph.js',
        'static/js/algorithms/dijkstra.js',
        'static/js/algorithms/a-star.js',
        'static/js/algorithms/merge-sort.js',
        'static/js/modules/evaluation-ui.js'
    ];

    const sandbox = { window: {}, console: console, performance: { now: () => Date.now() } };
    sandbox.window = sandbox;
    vm.createContext(sandbox);

    for (const file of files) {
        const code = fs.readFileSync(path.join(rootDir, file), 'utf8');
        vm.runInContext(code, sandbox);
    }

    const graph = new sandbox.CampusGraph(sandbox.CAMPUS_GRAPH_DATA);
    const evalUI = new sandbox.EvaluationUI();

    // Node 'ai' has available plastic bin
    assert.strictEqual(graph.hasAvailableBin('ai', 'plastic'), true);

    const evaluation = evalUI.evaluateAll(graph, 'ai', 'plastic');
    assert.ok(evaluation.sortedBins && evaluation.sortedBins.length > 0, 'sortedBins must not be empty');

    // First sorted bin must be the start node ('ai') with distance 0
    const firstBin = evaluation.sortedBins[0];
    assert.strictEqual(firstBin.nodeId, 'ai', `Expected sortedBins[0] to be "ai", got "${firstBin.nodeId}"`);
    assert.strictEqual(firstBin.distance, 0, `Expected sortedBins[0] distance to be 0, got ${firstBin.distance}`);

    // Test with another node that has an available bin, e.g., 'eng' with metal bin
    assert.strictEqual(graph.hasAvailableBin('eng', 'metal'), true);
    const engEvaluation = evalUI.evaluateAll(graph, 'eng', 'metal');
    assert.strictEqual(engEvaluation.sortedBins[0].nodeId, 'eng');
    assert.strictEqual(engEvaluation.sortedBins[0].distance, 0);
});
