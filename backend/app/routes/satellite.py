from fastapi import APIRouter, Depends
from datetime import datetime, timezone
import uuid
import numpy as np

from app.database import get_firestore_db
from app.schemas.__init__ import SatelliteAnalysisRequest, SatelliteAnalysisResponse, CalizaZoneResponse
from app.middleware.auth import get_current_user
from app.services.analysis import (
    calculate_carbonate_index,
    calculate_ndvi,
    classify_probability,
)

router = APIRouter(prefix="/api/v1/satellite", tags=["satellite"])


@router.post("/analyze", response_model=SatelliteAnalysisResponse)
async def analyze_region(
    data: SatelliteAnalysisRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    nir, red, swir1, swir2 = 0.35, 0.12, 0.28, 0.18

    ndvi = calculate_ndvi(nir, red)
    indices = calculate_carbonate_index(swir1, swir2)

    analysis_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    zones = []
    for _ in range(np.random.randint(3, 8)):
        offset_lat = (np.random.random() - 0.5) * (data.radius_km / 55)
        offset_lon = (np.random.random() - 0.5) * (data.radius_km / 55) / \
                     np.cos(np.radians(data.latitude))

        center_lat = data.latitude + offset_lat
        center_lon = data.longitude + offset_lon
        carbonate_idx = max(0, min(1, indices["carbonate_index"] + np.random.normal(0, 0.15)))
        prob = classify_probability(carbonate_idx)

        coords = []
        for angle in np.linspace(0, 2 * np.pi, 12):
            r = np.random.random() * 0.3 + 0.7
            clat = center_lat + (r * data.radius_km / 100) * np.cos(angle)
            clon = center_lon + (r * data.radius_km / 100) * np.sin(angle) / \
                   np.cos(np.radians(center_lat))
            coords.append([clon, clat])
        coords.append(coords[0])

        zone_id = str(uuid.uuid4())
        zone_data = {
            "analysisId": analysis_id,
            "probability": prob,
            "confidence": round(0.5 + np.random.random() * 0.4, 4),
            "source": "satellite",
            "coordinates": coords,
            "createdAt": now,
        }
        await db.collection("calizaZones").document(zone_id).set(zone_data)
        zones.append(CalizaZoneResponse(
            id=zone_id,
            coordinates=coords,
            probability=prob,
            confidence=zone_data["confidence"],
            source="satellite",
        ))

    analysis_data = {
        "userId": current_user["uid"],
        "latitude": data.latitude,
        "longitude": data.longitude,
        "source": data.source,
        "ndvi": ndvi,
        "clayRatio": indices["clay_ratio"],
        "carbonateIndex": indices["carbonate_index"],
        "quartzIndex": indices["quartz_index"],
        "zones": [z.model_dump() for z in zones],
        "createdAt": now,
    }
    await db.collection("satelliteAnalyses").document(analysis_id).set(analysis_data)

    return SatelliteAnalysisResponse(
        id=analysis_id,
        ndvi=ndvi,
        clay_ratio=indices["clay_ratio"],
        carbonate_index=indices["carbonate_index"],
        zones=zones,
    )
