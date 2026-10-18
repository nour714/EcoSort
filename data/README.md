# EcoSort Datasets Directory

This directory contains the image datasets and benchmarking fixtures utilized by the EcoSort intelligent waste sorting and routing platform.

---

## Directory Organization

```text
data/
├── README.md               # Dataset documentation and evaluation guide
├── benchmark/              # Standardized 300-image evaluation dataset (tracked)
│   ├── cardboard/          # 50 samples
│   ├── glass/              # 50 samples
│   ├── metal/              # 50 samples
│   ├── paper/              # 50 samples
│   ├── plastic/            # 50 samples
│   └── trash/              # 50 samples
├── campus_photos/          # Real-world campus photographs (tracked via .gitkeep)
│   ├── README.md           # Instructions for capturing and organizing photos
│   └── {cardboard,glass,metal,paper,plastic,trash}/
└── raw/                    # Download cache and full unzipped archives (gitignored)
```

---

## 1. Benchmark Dataset (`data/benchmark/`)

* **Origin**: 300 balanced samples selected from the standard Gary Thung TrashNet dataset (50 samples per class across all 6 classes).
* **Purpose**: Serves as the standardized regression and performance benchmark for the classification and confidence gating pipelines.
* **Provenance Note**: The exact train/validation/test split utilized during the historical training of `models/model.keras` cannot be independently verified. Consequently, metrics evaluated on this set reflect in-distribution performance and represent an optimistic upper bound.
* **Evaluation Command**:
  ```bash
  python scripts/evaluate.py --data data/benchmark --model models/model.keras
  ```

---

## 2. Campus Photos Dataset (`data/campus_photos/`)

* **Origin**: Real-world smartphone captures collected directly across the Kafrelsheikh University campus (cafeterias, hallways, outdoor paths, and disposal stations).
* **Purpose**: Dedicated out-of-distribution evaluation set to measure real-world performance under diverse ambient lighting, non-uniform backgrounds, and variable perspective angles.
* **Adding Real Photos**:
  1. Capture clear photos of recyclable or refuse items in campus environments.
  2. Save photos in JPEG or PNG format.
  3. Place files in the corresponding category directory under `data/campus_photos/<class>/`.
* **Evaluation Command**:
  ```bash
  python scripts/evaluate.py --data data/campus_photos --output-dir docs/metrics/campus_benchmark
  ```

---

## 3. Raw Cache (`data/raw/`)

* **Purpose**: Temporary staging directory and download cache for complete raw dataset archives (e.g. `dataset-resized.zip` and the unzipped TrashNet directory).
* **Version Control**: Ignored by git (`data/raw/` in `.gitignore`) to prevent repository bloat while supporting reproducible local pipelines via `scripts/download_dataset.py`.
