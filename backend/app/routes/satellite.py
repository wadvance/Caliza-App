from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from geoalchemy2 import Geography
from app.database import get_db
from app.models.__init__ import SatelliteAnalysis, CalizaZone, User
from app.schemas.__init__ import SatelliteAnalysisRequest, SatelliteAnalysisResponse, CalizaZoneResponse
from app.middleware.auth import get_current_user
from app.services.analysis import (
    calculate_carbonate_index,
    calculate_ndvi,
    classify_probability,
)
import numpy as np

router = APIRouter(prefix="/api/v1/satellite", tags=["satellite"])


@router.post("/analyze", response_model=SatelliteAnalysisResponse)
async def analyze_region(
    data: SatelliteAnalysisRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    nir, red, swir1, swir2 = 0.35, 0.12, 0.28, 0.18

    ndvi = calculate_ndvi(nir, red)
    indices = calculate_carbonate_index(swir1, swir2)

    point = func.ST_SetSRID(func.ST_MakePoint(data.longitude, data.latitude), 4326)

    analysis = SatelliteAnalysis(
        location=point,
        source=data.source,
        ndvi=ndvi,
        clay_ratio=indices["clay_ratio"],
        carbonate_index=indices["carbonate_index"],
        quartz_index=indices["quartz_index"],
    )
    db.add(analysis)
    await db.flush()

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
        polygon_wkt = f"POLYGON(({','.join(f'{c[0]} {c[1]}' for c in coords)}))"

        zone = CalizaZone(
            geometry=func.ST_SetSRID(func.ST_GeomFromText(polygon_wkt), 4326),
            probability=prob,
            confidence=round(0.5 + np.random.random() * 0.4, 4),
            source="satellite",
            analysis_id=analysis.id,
        )
        db.add(zone)
        zones.append(zone)

    await db.flush()

    zone_responses = []
    for z in zones:
        coords_result = await db.execute(
            select(func.ST_AsGeoJSON(z.geometry))
        )
        geo_json = coords_result.scalar()
        zone_responses.append(parse_zone(z, geo_json))

    return SatelliteAnalysisResponse(
        id=analysis.id,
        ndvi=ndvi,
        clay_ratio=indices["clay_ratio"],
        carbonate_index=indices["carbonate_index"],
        zones=zone_responses,
    )


def parse_zone(zone: CalizaZone, geo_json: str) -> CalizaZoneResponse:
    import json
    geom = json.loads(geo_json) if geo_json else {}
    coords = geom.get("coordinates", [[]])[0] if geom else []
    return CalizaZoneResponse(
        id=zone.id,
        coordinates=[[c[1], c[0]] for c in coords],
        probability=zone.probability,
        confidence=zone.confidence,
        source=zone.source,
    )
