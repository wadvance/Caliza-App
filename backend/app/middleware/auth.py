from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth as firebase_auth
from app.database import get_firebase_app
import uuid

security = HTTPBearer()

def create_access_token(uid: str) -> str:
    return firebase_auth.create_custom_token(uid).decode("utf-8")

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    token = credentials.credentials
    try:
        decoded = firebase_auth.verify_id_token(token)
        return {
            "uid": decoded["uid"],
            "email": decoded.get("email", ""),
            "name": decoded.get("name", ""),
        }
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
