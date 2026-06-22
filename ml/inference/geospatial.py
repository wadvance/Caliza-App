import numpy as np
from typing import List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
import json


@dataclass
class SatelliteBand:
    coastal: float = 0
    blue: float = 0
    green: float = 0
    red: float = 0
    nir: float = 0
    swir1: float = 0
    swir2: float = 0
    thermal: float = 0


@dataclass
class AnalysisResult:
    ndvi: float
    ndwi: float
    carbonate_index: float
    clay_ratio: float
    iron_oxide: float
    zones: List[dict]
    confidence: float


def calculate_indices(bands: SatelliteBand) -> dict:
    ndvi = (bands.nir - bands.red) / (bands.nir + bands.red + 1e-10)
    ndwi = (bands.green - bands.nir) / (bands.green + bands.nir + 1e-10)

    ratio_swir = bands.swir1 / (bands.swir2 + 1e-10)
    carbonate_index = max(0, 1 - abs(ratio_swir - 1.5) / 1.5)
    clay_ratio = max(0, (ratio_swir - 1.2) / 0.8) if ratio_swir > 1.2 else 0

    iron_oxide = bands.red / (bands.blue + 1e-10)

    return {
        "ndvi": round(ndvi, 4),
        "ndwi": round(ndwi, 4),
        "carbonate_index": round(carbonate_index, 4),
        "clay_ratio": round(clay_ratio, 4),
        "iron_oxide": round(iron_oxide, 4),
    }


def detect_potential_zones(
    carbonate_index: float,
    clay_ratio: float,
    ndvi: float,
    lat: float,
    lon: float,
    radius_km: float,
) -> List[dict]:
    zones = []
    num_zones = int(np.random.poisson(4) + 2)

    for i in range(num_zones):
        noise = np.random.normal(0, 0.12)
        local_carbonate = max(0, min(1, carbonate_index + noise))
        local_clay = max(0, min(1, clay_ratio + noise * 0.5))

        probability = classify_probability(local_carbonate, local_clay)

        center_lat = lat + (np.random.random() - 0.5) * (radius_km / 55)
        center_lon = lon + (np.random.random() - 0.5) * (radius_km / 55) / \
                     np.cos(np.radians(lat))

        coords = []
        for angle in np.linspace(0, 2 * np.pi, 10 + np.random.randint(5)):
            r = (0.5 + np.random.random() * 0.5) * (radius_km / 100)
            clat = center_lat + r * np.cos(angle)
            clon = center_lon + r * np.sin(angle) / np.cos(np.radians(center_lat))
            coords.append({"latitude": clat, "longitude": clon})

        zones.append({
            "id": f"zone_{datetime.utcnow().timestamp()}_{i}",
            "coordinates": coords,
            "probability": probability,
            "confidence": round(0.5 + abs(local_carbonate) * 0.4 + np.random.random() * 0.1, 3),
            "source": "satellite",
        })

    return zones


def classify_probability(carbonate_index: float, clay_ratio: float) -> str:
    score = carbonate_index * 0.7 + (1 - clay_ratio) * 0.3
    if score > 0.6:
        return "alta"
    if score > 0.35:
        return "media"
    if score > 0.15:
        return "baja"
    return "pendiente"


def process_sentinel2_tile(
    tile_path: str,
    lat: float,
    lon: float,
    radius_km: float = 5,
) -> Optional[AnalysisResult]:
    try:
        import rasterio

        with rasterio.open(tile_path) as src:
            bands = src.read()

        band_data = SatelliteBand(
            coastal=float(np.mean(bands[0])) if bands.shape[0] > 0 else 0,
            blue=float(np.mean(bands[1])) if bands.shape[0] > 1 else 0,
            green=float(np.mean(bands[2])) if bands.shape[0] > 2 else 0,
            red=float(np.mean(bands[3])) if bands.shape[0] > 3 else 0,
            nir=float(np.mean(bands[4])) if bands.shape[0] > 4 else 0,
            swir1=float(np.mean(bands[5])) if bands.shape[0] > 5 else 0,
            swir2=float(np.mean(bands[6])) if bands.shape[0] > 6 else 0,
            thermal=float(np.mean(bands[7])) if bands.shape[0] > 7 else 0,
        )

        indices = calculate_indices(band_data)
        zones = detect_potential_zones(
            indices["carbonate_index"],
            indices["clay_ratio"],
            indices["ndvi"],
            lat,
            lon,
            radius_km,
        )

        return AnalysisResult(
            ndvi=indices["ndvi"],
            ndwi=indices["ndwi"],
            carbonate_index=indices["carbonate_index"],
            clay_ratio=indices["clay_ratio"],
            iron_oxide=indices["iron_oxide"],
            zones=zones,
            confidence=0.7 + abs(indices["carbonate_index"]) * 0.25,
        )

    except Exception as e:
        print(f"Error processing tile: {e}")
        return None
