from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# Auth
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class LoginRequest(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "operator"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool = True


# Quick test
class QuickTestResult(BaseModel):
    acid_reaction: Optional[str] = None
    hardness: Optional[float] = None
    color: Optional[str] = None
    texture: Optional[str] = None
    stratification: Optional[str] = None
    fossil_presence: bool = False
    estimated_caco3: Optional[float] = None


# Lab result
class LabResult(BaseModel):
    caco3_purity: Optional[float] = None
    mgo: Optional[float] = None
    sio2: Optional[float] = None
    al2o3: Optional[float] = None
    fe2o3: Optional[float] = None
    loi: Optional[float] = None
    moisture: Optional[float] = None
    date: Optional[datetime] = None
    laboratory_name: Optional[str] = None


# Sample
class SampleCreate(BaseModel):
    latitude: float
    longitude: float
    altitude: float = 0
    notes: str = ""
    operator_name: str = ""
    estimated_rock_type: str = "desconocido"
    quick_test: Optional[QuickTestResult] = None
    lab_result: Optional[LabResult] = None
    confidence_level: float = 0
    status: str = "pendiente"


class SampleResponse(BaseModel):
    id: str
    latitude: float
    longitude: float
    altitude: float
    timestamp: datetime
    notes: str
    estimated_rock_type: str
    confidence_level: float
    status: str
    photo_urls: List[str] = []


class SampleDetailResponse(SampleResponse):
    operator_name: str
    acid_reaction: Optional[str] = None
    hardness: Optional[float] = None
    color: Optional[str] = None
    texture: Optional[str] = None
    stratification: Optional[str] = None
    fossil_presence: bool = False
    estimated_caco3: Optional[float] = None
    lab_caco3: Optional[float] = None
    lab_mgo: Optional[float] = None
    lab_sio2: Optional[float] = None
    lab_al2o3: Optional[float] = None
    lab_fe2o3: Optional[float] = None
    lab_loi: Optional[float] = None
    lab_purity: Optional[float] = None
    ml_prediction_class: Optional[str] = None
    ml_prediction_probability: Optional[float] = None


# Zone
class CalizaZoneResponse(BaseModel):
    id: str
    coordinates: List[List[float]]
    probability: str
    confidence: float
    source: str


# Sync
class SyncRequest(BaseModel):
    samples: List[SampleCreate] = []
    last_sync: Optional[datetime] = None


class SyncResponse(BaseModel):
    synced: int
    errors: List[str] = []
    server_time: datetime


# Report
class ReportStatistics(BaseModel):
    total_samples: int
    validated_samples: int
    high_probability_zones: int
    average_confidence: float
    dominant_rock_type: str
    area_covered_km2: float


class ReportResponse(BaseModel):
    id: str
    title: str
    generated_at: datetime
    statistics: Optional[ReportStatistics] = None
    pdf_url: Optional[str] = None


# Satellite analysis
class SatelliteAnalysisRequest(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 5
    source: str = "sentinel2"


class SatelliteAnalysisResponse(BaseModel):
    id: str
    ndvi: float
    clay_ratio: float
    carbonate_index: float
    zones: List[CalizaZoneResponse] = []
