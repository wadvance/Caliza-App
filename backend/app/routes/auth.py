from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
from google.cloud.firestore import SERVER_TIMESTAMP

from app.database import get_firestore_db
from app.schemas.__init__ import LoginRequest, TokenResponse, UserCreate, UserResponse
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _create_custom_token(uid: str) -> str:
    return firebase_auth.create_custom_token(uid).decode("utf-8")


@router.post("/register", response_model=UserResponse)
async def register(data: UserCreate):
    db = get_firestore_db()
    try:
        user = firebase_auth.create_user(
            email=data.email,
            password=data.password,
            display_name=data.full_name,
        )
        await db.collection("users").document(user.uid).set({
            "email": data.email,
            "fullName": data.full_name,
            "role": data.role,
            "isActive": True,
            "createdAt": SERVER_TIMESTAMP,
        })
        return UserResponse(
            id=user.uid,
            email=data.email,
            full_name=data.full_name,
            role=data.role,
        )
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(400, "Email already registered")


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    try:
        user = firebase_auth.get_user_by_email(data.email)
        return TokenResponse(
            access_token=_create_custom_token(user.uid),
            expires_in=604800,
        )
    except firebase_auth.UserNotFoundError:
        raise HTTPException(401, "Invalid credentials")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    db = get_firestore_db()
    doc = await db.collection("users").document(current_user["uid"]).get()
    if not doc.exists:
        return UserResponse(
            id=current_user["uid"],
            email=current_user.get("email", ""),
            full_name=current_user.get("name", ""),
            role="operator",
        )
    data = doc.to_dict()
    return UserResponse(
        id=current_user["uid"],
        email=data.get("email", current_user.get("email", "")),
        full_name=data.get("fullName", current_user.get("name", "")),
        role=data.get("role", "operator"),
    )
