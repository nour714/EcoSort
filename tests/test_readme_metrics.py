# -*- coding: utf-8 -*-
"""
Test metric consistency between per-class metrics and A/B experiments summary.
Prevents silent divergence between baseline results and experiment reports.
"""
import os
import json
import re
import pytest

def test_per_class_matches_baseline_experiment():
    metrics_path = os.path.join("docs", "metrics", "per_class_metrics.json")
    experiments_path = os.path.join("docs", "metrics", "ab_experiments.json")

    assert os.path.exists(metrics_path), f"Missing {metrics_path}"
    assert os.path.exists(experiments_path), f"Missing {experiments_path}"

    with open(metrics_path, "r", encoding="utf-8") as f:
        per_class_data = json.load(f)

    with open(experiments_path, "r", encoding="utf-8") as f:
        experiments_data = json.load(f)

    baseline_exps = [e for e in experiments_data if e["name"].startswith("Baseline")]
    assert len(baseline_exps) == 1, "Baseline experiment not found or duplicated in ab_experiments.json"
    baseline = baseline_exps[0]

    # Baseline overall accuracy must strictly match per_class_metrics overall_accuracy
    assert per_class_data["overall_accuracy"] == pytest.approx(baseline["accuracy"], abs=0.01)
    assert per_class_data["norm_mode"] == "zero_one"
    assert per_class_data["resize_mode"] == "direct"
    assert per_class_data["tta_used"] is False
    assert per_class_data["total_samples"] == 300

    # Ensure gating results are present and sum up to total evaluated samples
    assert "gating" in per_class_data
    gating = per_class_data["gating"]
    total_gated = sum(gating[k]["count"] for k in ["confident", "uncertain", "rejected"])
    assert total_gated == per_class_data["total_samples"]


def test_readme_gating_counts_match_metrics():
    """
    Ensure the README confidence gating table numbers strictly match
    the authoritative docs/metrics/per_class_metrics.json file.
    """
    readme_path = "README.md"
    metrics_path = os.path.join("docs", "metrics", "per_class_metrics.json")
    assert os.path.exists(readme_path), f"Missing {readme_path}"
    assert os.path.exists(metrics_path), f"Missing {metrics_path}"

    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)
    gating = metrics["gating"]

    with open(readme_path, "r", encoding="utf-8") as f:
        readme_text = f.read()

    for state in ["confident", "uncertain", "rejected"]:
        pattern = rf"\|\s*\*\*`{state}`\*\*\s*\|[^|]+\|\s*(\d+)\s*\|\s*([\d\.]+)%\s*\|\s*(\*\*[\d\.]+%\*\*|[\d\.]+%)\s*\|"
        match = re.search(pattern, readme_text)
        assert match is not None, f"Could not find gating table row for {state} in README.md"
        count = int(match.group(1))
        expected_count = gating[state]["count"]
        assert count == expected_count, (
            f"README gating count for '{state}' is {count}, but metrics file specifies {expected_count}"
        )
