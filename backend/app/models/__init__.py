import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geometry
from app.database import Base
import enum


class SampleStatus(str, enum.Enum):
    PENDIENTE = "pendiente"
    VALIDADO = "validado"
    DESCATADO = "descartado"


class AcidReaction(str, enum.Enum):
    VIGOROSA = "vigorosa"
    MODERADA = "moderada"
    LEVE = "leve"
    NULA = "nula"


class RockType(str, enum.Enum):
    CALIZA = "caliza"
    DOLOMITA = "dolomita"
    ARCILLA = "arcilla"
    YESO = "yeso"
    GRANITO = "granito"
    BASALTO = "basalto"
    MARGA = "marga"
    TRAVERTINO = "travertino"
    CALICHE = "caliche"
    DESCONOCIDO = "desconocido"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(50), default="operator")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Sample(Base):
    __tablename__ = "samples"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    photo_urls = Column(JSONB, default=list)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    altitude = Column(Float, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, default="")
    operator_name = Column(String(255), default="")

    estimated_rock_type = Column(Enum(RockType), default=RockType.DESCONOCIDO)
    confidence_level = Column(Float, default=0)
    status = Column(Enum(SampleStatus), default=SampleStatus.PENDIENTE)

    acid_reaction = Column(Enum(AcidReaction), nullable=True)
    hardness = Column(Float, nullable=True)
    color = Column(String(100), nullable=True)
    texture = Column(String(100), nullable=True)
    stratification = Column(String(100), nullable=True)
    fossil_presence = Column(Boolean, default=False)
    estimated_caco3 = Column(Float, nullable=True)

    lab_caco3 = Column(Float, nullable=True)
    lab_mgo = Column(Float, nullable=True)
    lab_sio2 = Column(Float, nullable=True)
    lab_al2o3 = Column(Float, nullable=True)
    lab_fe2o3 = Column(Float, nullable=True)
    lab_loi = Column(Float, nullable=True)
    lab_moisture = Column(Float, nullable=True)
    lab_date = Column(DateTime, nullable=True)
    lab_name = Column(String(255), nullable=True)

    ml_prediction_class = Column(String(100), nullable=True)
    ml_prediction_probability = Column(Float, nullable=True)
    ml_model_version = Column(String(50), nullable=True)

    synced = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CalizaZone(Base):
    __tablename__ = "caliza_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    geometry = Column(Geometry(geometry_type="POLYGON", srid=4326), nullable=False)
    probability = Column(String(20), nullable=False)
    confidence = Column(Float, default=0)
    source = Column(String(50), default="satellite")
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("satellite_analyses.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SatelliteAnalysis(Base):
    __tablename__ = "satellite_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    date = Column(DateTime, default=datetime.utcnow)
    source = Column(String(50), nullable=False)
    ndvi = Column(Float, nullable=True)
    clay_ratio = Column(Float, nullable=True)
    carbonate_index = Column(Float, nullable=True)
    quartz_index = Column(Float, nullable=True)
    raw_data_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FieldObservation(Base):
    __tablename__ = "field_observations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    observation_type = Column(String(50), nullable=False)
    description = Column(Text, default="")
    photos = Column(JSONB, default=list)
    location = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sample_id = Column(UUID(as_uuid=True), ForeignKey("samples.id"), nullable=True)
    image_url = Column(String(500), nullable=True)
    predicted_class = Column(String(100), nullable=False)
    probability = Column(Float, nullable=False)
    confidence = Column(Float, nullable=False)
    model_version = Column(String(50), nullable=False)
    features = Column(JSONB, default=dict)
    processing_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(String(255), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    items_synced = Column(Integer, default=0)
    status = Column(String(50), default="success")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExplorationReport(Base):
    __tablename__ = "exploration_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    date_range_start = Column(DateTime, nullable=False)
    date_range_end = Column(DateTime, nullable=False)
    statistics = Column(JSONB, default=dict)
    pdf_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
