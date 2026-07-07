import firebase_admin
from firebase_admin import credentials, auth, storage as fb_storage
from google.cloud.firestore import AsyncClient, SERVER_TIMESTAMP
from google.cloud.firestore_v1.async_client import AsyncClient as FirestoreAsyncClient
from google.oauth2 import service_account
from .config import get_settings
import os

settings = get_settings()
_db = None
_bucket = None

def get_firebase_app():
    if not firebase_admin._apps:
        if settings.FIREBASE_SERVICE_ACCOUNT_PATH and os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT_PATH):
            cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred, {
                'storageBucket': settings.FIREBASE_STORAGE_BUCKET,
            })
        else:
            cred = credentials.ApplicationDefault()
            firebase_admin.initialize_app(cred, {
                'projectId': settings.FIREBASE_PROJECT_ID,
                'storageBucket': settings.FIREBASE_STORAGE_BUCKET,
            })
    return firebase_admin.get_app()

def get_firestore_db() -> AsyncClient:
    global _db
    if _db is None:
        get_firebase_app()
        if settings.FIREBASE_SERVICE_ACCOUNT_PATH and os.path.exists(settings.FIREBASE_SERVICE_ACCOUNT_PATH):
            cred = service_account.Credentials.from_service_account_file(
                settings.FIREBASE_SERVICE_ACCOUNT_PATH
            )
            _db = FirestoreAsyncClient(credentials=cred, project=settings.FIREBASE_PROJECT_ID)
        else:
            _db = FirestoreAsyncClient(project=settings.FIREBASE_PROJECT_ID)
    return _db

def get_storage_bucket():
    global _bucket
    if _bucket is None:
        get_firebase_app()
        _bucket = fb_storage.bucket()
    return _bucket

async def init_db():
    get_firestore_db()
