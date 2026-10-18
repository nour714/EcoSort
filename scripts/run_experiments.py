# -*- coding: utf-8 -*-
"""
Run systematic A/B experiments on EcoSort model:
1. Normalization: [0, 1] vs [0, 255] vs [-1, 1]
2. Resize Strategy: direct vs center-crop vs pad
3. TTA: enabled vs disabled
"""
import os
import subprocess
import re
import json
import tempfile

experiments = [
    {"name": "Baseline (norm=0..1, resize=direct, no-tta)", "norm": "zero_one", "resize": "direct", "tta": False},
    {"name": "Norm=[0..255] raw (resize=direct, no-tta)", "norm": "raw", "resize": "direct", "tta": False},
    {"name": "Norm=[-1..1] signed (resize=direct, no-tta)", "norm": "signed", "resize": "direct", "tta": False},
    {"name": "Resize=crop (norm=0..1, no-tta)", "norm": "zero_one", "resize": "crop", "tta": False},
    {"name": "Resize=pad (norm=0..1, no-tta)", "norm": "zero_one", "resize": "pad", "tta": False},
    {"name": "TTA=True (norm=0..1, resize=direct)", "norm": "zero_one", "resize": "direct", "tta": True},
]

results = []

for exp in experiments:
    is_baseline = (exp["name"].startswith("Baseline"))
    if is_baseline:
        out_dir = "docs/metrics"
    else:
        out_dir = os.path.join(tempfile.gettempdir(), "ecosort_exp")
        os.makedirs(out_dir, exist_ok=True)

    cmd = ["python", "scripts/evaluate.py", "--norm", exp["norm"], "--resize-mode", exp["resize"], "--output-dir", out_dir]
    if exp["tta"]:
        cmd.append("--tta")

    print(f"\n---> Running: {exp['name']}...")
    out = subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT)
    match = re.search(r"RESULT: accuracy=([\d\.]+) f1=([\d\.]+) ece=([\d\.]+)", out)
    if match:
        acc = float(match.group(1))
        f1 = float(match.group(2))
        ece = float(match.group(3))
        results.append({
            "name": exp["name"],
            "norm": exp["norm"],
            "resize": exp["resize"],
            "tta": exp["tta"],
            "accuracy": acc,
            "f1": f1,
            "ece": ece
        })
        print(f"Result: Accuracy={acc:.2f}%, F1={f1:.2f}%, ECE={ece:.4f}")
    else:
        print("Could not parse result!")

print("\n=======================================================")
print("EXPERIMENT SUMMARY TABLE (A/B Comparisons)")
print("=======================================================")
print(f"{'Configuration':<42} | {'Accuracy':<10} | {'F1-Score':<10} | {'ECE':<8}")
print("-" * 76)
for r in results:
    print(f"{r['name']:<42} | {r['accuracy']:<9.2f}% | {r['f1']:<9.2f}% | {r['ece']:<8.4f}")

with open("docs/metrics/ab_experiments.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2)
print("\nSaved experiments to docs/metrics/ab_experiments.json")
