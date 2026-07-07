from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from app.database import get_firestore_db, get_storage_bucket
from app.schemas.__init__ import SampleCreate, SampleResponse, SampleDetailResponse
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/v1/samples", tags=["samples"])


@router.post("", response_model=SampleResponse)
async def create_sample(
    data: SampleCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    sample_data = {
        "userId": current_user["uid"],
        "photoUrls": [],
        "latitude": data.latitude,
        "longitude": data.longitude,
        "altitude": data.altitude,
        "operatorName": data.operator_name or current_user.get("name", ""),
        "notes": data.notes,
        "estimatedRockType": data.estimated_rock_type,
        "confidenceLevel": data.confidence_level,
        "status": data.status,
        "synced": True,
        "createdAt": now,
        "updatedAt": now,
    }
    if data.quick_test:
        sample_data.update({
            "acidReaction": data.quick_test.acid_reaction,
            "hardness": data.quick_test.hardness,
            "color": data.quick_test.color,
            "texture": data.quick_test.texture,
            "stratification": data.quick_test.stratification,
            "fossilPresence": data.quick_test.fossil_presence,
            "estimatedCaco3": data.quick_test.estimated_caco3,
        })
    if data.lab_result:
        sample_data.update({
            "labCaco3": data.lab_result.caco3_purity,
            "labMgo": data.lab_result.mgo,
            "labSio2": data.lab_result.sio2,
            "labAl2o3": data.lab_result.al2o3,
            "labFe2o3": data.lab_result.fe2o3,
            "labLoi": data.lab_result.loi,
            "labMoisture": data.lab_result.moisture,
            "labDate": data.lab_result.date,
            "labName": data.lab_result.laboratory_name,
        })
    await db.collection("samples").document(doc_id).set(sample_data)
    sample_data["id"] = doc_id
    return SampleResponse(
        id=doc_id,
        latitude=data.latitude,
        longitude=data.longitude,
        altitude=data.altitude,
        timestamp=now,
        notes=data.notes,
        estimated_rock_type=data.estimated_rock_type,
        confidence_level=data.confidence_level,
        status=data.status,
    )


@router.post("/{sample_id}/photo")
async def upload_sample_photo(
    sample_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    doc_ref = db.collection("samples").document(sample_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(404, "Sample not found")

    contents = await file.read()
    bucket = get_storage_bucket()
    blob = bucket.blob(f"samples/{sample_id}/{file.filename}")
    blob.upload_from_string(contents, content_type=file.content_type or "image/jpeg")
    blob.make_public()
    url = blob.public_url

    urls = list(doc.to_dict().get("photoUrls", []))
    urls.append(url)
    await doc_ref.update({"photoUrls": urls, "updatedAt": datetime.now(timezone.utc)})
    return {"url": url}


@router.get("", response_model=List[SampleResponse])
async def list_samples(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    q = db.collection("samples").where("userId", "==", current_user["uid"])
    if status:
        q = q.where("status", "==", status)
    q = q.order_by("createdAt", direction="DESCENDING").offset(skip).limit(limit)
    docs = [d async for d in q.stream()]
    return [
        SampleResponse(
            id=d.id,
            latitude=d.to_dict().get("latitude", 0),
            longitude=d.to_dict().get("longitude", 0),
            altitude=d.to_dict().get("altitude", 0),
            timestamp=d.to_dict().get("createdAt", datetime.now(timezone.utc)),
            notes=d.to_dict().get("notes", ""),
            estimated_rock_type=d.to_dict().get("estimatedRockType", "desconocido"),
            confidence_level=d.to_dict().get("confidenceLevel", 0),
            status=d.to_dict().get("status", "pendiente"),
            photo_urls=d.to_dict().get("photoUrls", []),
        )
        for d in docs
    ]


@router.get("/{sample_id}", response_model=SampleDetailResponse)
async def get_sample(
    sample_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    doc = await db.collection("samples").document(sample_id).get()
    if not doc.exists:
        raise HTTPException(404, "Sample not found")
    d = doc.to_dict()
    return SampleDetailResponse(
        id=doc.id,
        latitude=d.get("latitude", 0),
        longitude=d.get("longitude", 0),
        altitude=d.get("altitude", 0),
        timestamp=d.get("createdAt", datetime.now(timezone.utc)),
        notes=d.get("notes", ""),
        estimated_rock_type=d.get("estimatedRockType", "desconocido"),
        confidence_level=d.get("confidenceLevel", 0),
        status=d.get("status", "pendiente"),
        photo_urls=d.get("photoUrls", []),
        operator_name=d.get("operatorName", ""),
        acid_reaction=d.get("acidReaction"),
        hardness=d.get("hardness"),
        color=d.get("color"),
        texture=d.get("texture"),
        stratification=d.get("stratification"),
        fossil_presence=d.get("fossilPresence", False),
        estimated_caco3=d.get("estimatedCaco3"),
        lab_caco3=d.get("labCaco3"),
        lab_mgo=d.get("labMgo"),
        lab_sio2=d.get("labSio2"),
        lab_al2o3=d.get("labAl2o3"),
        lab_fe2o3=d.get("labFe2o3"),
        lab_loi=d.get("labLoi"),
    )


@router.patch("/{sample_id}/status")
async def update_sample_status(
    sample_id: str,
    status: str = Form(...),
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    doc_ref = db.collection("samples").document(sample_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(404, "Sample not found")
    await doc_ref.update({"status": status, "updatedAt": datetime.now(timezone.utc)})
    return {"status": status}


@router.get("/nearby", response_model=List[SampleResponse])
async def get_nearby_samples(
    latitude: float,
    longitude: float,
    radius_km: float = 5,
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    lat_delta = radius_km / 111
    lng_delta = radius_km / (111 * abs(__import__("math").cos(latitude * __import__("math").pi / 180)) or 1)

    q = db.collection("samples").where("userId", "==", current_user["uid"])
    q = q.where("latitude", ">=", latitude - lat_delta).where("latitude", "<=", latitude + lat_delta)
    docs = [d async for d in q.stream()]

    result = []
    for d in docs:
        data = d.to_dict()
        dist = haversine(latitude, longitude, data.get("latitude", 0), data.get("longitude", 0))
        if dist <= radius_km:
            result.append(SampleResponse(
                id=d.id,
                latitude=data.get("latitude", 0),
                longitude=data.get("longitude", 0),
                altitude=data.get("altitude", 0),
                timestamp=data.get("createdAt", datetime.now(timezone.utc)),
                notes=data.get("notes", ""),
                estimated_rock_type=data.get("estimatedRockType", "desconocido"),
                confidence_level=data.get("confidenceLevel", 0),
                status=data.get("status", "pendiente"),
                photo_urls=data.get("photoUrls", []),
            ))
    return result[:100]


def haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    import math
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
