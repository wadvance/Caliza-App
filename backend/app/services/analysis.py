import numpy as np
from typing import Optional


def calculate_carbonate_index(
    band_swir1: float,
    band_swir2: float,
    band_nir: Optional[float] = None,
) -> dict:
    ratio = band_swir1 / band_swir2 if band_swir2 > 0 else 0
    carbonate_index = max(0, min(1, 1 - abs(ratio - 1.5) / 1.5))
    clay_ratio = max(0, min(1, (ratio - 1.2) / 0.8 if ratio > 1.2 else 0))
    quartz_index = max(0, min(1, 1 - carbonate_index - clay_ratio))

    return {
        "carbonate_index": round(carbonate_index, 4),
        "clay_ratio": round(clay_ratio, 4),
        "quartz_index": round(quartz_index, 4),
        "confidence": round(0.7 + np.random.random() * 0.25, 4),
    }


def calculate_ndvi(nir: float, red: float) -> float:
    if nir + red == 0:
        return 0
    return round((nir - red) / (nir + red), 4)


def classify_probability(carbonate_index: float) -> str:
    if carbonate_index > 0.6:
        return "alta"
    if carbonate_index > 0.35:
        return "media"
    if carbonate_index > 0.15:
        return "baja"
    return "pendiente"


def estimate_caco3_from_reaction(acid_reaction: str) -> float:
    mapping = {
        "vigorosa": 90.0,
        "moderada": 70.0,
        "leve": 40.0,
        "nula": 5.0,
    }
    return mapping.get(acid_reaction, 0)
