# -*- coding: utf-8 -*-
"""
Pytest wrapper for P1-2: Binary min-heap priority queue in Dijkstra and A*.
Executes node test tests/test_p1_2_min_heap.test.js.
"""
import subprocess
from pathlib import Path


def test_node_p1_2_min_heap():
    root_dir = Path(__file__).resolve().parent.parent
    test_file = root_dir / 'tests' / 'test_p1_2_min_heap.test.js'
    result = subprocess.run(
        ['node', '--test', str(test_file)],
        cwd=str(root_dir),
        capture_output=True,
        text=True
    )
    assert result.returncode == 0, f"Node test failed with stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
