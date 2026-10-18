# EcoSort — Transfer Learning Training Pipeline

This directory provides a reproducible training pipeline for waste classification models using **Transfer Learning** with state-of-the-art vision backbones (**MobileNetV2** and **EfficientNetB0**).

---

## Technical Features

1. **Self-Contained Preprocessing Layer**:
   - The model embeds an internal `Rescaling` layer that maps raw input from `[0, 255]` to the appropriate normalization range (e.g., `[-1, 1]` for MobileNetV2).
   - This ensures the model can be deployed across inference environments (Backend, Edge, or Browser) without relying on external normalization scripts.

2. **Data Augmentation**:
   - `RandomFlip`: Horizontal and vertical flips to handle arbitrary orientation.
   - `RandomRotation`: Random rotation within $\pm 15\%$.
   - `RandomZoom`: Random zoom within $\pm 15\%$.
   - `RandomContrast`: Dynamic contrast adjustment simulating campus lighting conditions.

3. **Two-Stage Training**:
   - **Stage 1 (Feature Extraction)**: The backbone is frozen; only the classification head (Dense layers + Dropout) is trained using Adam with learning rate `1e-3`.
   - **Stage 2 (Fine-Tuning)**: The top 30 layers of the backbone are unfrozen and trained with a reduced learning rate of `1e-5` to adapt fine-grained features.

4. **Class Imbalance Handling**:
   - Automated calculation of balanced weights via `compute_class_weight` to compensate for smaller classes (such as trash) relative to larger classes.

5. **Strict Data Split**:
   - **70%** Training.
   - **15%** Validation (hyperparameter tuning and early stopping).
   - **15%** Holdout Test (unseen evaluation partition).

---

## Dataset Preparation (TrashNet)

Download the TrashNet dataset into `data/dataset-resized/`:
```bash
data/
└── dataset-resized/
    ├── cardboard/
    ├── glass/
    ├── metal/
    ├── paper/
    ├── plastic/
    └── trash/
```

---

## Running Training

### 1. Train MobileNetV2 (Recommended for lightweight deployment)
```bash
python training/train_transfer.py \
    --data-dir data/dataset-resized \
    --model-type mobilenetv2 \
    --epochs-stage1 15 \
    --epochs-stage2 15 \
    --batch-size 32 \
    --output-dir training/output
```

### 2. Train EfficientNetB0 (Higher capacity)
```bash
python training/train_transfer.py \
    --data-dir data/dataset-resized \
    --model-type efficientnetb0 \
    --epochs-stage1 15 \
    --epochs-stage2 15 \
    --batch-size 32 \
    --output-dir training/output_effnet
```

---

## Output Artifacts & Deployment

Upon completion, the pipeline outputs:
1. `model.keras`: Complete Keras v3 model archive containing weights, architecture, and embedded preprocessing.
2. `labels.json`: Class index mapping.
3. `test_evaluation.json`: Comprehensive holdout test evaluation (Accuracy, F1-Score, Confusion Matrix).

### Deploying the Trained Model:
```bash
cp training/output/model.keras models/model.keras
python app.py
```
