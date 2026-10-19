# -*- coding: utf-8 -*-
"""
Pytest wrapper for P1-1: Graph consistency, admissibility, and A* vs Dijkstra equivalence.
Executes node test tests/test_p1_1_graph_consistency.test.js.
"""
import subprocess
from pathlib import Path


def test_node_p1_1_graph_consistency():
    root_dir = Path(__file__).resolve().parent.parent
    test_file = root_dir / 'tests' / 'test_p1_1_graph_consistency.test.js'
    result = subprocess.run(
        ['node', '--test', str(test_file)],
        cwd=str(root_dir),
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Node test failed with stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
