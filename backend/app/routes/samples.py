from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from geoalchemy2 import Geography
from uuid import UUID
from datetime import datetime
from typing import List, Optional
import json

from app.database import get_db
from app.models.__init__ import Sample, User, MLPrediction
from app.schemas.__init__ import SampleCreate, SampleResponse, SampleDetailResponse
from app.middleware.auth import get_current_user
from app.services.storage import upload_file

router = APIRouter(prefix="/api/v1/samples", tags=["samples"])


@router.post("", response_model=SampleResponse)
async def create_sample(
    data: SampleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sample = Sample(
        user_id=user.id,
        location=func.ST_SetSRID(func.ST_MakePoint(data.longitude, data.latitude), 4326),
        altitude=data.altitude,
        notes=data.notes,
        operator_name=data.operator_name or user.full_name,
        estimated_rock_type=data.estimated_rock_type,
        confidence_level=data.confidence_level,
        status=data.status,
    )
    db.add(sample)
    await db.flush()
    await db.refresh(sample)
    return sample


@router.post("/{sample_id}/photo")
async def upload_sample_photo(
    sample_id: UUID,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Sample).where(Sample.id == sample_id))
    sample = result.scalar_one_or_none()
    if not sample:
        raise HTTPException(404, "Sample not found")

    contents = await file.read()
    url = await upload_file(contents, f"{sample_id}_{file.filename}", file.content_type or "image/jpeg")

    urls = list(sample.photo_urls or [])
    urls.append(url)
    sample.photo_urls = urls
    await db.flush()
    return {"url": url}


@router.get("", response_model=List[SampleResponse])
async def list_samples(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Sample)
    if status:
        query = query.where(Sample.status == status)
    query = query.order_by(Sample.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{sample_id}", response_model=SampleDetailResponse)
async def get_sample(
    sample_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Sample).where(Sample.id == sample_id))
    sample = result.scalar_one_or_none()
    if not sample:
        raise HTTPException(404, "Sample not found")
    return sample


@router.patch("/{sample_id}/status")
async def update_sample_status(
    sample_id: UUID,
    status: str = Form(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Sample).where(Sample.id == sample_id))
    sample = result.scalar_one_or_none()
    if not sample:
        raise HTTPException(404, "Sample not found")
    sample.status = status
    await db.flush()
    return {"status": status}


@router.get("/nearby", response_model=List[SampleResponse])
async def get_nearby_samples(
    latitude: float,
    longitude: float,
    radius_km: float = 5,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
    query = select(Sample).where(
        func.ST_DWithin(
            Geography(Sample.location),
            Geography(point),
            radius_km * 1000,
        )
    )
    result = await db.execute(query)
    return result.scalars().all()
