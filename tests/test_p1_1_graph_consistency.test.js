import test from 'node:test';
import assert from 'node:assert/strict';

import { CampusGraph, CAMPUS_GRAPH_DATA } from '../static/js/data/campus-graph.js';
import DijkstraAlgorithm from '../static/js/algorithms/dijkstra.js';
import AStarAlgorithm from '../static/js/algorithms/a-star.js';

test('P1-1: every edge weight >= straight-line haversine distance', () => {
    const graph = new CampusGraph();
    const edges = graph.getAllEdges();
    assert.strictEqual(edges.length, 25, 'Expected 25 campus edges');

    for (const edge of edges) {
        const u = graph.getNode(edge.from);
        const v = graph.getNode(edge.to);
        assert.ok(u, `Source node ${edge.from} must exist`);
        assert.ok(v, `Target node ${edge.to} must exist`);

        const hDist = CampusGraph.haversineDistance(u.lat, u.lng, v.lat, v.lng);
        assert.ok(
            edge.weight >= hDist,
            `Edge ${edge.from}-${edge.to} weight (${edge.weight}m) must be >= haversine distance (${hDist.toFixed(2)}m)`
        );
    }
});

test('P1-1: A* heuristic is admissible (h <= h*) and consistent (h(u) <= c(u,v) + h(v))', () => {
    const graph = new CampusGraph();
    const nodes = graph.getAllNodes();
    const edges = graph.getAllEdges();

    // Check single target and multi-target scenarios
    for (const target of nodes) {
        const targetIds = [target.id];

        // Admissibility: h(u) <= shortest path distance from u to target
        for (const u of nodes) {
            const hVal = AStarAlgorithm.computeHeuristic(graph, u.id, targetIds);
            const dijkstraResult = DijkstraAlgorithm.findShortestPath(graph, u.id, targetIds);
            assert.ok(
                hVal <= dijkstraResult.totalDistance + 1e-6,
                `Heuristic from ${u.id} to ${target.id} (${hVal}) exceeds optimal distance (${dijkstraResult.totalDistance})`
            );
        }

        // Consistency: for every edge (u, v), |h(u) - h(v)| <= weight(u, v)
        for (const edge of edges) {
            const hu = AStarAlgorithm.computeHeuristic(graph, edge.from, targetIds);
            const hv = AStarAlgorithm.computeHeuristic(graph, edge.to, targetIds);
            assert.ok(
                hu <= edge.weight + hv + 1e-6,
                `Heuristic not consistent across edge ${edge.from}->${edge.to}: ${hu} > ${edge.weight} + ${hv}`
            );
            assert.ok(
                hv <= edge.weight + hu + 1e-6,
                `Heuristic not consistent across edge ${edge.to}->${edge.from}: ${hv} > ${edge.weight} + ${hu}`
            );
        }
    }
});

test('P1-1: A* == Dijkstra on 1000 random bin-availability states', () => {
    const graph = new CampusGraph();
    const nodes = graph.getAllNodes();
    const nodeIds = nodes.map(n => n.id);

    // Seeded pseudo-random generator for 100% reproducible test runs
    let seed = 42;
    function rand() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    }

    const ITERATIONS = 1000;
    let exactMatches = 0;

    for (let i = 0; i < ITERATIONS; i++) {
        // Pick random start node
        const startIndex = Math.floor(rand() * nodeIds.length);
        const startId = nodeIds[startIndex];

        // Pick random subset of available bin targets (at least 1, up to all)
        const targets = nodeIds.filter(() => rand() < 0.35);
        if (targets.length === 0) {
            targets.push(nodeIds[Math.floor(rand() * nodeIds.length)]);
        }

        const dijk = DijkstraAlgorithm.findShortestPath(graph, startId, targets);
        const astar = AStarAlgorithm.findShortestPath(graph, startId, targets);

        assert.strictEqual(
            dijk.found,
            astar.found,
            `Iteration ${i}: 'found' flag mismatch between Dijkstra and A*`
        );
        assert.strictEqual(
            dijk.totalDistance,
            astar.totalDistance,
            `Iteration ${i}: totalDistance mismatch between Dijkstra (${dijk.totalDistance}) and A* (${astar.totalDistance}) from ${startId} to [${targets.join(',')}]`
        );

        exactMatches++;
    }

    assert.strictEqual(exactMatches, ITERATIONS, 'All 1000 random states must match identically');
});
