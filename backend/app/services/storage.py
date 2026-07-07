from app.database import get_storage_bucket


async def ensure_bucket_exists():
    pass


async def upload_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    bucket = get_storage_bucket()
    blob = bucket.blob(f"samples/{filename}")
    blob.upload_from_string(file_bytes, content_type=content_type)
    blob.make_public()
    return blob.public_url


async def get_download_url(key: str, expires: int = 3600) -> str:
    bucket = get_storage_bucket()
    blob = bucket.blob(key)
    return blob.generate_signed_url(expiration=expires)
