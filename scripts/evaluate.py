# -*- coding: utf-8 -*-
"""
EcoSort Model Evaluation & Benchmarking Script
Calculates Accuracy, Precision, Recall, F1, Confusion Matrix, ECE, and Coverage Curve.
Note: 300 evaluation samples from the TrashNet distribution (training/test split
of the provided model.keras is unverified; results represent in-distribution
performance and may reflect optimistic upper bounds).
"""
import os
import sys
import argparse
import json
import time
import numpy as np
from PIL import Image, ImageOps

# Ensure matplotlib runs headlessly
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.metrics import classification_report, confusion_matrix

DEFAULT_CLASSES = ['cardboard', 'glass', 'metal', 'paper', 'plastic', 'trash']

def load_and_preprocess(img_path: str, target_size=(224, 224), norm_mode='zero_one', resize_mode='direct') -> np.ndarray:
    """Preprocess single image with configurable normalization and resize modes."""
    img = Image.open(img_path)
    img = ImageOps.exif_transpose(img)
    
    # Handle transparency
    if img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGBA')
        bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img).convert('RGB')
    else:
        img = img.convert('RGB')

    # Resize strategy
    if resize_mode == 'direct':
        img = img.resize(target_size, Image.Resampling.BILINEAR)
    elif resize_mode == 'crop':
        w, h = img.size
        min_dim = min(w, h)
        left = (w - min_dim) // 2
        top = (h - min_dim) // 2
        img = img.crop((left, top, left + min_dim, top + min_dim))
        img = img.resize(target_size, Image.Resampling.BILINEAR)
    elif resize_mode == 'pad':
        w, h = img.size
        scale = min(target_size[0] / w, target_size[1] / h)
        nw, nh = int(w * scale), int(h * scale)
        img_resized = img.resize((nw, nh), Image.Resampling.BILINEAR)
        new_img = Image.new('RGB', target_size, (128, 128, 128))
        paste_x = (target_size[0] - nw) // 2
        paste_y = (target_size[1] - nh) // 2
        new_img.paste(img_resized, (paste_x, paste_y))
        img = new_img

    arr = np.array(img, dtype=np.float32)

    # Normalization strategy
    if norm_mode == 'zero_one':
        arr = arr / 255.0
    elif norm_mode == 'signed':
        arr = (arr / 127.5) - 1.0
    elif norm_mode == 'raw':
        pass  # keep [0, 255]

    return arr

def predict_single(model, img_arr: np.ndarray, use_tta=False) -> np.ndarray:
    """Predict probabilities with optional Test-Time Augmentation (TTA)."""
    if not use_tta:
        batch = np.expand_dims(img_arr, axis=0)
        preds = model(batch, training=False).numpy()[0]
        return preds

    # TTA: original + horizontal flip + slight crops
    augmented = [img_arr]
    # Horizontal flip
    augmented.append(np.fliplr(img_arr))

    # Crops if array is (224, 224, 3)
    batch = np.stack(augmented, axis=0)
    preds_all = model(batch, training=False).numpy()
    avg_preds = np.mean(preds_all, axis=0)
    return avg_preds

def calculate_ece(y_true, y_probs, n_bins=10):
    """Calculate Expected Calibration Error (ECE)."""
    confidences = np.max(y_probs, axis=1)
    predictions = np.argmax(y_probs, axis=1)
    accuracies = predictions == y_true

    ece = 0.0
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    for i in range(n_bins):
        in_bin = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i + 1])
        prop_in_bin = np.mean(in_bin)
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin
    return float(ece)

def plot_confusion_matrix(cm, class_names, output_path):
    """Plot and save clean confusion matrix figure."""
    plt.figure(figsize=(7, 6))
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title('Confusion Matrix — EcoSort Evaluation', fontsize=14, pad=12)
    plt.colorbar()
    tick_marks = np.arange(len(class_names))
    plt.xticks(tick_marks, class_names, rotation=45, ha='right')
    plt.yticks(tick_marks, class_names)

    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            val = cm[i, j]
            plt.text(j, i, format(val, 'd'),
                     horizontalalignment="center",
                     color="white" if val > thresh else "black",
                     fontsize=11, fontweight='bold')

    plt.ylabel('True Class', fontsize=12)
    plt.xlabel('Predicted Class', fontsize=12)
    plt.tight_layout()
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path, dpi=200)
    plt.close()

def plot_coverage_curve(confidences, accuracies, output_path):
    """Plot Accuracy vs Coverage curve across confidence thresholds."""
    thresholds = np.linspace(0.3, 0.99, 50)
    coverages = []
    precisions = []

    for th in thresholds:
        accepted = confidences >= th
        cov = np.mean(accepted)
        if np.sum(accepted) > 0:
            acc = np.mean(accuracies[accepted])
        else:
            acc = 1.0
        coverages.append(cov * 100)
        precisions.append(acc * 100)

    plt.figure(figsize=(8, 5))
    plt.plot(thresholds * 100, precisions, 'b-', label='Precision (%) on Accepted', linewidth=2.5)
    plt.plot(thresholds * 100, coverages, 'g--', label='Coverage (%) of Dataset', linewidth=2)
    plt.axvline(x=75, color='r', linestyle=':', label='CONF_HIGH=75%')
    plt.axvline(x=45, color='orange', linestyle=':', label='CONF_LOW=45%')
    plt.title('Accuracy vs Coverage under Confidence Gating', fontsize=13)
    plt.xlabel('Confidence Threshold (%)', fontsize=11)
    plt.ylabel('Percentage (%)', fontsize=11)
    plt.grid(True, alpha=0.3)
    plt.legend(loc='lower left')
    plt.tight_layout()
    plt.savefig(output_path, dpi=200)
    plt.close()

def main():
    parser = argparse.ArgumentParser(description="Evaluate EcoSort Keras Model")
    parser.add_argument('--model', default='model.keras', help='Path to .keras model')
    parser.add_argument('--data', default='samples', help='Path to test dataset folder')
    parser.add_argument('--norm', default='zero_one', choices=['zero_one', 'signed', 'raw'], help='Normalization mode')
    parser.add_argument('--resize-mode', default='direct', choices=['direct', 'crop', 'pad'], help='Resize strategy')
    parser.add_argument('--tta', action='store_true', help='Enable Test-Time Augmentation')
    parser.add_argument('--output-dir', default='docs/metrics', help='Directory to save metrics & charts')
    args = parser.parse_args()

    print(f"=== EcoSort Evaluation ===")
    print(f"Model: {args.model}")
    print(f"Data Dir: {args.data}")
    print(f"Normalization: {args.norm}")
    print(f"Resize Mode: {args.resize_mode}")
    print(f"TTA: {args.tta}")

    if not os.path.exists(args.model):
        print(f"Error: Model not found at {args.model}")
        sys.exit(1)

    import tensorflow as tf
    print("Loading model...")
    model = tf.keras.models.load_model(args.model)

    classes = DEFAULT_CLASSES
    class_to_idx = {c: i for i, c in enumerate(classes)}

    y_true = []
    y_pred = []
    all_probs = []
    sample_files = []

    start_time = time.time()
    for cls in classes:
        cls_dir = os.path.join(args.data, cls)
        if not os.path.isdir(cls_dir):
            continue
        files = [f for f in os.listdir(cls_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        for f in files:
            path = os.path.join(cls_dir, f)
            try:
                arr = load_and_preprocess(path, norm_mode=args.norm, resize_mode=args.resize_mode)
                probs = predict_single(model, arr, use_tta=args.tta)
                pred_idx = int(np.argmax(probs))

                y_true.append(class_to_idx[cls])
                y_pred.append(pred_idx)
                all_probs.append(probs)
                sample_files.append(path)
            except Exception as e:
                print(f"Skipping {path}: {e}")

    total_time = time.time() - start_time
    total_samples = len(y_true)
    if total_samples == 0:
        print("No test samples found to evaluate!")
        sys.exit(1)

    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    all_probs = np.array(all_probs)

    accuracy = float(np.mean(y_true == y_pred) * 100)
    avg_latency = float((total_time / total_samples) * 1000)
    ece = calculate_ece(y_true, all_probs)

    report_dict = classification_report(y_true, y_pred, target_names=classes, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_true, y_pred)

    print("\n-------------------------------------------")
    print(f"Total Evaluated Samples: {total_samples}")
    print(f"Overall Accuracy:        {accuracy:.2f}%")
    print(f"Average Latency:         {avg_latency:.2f} ms/sample")
    print(f"Expected Calibration Err:{ece:.4f}")
    print("-------------------------------------------")
    print(classification_report(y_true, y_pred, target_names=classes, digits=3, zero_division=0))

    # Save outputs
    os.makedirs(args.output_dir, exist_ok=True)
    cm_path = os.path.join(args.output_dir, 'confusion_matrix.png')
    plot_confusion_matrix(cm, classes, cm_path)
    print(f"Saved Confusion Matrix to: {cm_path}")

    confidences = np.max(all_probs, axis=1)
    accuracies = (y_true == y_pred)
    cov_path = os.path.join(args.output_dir, 'coverage_curve.png')
    plot_coverage_curve(confidences, accuracies, cov_path)
    print(f"Saved Coverage Curve to: {cov_path}")

    # Gating statistics
    decisions = []
    for probs in all_probs:
        sorted_p = np.sort(probs)[::-1]
        top1 = sorted_p[0] * 100.0
        top2 = sorted_p[1] * 100.0 if len(sorted_p) > 1 else 0.0
        margin = top1 - top2
        if top1 < 45.0:
            decisions.append('rejected')
        elif top1 >= 75.0 and margin >= 20.0:
            decisions.append('confident')
        else:
            decisions.append('uncertain')

    decisions = np.array(decisions)
    gating_summary = {}
    for d_name in ['confident', 'uncertain', 'rejected']:
        mask = (decisions == d_name)
        count = int(np.sum(mask))
        cov_pct = round(float(count / total_samples * 100.0), 2)
        acc_pct = round(float(np.mean(y_true[mask] == y_pred[mask]) * 100.0), 2) if count > 0 else 0.0
        gating_summary[d_name] = {
            'count': count,
            'coverage_pct': cov_pct,
            'accuracy_pct': acc_pct
        }

    # Metrics JSON
    metrics_summary = {
        'total_samples': total_samples,
        'overall_accuracy': round(accuracy, 2),
        'avg_latency_ms': round(avg_latency, 2),
        'ece': round(ece, 4),
        'norm_mode': args.norm,
        'resize_mode': args.resize_mode,
        'tta_used': args.tta,
        'per_class': {
            cls: {
                'precision': round(report_dict[cls]['precision'] * 100, 2),
                'recall': round(report_dict[cls]['recall'] * 100, 2),
                'f1_score': round(report_dict[cls]['f1-score'] * 100, 2),
                'support': int(report_dict[cls]['support'])
            }
            for cls in classes if cls in report_dict
        },
        'macro_avg': {
            'precision': round(report_dict['macro avg']['precision'] * 100, 2),
            'recall': round(report_dict['macro avg']['recall'] * 100, 2),
            'f1_score': round(report_dict['macro avg']['f1-score'] * 100, 2)
        },
        'weighted_avg': {
            'precision': round(report_dict['weighted avg']['precision'] * 100, 2),
            'recall': round(report_dict['weighted avg']['recall'] * 100, 2),
            'f1_score': round(report_dict['weighted avg']['f1-score'] * 100, 2)
        },
        'gating': gating_summary,
        'confusion_matrix': cm.tolist(),
        'class_names': classes
    }

    json_path = os.path.join(args.output_dir, 'per_class_metrics.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(metrics_summary, f, indent=2, ensure_ascii=False)
    print(f"Saved Per-class Metrics to: {json_path}")

    # Output one line summary for easy script parsing
    print(f"RESULT: accuracy={accuracy:.2f} f1={report_dict['weighted avg']['f1-score']*100:.2f} ece={ece:.4f}")

if __name__ == '__main__':
    main()
