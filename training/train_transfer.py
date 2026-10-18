#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
EcoSort - Transfer Learning Training Pipeline
==============================================
Trains a production-grade waste classification model on TrashNet or custom datasets
using MobileNetV2 or EfficientNetB0 with built-in preprocessing and data augmentation.

Features:
- Built-in preprocessing layer inside the model (self-contained deployment).
- Two-stage training: Feature Extraction (frozen base) -> Fine-Tuning (unfrozen top layers).
- Class weight computation to address class imbalance.
- Data augmentation (RandomFlip, RandomRotation, RandomZoom, RandomContrast).
- Automatic Train / Val / Test splitting.
- Rich callbacks: ModelCheckpoint, EarlyStopping, ReduceLROnPlateau, TensorBoard.
- Exports 'model.keras' and 'labels.json' along with evaluation metrics.

Usage:
    python training/train_transfer.py --data-dir data/dataset-resized --epochs 25 --model-type mobilenetv2
"""

import os
import json
import argparse
import logging
from pathlib import Path
import numpy as np

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import classification_report, confusion_matrix

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("EcoSortTrainer")

IMG_SIZE = (224, 224)
BATCH_SIZE = 32
DEFAULT_CLASSES = ["cardboard", "glass", "metal", "paper", "plastic", "trash"]


def parse_args():
    parser = argparse.ArgumentParser(description="EcoSort Transfer Learning Training Pipeline")
    parser.add_argument(
        "--data-dir",
        type=str,
        default="data/dataset-resized",
        help="Path to dataset directory organized into class subfolders."
    )
    parser.add_argument(
        "--model-type",
        type=str,
        choices=["mobilenetv2", "efficientnetb0"],
        default="mobilenetv2",
        help="Backbone architecture to use for transfer learning."
    )
    parser.add_argument(
        "--epochs-stage1",
        type=int,
        default=15,
        help="Number of epochs for Stage 1 (frozen base)."
    )
    parser.add_argument(
        "--epochs-stage2",
        type=int,
        default=15,
        help="Number of epochs for Stage 2 (fine-tuning)."
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for training and validation."
    )
    parser.add_argument(
        "--learning-rate",
        type=float,
        default=1e-3,
        help="Initial learning rate for Stage 1."
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="training/output",
        help="Directory to save the trained model, labels, and metrics."
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility."
    )
    return parser.parse_args()


def load_datasets(data_dir: Path, batch_size: int, seed: int):
    """Load train, val, and test splits from directory."""
    if not data_dir.exists():
        raise FileNotFoundError(f"Data directory not found: {data_dir}")

    logger.info(f"Loading full dataset from: {data_dir}")

    # Step 1: 70% Train, 30% Temp (Val + Test)
    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=0.3,
        subset="training",
        seed=seed,
        image_size=IMG_SIZE,
        batch_size=batch_size,
        label_mode="int"
    )

    temp_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=0.3,
        subset="validation",
        seed=seed,
        image_size=IMG_SIZE,
        batch_size=batch_size,
        label_mode="int"
    )

    class_names = train_ds.class_names
    num_classes = len(class_names)
    logger.info(f"Discovered {num_classes} classes: {class_names}")

    # Split temp_ds equally into val (15%) and test (15%)
    temp_batches = tf.data.experimental.cardinality(temp_ds).numpy()
    val_batches = temp_batches // 2

    val_ds = temp_ds.take(val_batches)
    test_ds = temp_ds.skip(val_batches)

    # Prefetch and cache for optimal throughput
    AUTOTUNE = tf.data.AUTOTUNE
    train_ds = train_ds.cache().shuffle(1000, seed=seed).prefetch(buffer_size=AUTOTUNE)
    val_ds = val_ds.cache().prefetch(buffer_size=AUTOTUNE)
    test_ds = test_ds.cache().prefetch(buffer_size=AUTOTUNE)

    return train_ds, val_ds, test_ds, class_names


def calculate_class_weights(data_dir: Path, class_names: list) -> dict:
    """Compute balanced class weights to compensate for dataset skew."""
    labels = []
    for class_idx, class_name in enumerate(class_names):
        folder = data_dir / class_name
        if folder.exists():
            count = len(list(folder.glob("*.*")))
            labels.extend([class_idx] * count)

    if not labels:
        return {}

    classes = np.unique(labels)
    weights = compute_class_weight(class_weight="balanced", classes=classes, y=labels)
    class_weight_dict = {cls: float(w) for cls, w in zip(classes, weights)}
    logger.info(f"Computed Class Weights: {class_weight_dict}")
    return class_weight_dict


def build_transfer_model(model_type: str, num_classes: int) -> tuple[tf.keras.Model, tf.keras.Model]:
    """
    Constructs a transfer learning model with built-in preprocessing and augmentation layers.
    Returns: (full_model, base_model)
    """
    # 1. Inputs: raw uint8 or float32 images of shape (224, 224, 3)
    inputs = tf.keras.Input(shape=(IMG_SIZE[0], IMG_SIZE[1], 3), name="image_input")

    # 2. Data Augmentation Layers
    data_augmentation = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal_and_vertical"),
        tf.keras.layers.RandomRotation(0.15),
        tf.keras.layers.RandomZoom(0.15),
        tf.keras.layers.RandomContrast(0.1),
    ], name="data_augmentation")

    x = data_augmentation(inputs)

    # 3. Built-in Normalization / Preprocessing Layer
    if model_type == "mobilenetv2":
        # MobileNetV2 expects [-1, 1] range: tf.keras.applications.mobilenet_v2.preprocess_input
        x = tf.keras.layers.Rescaling(scale=1.0 / 127.5, offset=-1.0, name="mobilenet_rescaling")(x)
        base_model = tf.keras.applications.MobileNetV2(
            input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3),
            include_top=False,
            weights="imagenet"
        )
    elif model_type == "efficientnetb0":
        # EfficientNet has internal rescaling, expects [0, 255]
        base_model = tf.keras.applications.EfficientNetB0(
            input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3),
            include_top=False,
            weights="imagenet"
        )
    else:
        raise ValueError(f"Unsupported model type: {model_type}")

    base_model.trainable = False  # Freeze for Stage 1

    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D(name="global_avg_pool")(x)
    x = tf.keras.layers.BatchNormalization(name="batch_norm")(x)
    x = tf.keras.layers.Dropout(0.35, name="top_dropout")(x)
    x = tf.keras.layers.Dense(128, activation="relu", name="dense_features")(x)
    x = tf.keras.layers.Dropout(0.2, name="second_dropout")(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax", name="predictions")(x)

    model = tf.keras.Model(inputs, outputs, name=f"EcoSort_{model_type.upper()}")
    return model, base_model


def train_model(args):
    data_dir = Path(args.data_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load Data
    train_ds, val_ds, test_ds, class_names = load_datasets(data_dir, args.batch_size, args.seed)
    class_weights = calculate_class_weights(data_dir, class_names)

    # 2. Build Model
    model, base_model = build_transfer_model(args.model_type, len(class_names))
    model.summary(print_fn=logger.info)

    # 3. Stage 1: Train Top Classifier Only
    logger.info("=== STAGE 1: Training Classification Head (Base Model Frozen) ===")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=args.learning_rate),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )

    checkpoint_path = output_dir / "best_model_stage1.keras"
    callbacks_s1 = [
        tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=5, restore_best_weights=True),
        tf.keras.callbacks.ModelCheckpoint(str(checkpoint_path), monitor="val_accuracy", save_best_only=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-6)
    ]

    history_s1 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs_stage1,
        class_weight=class_weights if class_weights else None,
        callbacks=callbacks_s1
    )
    if "val_accuracy" in history_s1.history:
        logger.info(f"Stage 1 finished. Best val_accuracy: {max(history_s1.history['val_accuracy']):.4f}")

    # 4. Stage 2: Fine-Tuning
    logger.info("=== STAGE 2: Fine-Tuning (Unfreezing Top Base Layers) ===")
    base_model.trainable = True

    # Freeze all layers before the last 30 layers
    fine_tune_at = len(base_model.layers) - 30
    for layer in base_model.layers[:fine_tune_at]:
        layer.trainable = False

    logger.info(f"Unfrozen top {len(base_model.layers) - fine_tune_at} layers of {base_model.name} for fine-tuning.")

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),  # Low LR for fine tuning
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )

    final_model_path = output_dir / "model.keras"
    callbacks_s2 = [
        tf.keras.callbacks.EarlyStopping(monitor="val_accuracy", patience=6, restore_best_weights=True),
        tf.keras.callbacks.ModelCheckpoint(str(final_model_path), monitor="val_accuracy", save_best_only=True),
        tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=2, min_lr=1e-7)
    ]

    history_s2 = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs_stage2,
        class_weight=class_weights if class_weights else None,
        callbacks=callbacks_s2
    )
    if "val_accuracy" in history_s2.history:
        logger.info(f"Stage 2 finished. Best val_accuracy: {max(history_s2.history['val_accuracy']):.4f}")

    # 5. Evaluate on Holdout Test Set
    logger.info("=== Evaluating Model on Unseen Test Split ===")
    test_loss, test_acc = model.evaluate(test_ds)
    logger.info(f"Test Accuracy: {test_acc * 100:.2f}% | Test Loss: {test_loss:.4f}")

    # Extract all test labels and predictions for detailed report
    y_true = []
    y_pred = []
    for images, labels in test_ds:
        preds = model.predict(images, verbose=0)
        y_true.extend(labels.numpy())
        y_pred.extend(np.argmax(preds, axis=1))

    report = classification_report(y_true, y_pred, target_names=class_names, output_dict=True)
    cm = confusion_matrix(y_true, y_pred).tolist()

    logger.info("Classification Report on Test Split:\n" + classification_report(y_true, y_pred, target_names=class_names))

    # 6. Save Artifacts
    labels_path = output_dir / "labels.json"
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(class_names, f, indent=2, ensure_ascii=False)

    metrics_path = output_dir / "test_evaluation.json"
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump({
            "model_type": args.model_type,
            "test_accuracy": round(float(test_acc * 100), 2),
            "test_loss": round(float(test_loss), 4),
            "classification_report": report,
            "confusion_matrix": cm,
            "class_names": class_names
        }, f, indent=2)

    logger.info(f"Artifacts successfully saved to: {output_dir}")
    logger.info(f"- Model: {final_model_path}")
    logger.info(f"- Labels: {labels_path}")
    logger.info(f"- Metrics: {metrics_path}")
    logger.info(f"To deploy to EcoSort, run: cp {final_model_path} models/model.keras")


if __name__ == "__main__":
    cli_args = parse_args()
    train_model(cli_args)
