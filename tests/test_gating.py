from ecosort.config import Config

def test_confidence_gating_logic():
    # 1. Confident case: Top1 >= 75% and Margin >= 20%
    probs_confident = [0.05, 0.05, 0.85, 0.02, 0.01, 0.02]
    top1 = max(probs_confident) * 100
    sorted_p = sorted(probs_confident, reverse=True)
    margin = (sorted_p[0] - sorted_p[1]) * 100
    assert top1 >= Config.CONF_HIGH
    assert margin >= Config.MARGIN_MIN

    # 2. Uncertain case: Top1 is around 55% or close competitor
    probs_uncertain = [0.45, 0.40, 0.05, 0.05, 0.03, 0.02]
    top1 = max(probs_uncertain) * 100
    sorted_p = sorted(probs_uncertain, reverse=True)
    margin = (sorted_p[0] - sorted_p[1]) * 100
    is_confident = (top1 >= Config.CONF_HIGH and margin >= Config.MARGIN_MIN)
    assert not is_confident
    assert top1 >= Config.CONF_LOW  # Still uncertain, not rejected

    # 3. Rejected case: High entropy or Top1 < 45%
    probs_rejected = [0.20, 0.18, 0.16, 0.16, 0.15, 0.15]
    top1 = max(probs_rejected) * 100
    assert top1 < Config.CONF_LOW
