# EcoSort — Smart Waste Classification & Campus Pathfinding System
### Kafrelsheikh University — Faculty of Artificial Intelligence

EcoSort is an intelligent waste sorting and pathfinding platform that bridges Computer Vision, Confidence Gating, Environmental Information Retrieval (IR), and graph routing algorithms (Dijkstra and A*) to direct university students to the nearest available, un-filled recycling bin.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Wizard User Flow](#wizard-user-flow)
- [Empirical Evaluation & Benchmarks](#empirical-evaluation--benchmarks)
- [Confidence Gating & Reliability Policies](#confidence-gating--reliability-policies)
- [Graph Routing & Ranking Algorithms](#graph-routing--ranking-algorithms)
- [API Reference](#api-reference)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Docker Deployment](#docker-deployment)
- [Deployment: Flask vs Vercel](#deployment-flask-vs-vercel)
- [Transfer Learning Pipeline](#transfer-learning-pipeline)
- [Academic Resources](#academic-resources)

---

## Project Overview

Universities face critical waste sorting challenges: recyclable items (plastics, paper, aluminum) are frequently mixed into general trash at the point of disposal, rendering recycling economically unviable. Furthermore, students often find the nearest recycling bin full, leading to improper disposal.

**EcoSort resolves this challenge with an end-to-end pipeline:**
1. **Visual Material Classification**: A deep learning model (`.keras` / `.tflite`) identifies the material category from mobile camera captures.
2. **Information Retrieval (IR)**: Retrieves resin codes, proper handling procedures, and calculated environmental savings (CO₂ avoided, water conserved, LED lighting equivalent).
3. **Smart Campus Navigation**: Graph pathfinding calculates the shortest walking route to an available bin, dynamically bypassing full receptacles.

---

## Key Features

- **Lightweight Thread-Safe Backend**: Python Flask application hosting a native Keras 3 model via a thread-safe singleton inference engine, with serverless Vercel edge runtime via Google LiteRT.
- **Dual-Tier Reliability Guardrails**: Pre-inference statistical checks filter motion blur, under/overexposure, and blank captures before neural inference.
- **Calibrated Confidence Gating**: Classifies predictions into `confident` (`P1 >= 75%`, `margin >= 20%`), `uncertain`, or `rejected` (`P1 < 45%`) states.
- **Client-Side Image Preprocessing**: Automatic EXIF orientation correction, client-side downscaling (max 1024px), and alpha compositing over white backgrounds.
- **Dynamic Graph Pathfinding**: Implementation of Dijkstra's algorithm and heuristic A* search over Kafrelsheikh University's 12-landmark pedestrian network with real-time rerouting when bins fill up.
- **Guaranteed O(n log n) Bin Ranking**: Pure JavaScript Merge Sort ranks campus bins by walking distance.
- **Complete Bilingual Interface**: Full Arabic (RTL) and English (LTR) language support across UI components, notices, and documentation.

---

## System Architecture

```mermaid
flowchart TD
    Client["Client Browser (Vanilla JS + HTML5 Canvas Graph)"]
    Camera["Camera Capture / File Upload / Clipboard"] --> Client
    Client -->|"POST /predict (Multipart Form)"| Flask["Flask Backend Server (app.py)"]
    
    subgraph Backend Pipeline
        Flask --> Quality["Image Quality Guardrails\n(Blur, Luminance, Flatness)"]
        Quality --> Preproc["Preprocessing & Normalization\n(EXIF Transpose, Direct Bilinear, [0, 1])"]
        Preproc --> ModelEngine["ModelEngine Singleton\n(Keras 3 CNN &bull; models/model.keras)"]
        ModelEngine --> Softmax["Softmax Output Distribution (6 Classes)"]
        Softmax --> Gating["Confidence Gating Engine\n(Confident &bull; Uncertain &bull; Rejected)"]
        Gating --> IR["Information Retrieval & Carbon Registry\n(Resin Codes, CO2 Math, Recycling Guide)"]
    end
    
    IR -->|"JSON Response"| Client
    Client --> Pathfinding["Graph Pathfinding Engine\n(Dijkstra &bull; A* &bull; Merge Sort)"]
    Pathfinding --> MapUI["Interactive Campus Map & Live Step Route"]
```

---

## Wizard User Flow

```mermaid
flowchart LR
    Step1["Step 1: Select Location\nPick current faculty node or simulate GPS"] --> Step2["Step 2: Inspect Waste\nCapture photo, run CV, verify IR guide"]
    Step2 --> Step3["Step 3: Route & Navigate\nCalculate shortest path to nearest available bin"]
```

---

## Empirical Evaluation & Benchmarks

The deployed baseline configuration was evaluated on 300 samples across the 6 standard TrashNet classes (50 samples per class) using `scripts/evaluate.py`.

### System Baseline Performance

| Metric | Measured Baseline Value |
|---|---|
| **Overall Accuracy** | **81.67%** |
| **Macro Average F1-Score** | **81.67%** |
| **Weighted Average F1-Score** | **81.67%** |
| **Expected Calibration Error (ECE)** | **0.0991** |
| **Average Inference Latency** | **26.04 ms/sample** |
| **Normalization Mode** | `[0, 1]` (`/255.0`) |
| **Resize Strategy** | Direct Bilinear (224x224) |
| **Test-Time Augmentation (TTA)** | Disabled (Production Default) |

### Per-Class Performance Table

| Class | Precision (%) | Recall (%) | F1-Score (%) | Support |
|---|---|---|---|---|
| **Cardboard** | 97.87% | 92.00% | 94.85% | 50 |
| **Glass** | 76.36% | 84.00% | 80.00% | 50 |
| **Metal** | 92.31% | 72.00% | 80.90% | 50 |
| **Paper** | 72.88% | 86.00% | 78.90% | 50 |
| **Plastic** | 77.27% | 68.00% | 72.34% | 50 |
| **Trash** | 78.57% | 88.00% | 83.02% | 50 |
| **Macro average** | **82.54%** | **81.67%** | **81.67%** | **300** |
| **Weighted average** | **82.54%** | **81.67%** | **81.67%** | **300** |

### Confusion Matrix

Evaluated counts across actual (rows) versus predicted (columns) classes:

| Actual \ Predicted | Cardboard | Glass | Metal | Paper | Plastic | Trash | Total |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Cardboard** | 46 | 0 | 1 | 0 | 2 | 1 | 50 |
| **Glass** | 0 | 42 | 1 | 2 | 4 | 1 | 50 |
| **Metal** | 1 | 6 | 36 | 2 | 2 | 3 | 50 |
| **Paper** | 0 | 3 | 0 | 43 | 1 | 3 | 50 |
| **Plastic** | 0 | 2 | 1 | 9 | 34 | 4 | 50 |
| **Trash** | 0 | 2 | 0 | 3 | 1 | 44 | 50 |
| **Total** | 47 | 55 | 39 | 59 | 44 | 56 | 300 |

### Systematic A/B Experiments Summary

Automated parameter experiments recorded in `docs/metrics/ab_experiments.json`:

| Configuration | Normalization | Resize Strategy | TTA | Accuracy (%) | F1-Score (%) | ECE |
|---|---|---|---|---|---|---|
| **Baseline (Deployed)** | **`zero_one` [0..1]** | **`direct`** | **False** | **81.67%** | **81.67%** | **0.0991** |
| Raw Pixel Scaling | `raw` [0..255] | `direct` | False | 33.67% | 27.31% | 0.6625 |
| Signed Normalization | `signed` [-1..1] | `direct` | False | 17.33% | 6.98% | 0.8196 |
| Center Crop Resize | `zero_one` [0..1] | `crop` | False | 76.00% | 75.99% | 0.0683 |
| Letterbox Padding | `zero_one` [0..1] | `pad` | False | 62.00% | 61.27% | 0.1107 |
| Test-Time Augmentation | `zero_one` [0..1] | `direct` | True | 80.33% | 80.40% | 0.1013 |

---

## Confidence Gating & Reliability Policies

### Empirical Gating Distribution

Dual-threshold confidence gating isolates automated decisions from ambiguous or low-confidence inputs:

| Decision State | Threshold Criteria | Sample Count | Coverage (%) | Selective Accuracy (%) |
|---|---|---|---|---|
| **`confident`** | `P1 >= 75.0%` and `margin >= 20.0%` | 149 | 49.67% | **93.96%** |
| **`uncertain`** | `45.0% <= P1 < 75.0%` or `margin < 20.0%` | 107 | 35.67% | 71.03% |
| **`rejected`** | `P1 < 45.0%` or `image_empty_or_flat` | 44 | 14.67% | 65.91% |
| **Overall** | — | 300 | 100.0% | 81.67% |

Within the automated `confident` partition, accuracy reaches **93.96%**, effectively suppressing erroneous routing actions.

### Pre-Inference Quality Thresholds

Statistical descriptors evaluated on a 128x128 grayscale thumbnail prior to neural execution:

| Threshold Constant | Config Variable | Default Value | Condition & Warning |
|---|---|---|---|
| `BLUR_VAR_MIN` | `BLUR_VAR_MIN` | `35.0` | Laplacian variance < 35.0 -> `image_blurry` |
| `DARK_MEAN_MAX` | `DARK_MEAN_MAX` | `30.0` | Mean intensity < 30.0 -> `image_too_dark` |
| `BRIGHT_MEAN_MIN` | `BRIGHT_MEAN_MIN` | `230.0` | Mean intensity > 230.0 -> `image_too_bright` |
| `FLAT_STD_MIN` | `FLAT_STD_MIN` | `15.0` | Standard deviation < 15.0 -> `image_empty_or_flat` |

---

## Limitations & Dataset Provenance

> [!WARNING]
> **Dataset Provenance**: The 300 benchmark samples originate from the standard TrashNet dataset. The exact train/test split of the original legacy `models/model.keras` cannot be independently verified; therefore, these metrics reflect in-distribution performance and should be considered optimistic upper bounds.
>
> **Domain Shift on Campus**: Real-world smartphone captures in cafeteria and hallway lighting differ substantially from clean, white-background laboratory datasets. Performance on real campus photos is likely lower; evaluate with `data/campus_photos/`.
>
> **Campus Photo Collection**: To validate real-world performance, a dedicated directory structure has been created in `data/campus_photos/`. Once local photos are deposited, run:
> ```bash
> python scripts/evaluate.py --data data/campus_photos --output-dir docs/metrics/campus_benchmark
> ```

---

## Graph Routing & Ranking Algorithms

EcoSort models the pedestrian network of Kafrelsheikh University campus as an illustrative, weighted graph spanning 12 landmark faculties and facilities. Edge weights are derived from real geographical coordinates (lat/lng) calculated via the Haversine formula scaled with a realistic pedestrian detour factor (1.15), ensuring `weight >= haversine` across all edges.

### Dijkstra vs A* Algorithm Comparison

| Dimension | Dijkstra's Algorithm | A* Search Algorithm |
|---|---|---|
| **Search Strategy** | Uniform Cost Search (uninformed) | Best-First Search with Admissible Heuristic |
| **Cost Formulation** | `f(n) = g(n)` | `f(n) = g(n) + h(n)` |
| **Heuristic Function** | None (`h(n) = 0`) | Haversine distance to target bin (`h(n) <= h*(n)`, consistent) |
| **Exploration Pattern** | Radial, uniform in all directions | Directed ellipse toward destination |
| **Shortest Path Optimality** | Guaranteed optimal | Guaranteed optimal (`h(n)` is admissible and consistent) |
| **Time Complexity** | `O((V + E) log V)` with priority queue | `O(b^d)` worst case; approaches `O(d)` |

### Merge Sort for Distance Ranking
To display all candidate bins campus-wide in strictly ascending order:
- **Paradigm**: Divide and Conquer (bisect list, sort sub-lists, merge linearly).
- **Time Complexity**: Guaranteed `O(n log n)` across worst, average, and best cases.
- **Stability**: Stable sorting preserves the geographical index order of equidistant bins.

---

## API Reference

### 1. Model Inference Endpoint: `POST /predict`
Submits an image for computer vision classification and routing metadata extraction.

**Request:**
- Content-Type: `multipart/form-data`
- Body: `file` (JPEG, PNG, or WEBP binary)

**Response (`application/json`):**
```json
{
  "status": "success",
  "decision": "confident",
  "class_name": "plastic",
  "confidence": 94.2,
  "confidence_formatted": "94.2%",
  "margin": 88.5,
  "top_k": [
    {
      "class_name": "plastic",
      "material_name_ar": "بلاستيك عام وبوليمرات",
      "material_name_en": "General Plastic & Polymers",
      "confidence": 94.2,
      "confidence_formatted": "94.2%"
    },
    {
      "class_name": "glass",
      "material_name_ar": "زجاجات وعبوات زجاجية",
      "material_name_en": "Glass Bottle / Container",
      "confidence": 5.8,
      "confidence_formatted": "5.8%"
    }
  ],
  "quality_warnings": [],
  "tta_used": false,
  "model_version": "2.0.0",
  "inference_time_ms": 24.8,
  "material": "Plastic",
  "material_name_ar": "بلاستيك عام وبوليمرات",
  "material_name_en": "General Plastic & Polymers",
  "resin_code": null,
  "target_bin": "plastic",
  "bin_name_ar": "الحاوية الصفراء (بلاستيك)",
  "bin_name_en": "Yellow Bin (Plastics)",
  "bin_color": "#eab308",
  "co2_saved_grams": 85,
  "energy_saved": "توفير طاقة تعادل تشغيل مصباح موفر لمدة 6 ساعات لكل عبوة.",
  "energy_saved_en": "Saves enough energy to power an LED bulb for 6 hours per container.",
  "water_saved_liters": 2.1,
  "guide": [
    "تفريغ أي قطرات سوائل أو محتويات متبقية داخل العبوة تماماً.",
    "ضغط العبوة باليد لطرد الهواء وتقليص حجمها لتوفير المساحة بالحاوية.",
    "إعادة ربط الغطاء بإحكام حتى لا يفلت أثناء النقل وإعادة التدوير.",
    "إلقاء القطعة في الحاوية الصفراء المخصصة للمخلفات البلاستيكية."
  ],
  "guide_en": [
    "Completely drain any residual liquids or contents.",
    "Crush the plastic item flat to expel air and save bin volume.",
    "Screw the plastic cap back on tightly if applicable.",
    "Drop into the designated yellow plastic recycling bin."
  ],
  "texture_description_ar": "بلاستيك وبوليمرات متعددة، مرنة أو صلبة، ملمس أملس مع استجابة مرنة عند الضغط.",
  "texture_description_en": "Various polymer plastic, flexible or rigid, smooth finish with elastic deformation."
}
```

### 2. Health & Readiness Endpoint: `GET /health`
Returns runtime status and model loading confirmation.

**Response (`application/json`):**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "classes": ["cardboard", "glass", "metal", "paper", "plastic", "trash"],
  "norm_mode": "zero_one",
  "resize_mode": "direct"
}
```

---

## Repository Structure

<details>
<summary><strong>Click to expand project directory tree</strong></summary>

```text
EcoSort/
├── .github/
│   └── workflows/
│       └── ci.yml                     # GitHub Actions CI workflow (lint + test)
├── api/                               # Vercel serverless deployment
│   ├── index.py                       # Serverless WSGI/LiteRT entrypoint & proxy
│   └── requirements.txt               # Serverless Python dependencies (ai-edge-litert)
├── app.py                             # Flask application routes (/predict, /health)
├── wsgi.py                            # Production WSGI application entrypoint
├── index.html                         # Root static entrypoint for Vercel deployment
├── vercel.json                        # Vercel routing, rewrites, and security headers
├── ecosort/                           # Core Python backend package
│   ├── __init__.py
│   ├── config.py                      # Centralized configuration with env overrides
│   ├── inference.py                   # Thread-safe model singleton engine & gating
│   ├── knowledge.py                   # Environmental IR & carbon savings registry
│   ├── preprocess.py                  # EXIF correction, quality checks, scaling
│   └── rate_limiter.py                # Sliding-window in-memory IP rate limiter
├── models/
│   ├── model.keras                    # Pre-trained deep learning CNN model
│   └── model.tflite                   # Flatbuffer model for LiteRT inference
├── data/
│   ├── README.md                      # Dataset documentation and evaluation guide
│   ├── benchmark/                     # 300 TrashNet evaluation samples across 6 classes
│   └── campus_photos/                 # Real-world campus photographs
│       ├── README.md                  # Collection instructions & domain shift guide
│       └── {cardboard,glass,metal,paper,plastic,trash}/
├── docs/
│   ├── DEFENSE_GUIDE.md               # Academic viva defense questions & answers
│   ├── THRESHOLDS.md                  # Statistical & confidence thresholds reference
│   └── metrics/
│       ├── ab_experiments.json        # Systematic A/B experiments log
│       └── per_class_metrics.json     # Complete verified baseline metrics
├── scripts/
│   ├── download_dataset.py            # Dataset acquisition utility
│   ├── evaluate.py                    # Comprehensive benchmarking script
│   ├── run_experiments.py             # Systematic A/B experiment runner
│   └── sync_sources.py                # Single-source verification & sync utility
├── static/
│   ├── assets/images/                 # Favicons, icons, and branding
│   ├── css/
│   │   ├── components.css             # UI components, modals, toasts
│   │   ├── responsive.css             # Mobile-first media queries
│   │   ├── style.css                  # Core CSS & layout definitions
│   │   └── utilities.css              # Logical properties & RTL utilities
│   └── js/                            # Client-side routing, algorithms, and CV modules
├── templates/
│   └── index.html                     # Responsive single-page application wizard
├── tests/                             # Comprehensive automated test suite (Pytest + Node)
├── training/
│   ├── README.md                      # Transfer learning documentation
│   └── train_transfer.py              # Two-stage MobileNetV2 / EfficientNet training
├── .dockerignore
├── .env.example                       # Environment configuration template
├── .gitignore
├── Dockerfile                         # Production single-stage Docker container (python:3.11-slim)
├── docker-compose.yml                 # Local Docker Compose setup
├── LICENSE
├── pyproject.toml                     # Ruff linter and tool configuration
├── README.md
├── requirements.txt                   # Production dependencies
└── requirements-dev.txt               # Development & testing dependencies
```
</details>

---

## Getting Started

### Prerequisites
- Python 3.10, 3.11, 3.12, or 3.13
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation
```bash
# 1. Clone repository
git clone https://github.com/nour714/EcoSort.git
cd EcoSort

# 2. Create and activate virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt
```

### Running the Application
```bash
# Start Flask server
python app.py
```
Open your browser and navigate to:
```
http://localhost:5000
```

---

## Testing & Quality Assurance

EcoSort maintains an automated test suite verifying API contracts, preprocessing behavior, image quality checks, and metric consistency:

```bash
# Install development and testing dependencies
pip install -r requirements-dev.txt

# Run linter
ruff check .

# Run complete pytest suite
pytest -v

# Run Node.js graph algorithm & client unit tests
node --test tests/*.test.js
```

Automated unit, integration, and regression suites run across both Python (`pytest`) and Node.js (`node --test`), verifying model inference, confidence gating, graph algorithms, and environmental metrics.

---

## Docker Deployment

To build and run EcoSort in an isolated container:

```bash
# Build Docker image
docker build -t ecosort:latest .

# Run container on port 5000
docker run -p 5000:5000 --name ecosort-app ecosort:latest
```

Using Docker Compose:
```bash
docker compose up --build
```

---

## Deployment: Flask vs Vercel

EcoSort supports two production deployment topologies depending on operational requirements:

| Dimension | Dedicated Flask Container (`app.py`) | Vercel Serverless (`api/index.py`) |
| :--- | :--- | :--- |
| **Target Runtime** | Docker / VPS / PaaS (Render, Railway, Hugging Face) | Vercel Serverless Edge Functions + Global CDN |
| **Inference Engine** | Full Keras 3 / TensorFlow / TFLite runtime | Google LiteRT (`ai-edge-litert`) serverless runtime |
| **Model Artifact** | `models/model.keras` or `models/model.tflite` | `models/model.tflite` (workspace root) |
| **Concurrency & Workers** | Gunicorn multi-worker (`wsgi.py`, threads per worker) | Auto-scaling per-invocation serverless workers |
| **Rate Limiting** | In-memory sliding-window token bucket (`ecosort/rate_limiter.py`) | Edge rate limiting / proxy or external gateway |
| **Static Delivery** | Flask `static/` route with caching headers | Vercel Global Edge Network with pre-compressed assets |
| **Proxy Architecture** | Direct backend endpoint | Supports transparent proxy via `ECOSORT_BACKEND_URL` |
| **Security Headers** | Configurable reverse proxy / WSGI middleware | Hardened CSP, HSTS, Permissions-Policy via `vercel.json` |

### Hybrid Proxy Mode
When deploying frontend static assets to Vercel while running deep neural inference on dedicated hardware (e.g. GPU VPS or Render), configure the `ECOSORT_BACKEND_URL` environment variable in Vercel project settings:
```bash
# Example Vercel environment variable
ECOSORT_BACKEND_URL=https://api.ecosort.example.com
```
When `ECOSORT_BACKEND_URL` is set, `api/index.py` transparently streams multipart requests directly to the dedicated Flask instance, bypassing serverless size and execution limits.

---

## Transfer Learning Pipeline

To train an updated model using MobileNetV2 or EfficientNetB0:
```bash
# Train lightweight MobileNetV2 with two-stage transfer learning
python training/train_transfer.py \
    --data-dir data/dataset-resized \
    --model-type mobilenetv2 \
    --epochs-stage1 15 \
    --epochs-stage2 15 \
    --output-dir training/output
```
See [training/README.md](training/README.md) for full instructions.

---

## Academic Resources

- **[Academic Defense Guide (DEFENSE_GUIDE.md)](docs/DEFENSE_GUIDE.md)**: 15 questions and model answers covering model architecture, EXIF orientation, A* vs Dijkstra, thread safety, and ECE.
- **[System Thresholds Reference (THRESHOLDS.md)](docs/THRESHOLDS.md)**: Precise mathematical definitions and environment variables for all quality guardrails and confidence thresholds.

---

## License

This project is licensed under the MIT License — see the LICENSE file for details.
