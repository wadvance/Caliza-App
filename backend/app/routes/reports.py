from fastapi import APIRouter, Depends
from datetime import datetime, timedelta, timezone
import uuid

from app.database import get_firestore_db
from app.schemas.__init__ import ReportResponse, ReportStatistics
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    days: int = 30,
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    samples_q = db.collection("samples").where("userId", "==", current_user["uid"])
    samples_docs = [d async for d in samples_q.stream()]

    zones_q = db.collection("calizaZones")
    zones_docs = [d async for d in zones_q.stream()]

    samples = []
    zones = []
    for d in samples_docs:
        data = d.to_dict()
        created = data.get("createdAt")
        if created and start <= created <= end:
            samples.append(data)
    for d in zones_docs:
        data = d.to_dict()
        created = data.get("createdAt")
        if created and start <= created <= end:
            zones.append(data)

    validated = [s for s in samples if s.get("status") == "validado"]
    high_prob = [z for z in zones if z.get("probability") == "alta"]
    avg_conf = sum(s.get("confidenceLevel", 0) for s in samples) / max(len(samples), 1)
    rock_types = [s.get("estimatedRockType", "desconocido") for s in samples]
    dominant = max(set(rock_types), key=rock_types.count) if rock_types else "desconocido"

    stats = ReportStatistics(
        total_samples=len(samples),
        validated_samples=len(validated),
        high_probability_zones=len(high_prob),
        average_confidence=round(avg_conf, 2),
        dominant_rock_type=dominant,
        area_covered_km2=round(len(zones) * 0.5, 2),
    )

    report_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    await db.collection("explorationReports").document(report_id).set({
        "userId": current_user["uid"],
        "title": f"Reporte de exploración - {start.date()} a {end.date()}",
        "dateRangeStart": start,
        "dateRangeEnd": end,
        "statistics": stats.model_dump(),
        "createdAt": now,
    })

    return ReportResponse(
        id=report_id,
        title=f"Reporte de exploración - {start.date()} a {end.date()}",
        generated_at=now,
        statistics=stats,
    )


@router.get("", response_model=list[ReportResponse])
async def list_reports(
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    q = db.collection("explorationReports").where("userId", "==", current_user["uid"]).order_by("createdAt", direction="DESCENDING").limit(20)
    docs = [d async for d in q.stream()]
    result = []
    for d in docs:
        data = d.to_dict()
        stats_data = data.get("statistics")
        stats = ReportStatistics(**stats_data) if stats_data else None
        result.append(ReportResponse(
            id=d.id,
            title=data.get("title", ""),
            generated_at=data.get("createdAt", datetime.now(timezone.utc)),
            statistics=stats,
        ))
    return result
