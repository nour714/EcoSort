# -*- coding: utf-8 -*-
"""
EcoSort Deep Learning Inference & Confidence Gating Engine
"""
import time
import threading
import logging
import numpy as np
import tensorflow as tf

from ecosort.config import Config
from ecosort.preprocess import preprocess_image
from ecosort.knowledge import WASTE_KNOWLEDGE_BASE

logger = logging.getLogger('EcoSortInference')

def decide(top1: float, margin: float, quality_warnings: list | None = None) -> str:
    """
    Apply EcoSort 3-tier confidence gating policy.
    - 'rejected': flat/empty image warning present OR top1 confidence < Config.CONF_LOW.
    - 'confident': top1 confidence >= Config.CONF_HIGH AND margin >= Config.MARGIN_MIN.
    - 'uncertain': intermediate confidence / close competitors.
    """
    warnings = quality_warnings or []
    if "image_empty_or_flat" in warnings or top1 < Config.CONF_LOW:
        return "rejected"
    if top1 >= Config.CONF_HIGH and margin >= Config.MARGIN_MIN:
        return "confident"
    return "uncertain"

class ModelEngine:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.model = None
        self.class_names = Config.CLASS_NAMES
        self.load_model()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def load_model(self):
        """Load Keras model and warm up execution graph."""
        if self.model is not None:
            return

        logger.info(f"Loading Keras model from: {Config.MODEL_PATH}")
        try:
            self.model = tf.keras.models.load_model(Config.MODEL_PATH)
            logger.info(f"Model successfully loaded! Input: {self.model.input_shape}, Output: {self.model.output_shape}")
            # Warm-up graph execution to eliminate first request latency
            dummy_input = np.zeros((1, Config.INPUT_SIZE[0], Config.INPUT_SIZE[1], 3), dtype=np.float32)
            _ = self.model(dummy_input, training=False)
            logger.info("Model warm-up completed successfully.")
        except Exception as e:
            logger.error(f"Failed to load Keras model from {Config.MODEL_PATH}: {e}", exc_info=True)
            self.model = None

    def predict(self, image_bytes: bytes, use_tta=None) -> dict:
        """
        Run inference with quality validation, optional TTA, and confidence gating.
        """
        if self.model is None:
            raise RuntimeError(f"Model is not loaded on server. Please verify model file exists at: {Config.MODEL_PATH}")

        start_time = time.time()
        tta = Config.TTA_ENABLED if use_tta is None else use_tta

        # 1. Preprocess & inspect image
        tensor_batch, quality_warnings = preprocess_image(
            image_bytes,
            target_size=Config.INPUT_SIZE,
            resize_mode=Config.RESIZE_MODE,
            norm_mode=Config.NORM_MODE
        )

        # 2. Thread-safe inference execution
        with self._lock:
            if not tta:
                raw_preds = self.model(tensor_batch, training=False).numpy()[0]
            else:
                # TTA: original + horizontal flip
                flipped = np.flip(tensor_batch, axis=2)
                combined = np.concatenate([tensor_batch, flipped], axis=0)
                preds_both = self.model(combined, training=False).numpy()
                raw_preds = np.mean(preds_both, axis=0)

        # 3. Probabilities and Top-K extraction
        probs = raw_preds.astype(float)
        sorted_indices = np.argsort(probs)[::-1]

        top1_idx = int(sorted_indices[0])
        top2_idx = int(sorted_indices[1]) if len(sorted_indices) > 1 else top1_idx

        top1_conf = round(float(probs[top1_idx] * 100.0), 1)
        top2_conf = round(float(probs[top2_idx] * 100.0), 1)
        margin = round(top1_conf - top2_conf, 1)

        predicted_class = self.class_names[top1_idx] if top1_idx < len(self.class_names) else 'trash'

        # 4. Confidence Gating Decision
        decision = decide(top1_conf, margin, quality_warnings)

        # 5. Top-3 classes
        top_k = [
            {
                "class_name": self.class_names[idx],
                "confidence": round(float(probs[idx] * 100.0), 1),
                "confidence_formatted": f"{float(probs[idx] * 100.0):.1f}%",
                "material_name_ar": WASTE_KNOWLEDGE_BASE.get(self.class_names[idx], {}).get("material_name_ar", self.class_names[idx]),
                "material_name_en": WASTE_KNOWLEDGE_BASE.get(self.class_names[idx], {}).get("material_name_en", self.class_names[idx]),
            }
            for idx in sorted_indices[:3]
        ]

        # 6. Environmental Knowledge Base Info
        info = WASTE_KNOWLEDGE_BASE.get(predicted_class, WASTE_KNOWLEDGE_BASE['trash'])

        all_probs = {
            self.class_names[i]: round(float(probs[i] * 100.0), 2)
            for i in range(len(self.class_names))
        }

        latency_ms = round((time.time() - start_time) * 1000.0, 2)

        return {
            "status": "success",
            "decision": decision,
            "class_name": predicted_class,
            "confidence": top1_conf,
            "confidence_formatted": f"{top1_conf:.1f}%",
            "margin": margin,
            "top_k": top_k,
            "quality_warnings": quality_warnings,
            "tta_used": tta,
            "model_version": "2.0.0",
            "inference_time_ms": latency_ms,
            "material": info["material"],
            "material_name_ar": info["material_name_ar"],
            "material_name_en": info["material_name_en"],
            "resin_code": info["resin_code"],
            "target_bin": info["target_bin"],
            "bin_name_ar": info["bin_name_ar"],
            "bin_name_en": info["bin_name_en"],
            "bin_color": info["bin_color"],
            "co2_saved_grams": info["co2_saved_grams"],
            "energy_saved": info["energy_saved"],
            "energy_saved_en": info["energy_saved_en"],
            "water_saved_liters": info["water_saved_liters"],
            "guide": info["guide"],
            "guide_en": info["guide_en"],
            "texture_description_ar": info["texture_description_ar"],
            "texture_description_en": info["texture_description_en"],
            "all_probabilities": all_probs
        }
