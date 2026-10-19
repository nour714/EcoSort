import test from 'node:test';
import assert from 'node:assert/strict';

import BinaryMinHeap from '../static/js/algorithms/priority-queue.js';
import { CampusGraph } from '../static/js/data/campus-graph.js';
import DijkstraAlgorithm from '../static/js/algorithms/dijkstra.js';
import AStarAlgorithm from '../static/js/algorithms/a-star.js';

test('P1-2: BinaryMinHeap basic operations and min-heap invariant', () => {
    const heap = new BinaryMinHeap();
    assert.strictEqual(heap.isEmpty(), true);
    assert.strictEqual(heap.size, 0);
    assert.strictEqual(heap.pop(), null);
    assert.strictEqual(heap.peek(), null);

    const values = [
        { item: 'node_50', priority: 50 },
        { item: 'node_10', priority: 10 },
        { item: 'node_40', priority: 40 },
        { item: 'node_5',  priority: 5 },
        { item: 'node_20', priority: 20 },
        { item: 'node_15', priority: 15 },
        { item: 'node_30', priority: 30 }
    ];

    values.forEach(v => heap.push(v.item, v.priority));
    assert.strictEqual(heap.size, 7);
    assert.strictEqual(heap.isEmpty(), false);
    assert.strictEqual(heap.peek().item, 'node_5');
    assert.strictEqual(heap.peek().priority, 5);

    const extracted = [];
    while (!heap.isEmpty()) {
        extracted.push(heap.pop());
    }

    assert.strictEqual(extracted.length, 7);
    for (let i = 0; i < extracted.length - 1; i++) {
        assert.ok(
            extracted[i].priority <= extracted[i + 1].priority,
            `Heap violated min-order: ${extracted[i].priority} > ${extracted[i + 1].priority}`
        );
    }
    assert.strictEqual(extracted[0].item, 'node_5');
    assert.strictEqual(extracted[extracted.length - 1].item, 'node_50');
});

test('P1-2: Dijkstra and A* report O((V + E) log V) and find optimal paths', () => {
    const graph = new CampusGraph();
    const nodes = graph.getAllNodes();
    const nodeIds = nodes.map(n => n.id);

    // Verify complexity strings
    const sampleDijk = DijkstraAlgorithm.findShortestPath(graph, 'gate', ['ai']);
    assert.strictEqual(sampleDijk.complexity, 'O((V + E) log V)');

    const sampleAstar = AStarAlgorithm.findShortestPath(graph, 'gate', ['ai']);
    assert.ok(
        sampleAstar.complexity.includes('O(V log V)'),
        `A* complexity must document O(V log V), got: ${sampleAstar.complexity}`
    );

    // Verify calculateAllDistances correctness
    const allDist = DijkstraAlgorithm.calculateAllDistances(graph, 'gate');
    assert.strictEqual(allDist.get('gate'), 0);
    assert.ok(allDist.get('ai') > 0 && allDist.get('ai') < Infinity);

    // Verify all pairs shortest paths match identically between Dijkstra and A*
    for (const start of nodeIds) {
        for (const target of nodeIds) {
            const dResult = DijkstraAlgorithm.findShortestPath(graph, start, [target]);
            const aResult = AStarAlgorithm.findShortestPath(graph, start, [target]);

            assert.strictEqual(dResult.found, aResult.found);
            assert.strictEqual(
                dResult.totalDistance,
                aResult.totalDistance,
                `Distance mismatch from ${start} to ${target}`
            );
        }
    }
});
