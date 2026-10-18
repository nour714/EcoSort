# EcoSort System Thresholds & Calibration Reference

This document serves as the single source of truth for the heuristic, statistical, and neural confidence thresholds deployed in EcoSort.

---

## 1. Pre-Inference Quality Thresholds

Before passing images to the neural network, EcoSort calculates fast statistical descriptors on a downsampled 128x128 grayscale representation to catch unclassifiable photos.

| Parameter | Environment Variable | Default Value | Metric & Method | Purpose / Action |
|---|---|---|---|---|
| `BLUR_VAR_MIN` | `BLUR_VAR_MIN` | `35.0` | Variance of discrete 2D Laplacian operator | Flags motion blur or out-of-focus camera capture (`image_blurry`) |
| `DARK_MEAN_MAX` | `DARK_MEAN_MAX` | `30.0` | Mean 8-bit luminance $[0, 255]$ | Flags severe underexposure / pitch-black scenes (`image_too_dark`) |
| `BRIGHT_MEAN_MIN` | `BRIGHT_MEAN_MIN` | `230.0` | Mean 8-bit luminance $[0, 255]$ | Flags severe overexposure / camera glare (`image_too_bright`) |
| `FLAT_STD_MIN` | `FLAT_STD_MIN` | `15.0` | Standard deviation of pixel intensities | Flags uniform blank screens, covered lenses, or empty walls (`image_empty_or_flat`) |

---

## 2. Confidence Gating & Decision Policy

Post-softmax probabilities are filtered through a 3-tier gating policy:

| Decision State | Top-1 Confidence | Top-1 − Top-2 Margin | Action & UI Routing |
|---|---|---|---|
| **`confident`** | $\ge 75.0\%$ | $\ge 20.0\%$ | Instant automated routing to the nearest available waste bin |
| **`uncertain`** | $45.0\% \le p < 75.0\%$ | $< 20.0\%$ | Displays warning banner, presents Top-2 candidates, prompts user confirmation |
| **`rejected`** | $< 45.0\%$ | Any | Rejection state: prompts user to retake photo or manually select category |

---

## 3. Empirical Gating Performance on In-Distribution Samples

Evaluated across the 300 TrashNet distribution benchmark samples:

| Decision | Sample Count | Coverage (%) | Selective Accuracy (%) |
|---|---|---|---|
| **Confident** | 149 | 49.67% | **93.96%** |
| **Uncertain** | 109 | 36.33% | 71.56% |
| **Rejected** | 42 | 14.00% | 64.29% |
| **Total** | 300 | 100.0% | 81.67% (Overall) |

> [!NOTE]
> Gating elevates decision accuracy from **81.67%** baseline to **93.96%** within the automated `confident` partition, preventing misrouting for ambiguous inputs.
