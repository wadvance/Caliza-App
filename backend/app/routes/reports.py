from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta
from uuid import UUID

from app.database import get_db
from app.models.__init__ import Sample, CalizaZone, ExplorationReport, User
from app.schemas.__init__ import ReportResponse, ReportStatistics
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])


@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    days: int = 30,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    end = datetime.utcnow()
    start = end - timedelta(days=days)

    samples_result = await db.execute(
        select(Sample).where(
            Sample.user_id == user.id,
            Sample.timestamp.between(start, end),
        )
    )
    samples = samples_result.scalars().all()

    zones_result = await db.execute(
        select(CalizaZone).where(CalizaZone.created_at.between(start, end))
    )
    zones = zones_result.scalars().all()

    validated = [s for s in samples if s.status == "validado"]
    high_prob = [z for z in zones if z.probability == "alta"]
    avg_conf = sum(s.confidence_level for s in samples) / max(len(samples), 1)
    rock_types = [s.estimated_rock_type.value for s in samples]
    dominant = max(set(rock_types), key=rock_types.count) if rock_types else "desconocido"

    stats = ReportStatistics(
        total_samples=len(samples),
        validated_samples=len(validated),
        high_probability_zones=len(high_prob),
        average_confidence=round(avg_conf, 2),
        dominant_rock_type=dominant,
        area_covered_km2=round(len(zones) * 0.5, 2),
    )

    report = ExplorationReport(
        user_id=user.id,
        title=f"Reporte de exploración - {start.date()} a {end.date()}",
        date_range_start=start,
        date_range_end=end,
        statistics=stats.model_dump(),
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)

    return ReportResponse(
        id=report.id,
        title=report.title,
        generated_at=report.created_at,
        statistics=stats,
    )


@router.get("", response_model=list[ReportResponse])
async def list_reports(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExplorationReport)
        .where(ExplorationReport.user_id == user.id)
        .order_by(ExplorationReport.created_at.desc())
        .limit(20)
    )
    reports = result.scalars().all()
    return [
        ReportResponse(
            id=r.id,
            title=r.title,
            generated_at=r.created_at,
            statistics=ReportStatistics(**r.statistics) if r.statistics else None,
        )
        for r in reports
    ]
