from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db
from app.services.storage import ensure_bucket_exists
from app.routes import auth, samples, sync, satellite, reports

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    try:
        await ensure_bucket_exists()
    except Exception:
        pass
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/admin", StaticFiles(directory="static/admin", html=True), name="admin")

app.include_router(auth.router)
app.include_router(samples.router)
app.include_router(sync.router)
app.include_router(satellite.router)
app.include_router(reports.router)


@app.get("/")
async def root():
    return RedirectResponse(url="/admin/")

@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.APP_NAME}
