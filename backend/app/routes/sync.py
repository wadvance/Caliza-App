from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List

from app.database import get_db
from app.models.__init__ import Sample, CalizaZone, SyncLog, User
from app.schemas.__init__ import SyncRequest, SyncResponse, SampleCreate
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


@router.post("", response_model=SyncResponse)
async def sync_data(
    data: SyncRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    synced = 0
    errors = []

    for sample_data in data.samples:
        try:
            sample = Sample(
                user_id=user.id,
                location=func.ST_SetSRID(
                    func.ST_MakePoint(sample_data.longitude, sample_data.latitude), 4326
                ),
                altitude=sample_data.altitude,
                notes=sample_data.notes,
                operator_name=sample_data.operator_name or user.full_name,
                estimated_rock_type=sample_data.estimated_rock_type,
                confidence_level=sample_data.confidence_level,
                status=sample_data.status,
                synced=True,
            )
            db.add(sample)
            synced += 1
        except Exception as e:
            errors.append(str(e))

    log = SyncLog(
        user_id=user.id,
        items_synced=synced,
        status="partial" if errors else "success",
        error_message="; ".join(errors[:5]) if errors else None,
    )
    db.add(log)
    await db.flush()

    return SyncResponse(
        synced=synced,
        errors=errors,
        server_time=datetime.utcnow(),
    )


@router.get("/pending")
async def get_pending_sync(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Sample).where(Sample.user_id == user.id, Sample.synced == False)
    )
    samples = result.scalars().all()
    return {"pending": len(samples), "samples": samples}
