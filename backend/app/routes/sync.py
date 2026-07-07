from fastapi import APIRouter, Depends
from datetime import datetime, timezone
import uuid

from app.database import get_firestore_db
from app.schemas.__init__ import SyncRequest, SyncResponse
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/v1/sync", tags=["sync"])


@router.post("", response_model=SyncResponse)
async def sync_data(
    data: SyncRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    synced = 0
    errors = []

    batch = db.batch()
    now = datetime.now(timezone.utc)

    for sample_data in data.samples:
        try:
            doc_id = str(uuid.uuid4())
            doc_ref = db.collection("samples").document(doc_id)
            batch.set(doc_ref, {
                "userId": current_user["uid"],
                "photoUrls": [],
                "latitude": sample_data.latitude,
                "longitude": sample_data.longitude,
                "altitude": sample_data.altitude,
                "notes": sample_data.notes or "",
                "operatorName": sample_data.operator_name or current_user.get("name", ""),
                "estimatedRockType": sample_data.estimated_rock_type,
                "confidenceLevel": sample_data.confidence_level,
                "status": sample_data.status or "pendiente",
                "synced": True,
                "createdAt": now,
                "updatedAt": now,
            })
            synced += 1
        except Exception as e:
            errors.append(str(e))

    await batch.commit()

    log_ref = db.collection("syncLogs").document()
    await log_ref.set({
        "userId": current_user["uid"],
        "synced": synced,
        "errors": errors,
        "status": "partial" if errors else "success",
        "createdAt": now,
    })

    return SyncResponse(
        synced=synced,
        errors=errors,
        server_time=now,
    )


@router.get("/pending")
async def get_pending_sync(
    current_user: dict = Depends(get_current_user),
):
    db = get_firestore_db()
    q = db.collection("samples").where("userId", "==", current_user["uid"]).where("synced", "==", False)
    docs = [d async for d in q.stream()]
    samples = []
    for d in docs:
        data = d.to_dict()
        samples.append({
            "id": d.id,
            "latitude": data.get("latitude"),
            "longitude": data.get("longitude"),
            "altitude": data.get("altitude", 0),
            "notes": data.get("notes", ""),
            "operator_name": data.get("operatorName", ""),
            "estimated_rock_type": data.get("estimatedRockType", "desconocido"),
            "confidence_level": data.get("confidenceLevel", 0),
            "status": data.get("status", "pendiente"),
            "timestamp": data.get("createdAt"),
        })
    return {"pending": len(samples), "samples": samples}
