"""Initial migration: create all tables"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "001"
down_revision = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), server_default="operator"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "satellite_analyses",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("date", sa.DateTime, server_default=sa.func.now()),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("ndvi", sa.Float, nullable=True),
        sa.Column("clay_ratio", sa.Float, nullable=True),
        sa.Column("carbonate_index", sa.Float, nullable=True),
        sa.Column("quartz_index", sa.Float, nullable=True),
        sa.Column("raw_data_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "samples",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("photo_urls", JSONB, server_default="[]"),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("altitude", sa.Float, server_default="0"),
        sa.Column("timestamp", sa.DateTime, server_default=sa.func.now()),
        sa.Column("notes", sa.Text, server_default=""),
        sa.Column("operator_name", sa.String(255), server_default=""),
        sa.Column("estimated_rock_type", sa.String(50), server_default="desconocido"),
        sa.Column("confidence_level", sa.Float, server_default="0"),
        sa.Column("status", sa.String(20), server_default="pendiente"),
        sa.Column("acid_reaction", sa.String(20), nullable=True),
        sa.Column("hardness", sa.Float, nullable=True),
        sa.Column("color", sa.String(100), nullable=True),
        sa.Column("texture", sa.String(100), nullable=True),
        sa.Column("stratification", sa.String(100), nullable=True),
        sa.Column("fossil_presence", sa.Boolean, server_default="false"),
        sa.Column("estimated_caco3", sa.Float, nullable=True),
        sa.Column("lab_caco3", sa.Float, nullable=True),
        sa.Column("lab_mgo", sa.Float, nullable=True),
        sa.Column("lab_sio2", sa.Float, nullable=True),
        sa.Column("lab_al2o3", sa.Float, nullable=True),
        sa.Column("lab_fe2o3", sa.Float, nullable=True),
        sa.Column("lab_loi", sa.Float, nullable=True),
        sa.Column("lab_moisture", sa.Float, nullable=True),
        sa.Column("lab_date", sa.DateTime, nullable=True),
        sa.Column("lab_name", sa.String(255), nullable=True),
        sa.Column("ml_prediction_class", sa.String(100), nullable=True),
        sa.Column("ml_prediction_probability", sa.Float, nullable=True),
        sa.Column("ml_model_version", sa.String(50), nullable=True),
        sa.Column("synced", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_index("idx_samples_location", "samples", ["location"], postgresql_using="gist")
    op.create_index("idx_samples_status", "samples", ["status"])

    op.create_table(
        "caliza_zones",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("geometry", Geometry("POLYGON", srid=4326), nullable=False),
        sa.Column("probability", sa.String(20), nullable=False),
        sa.Column("confidence", sa.Float, server_default="0"),
        sa.Column("source", sa.String(50), server_default="satellite"),
        sa.Column("analysis_id", UUID, sa.ForeignKey("satellite_analyses.id"), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_index("idx_zones_geometry", "caliza_zones", ["geometry"], postgresql_using="gist")

    op.create_table(
        "field_observations",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("observation_type", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("photos", JSONB, server_default="[]"),
        sa.Column("location", Geometry("POINT", srid=4326), nullable=False),
        sa.Column("timestamp", sa.DateTime, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "ml_predictions",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("sample_id", UUID, sa.ForeignKey("samples.id"), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("predicted_class", sa.String(100), nullable=False),
        sa.Column("probability", sa.Float, nullable=False),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("features", JSONB, server_default="{}"),
        sa.Column("processing_time_ms", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "sync_logs",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("device_id", sa.String(255), nullable=True),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("items_synced", sa.Integer, server_default="0"),
        sa.Column("status", sa.String(50), server_default="success"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "exploration_reports",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("date_range_start", sa.DateTime, nullable=False),
        sa.Column("date_range_end", sa.DateTime, nullable=False),
        sa.Column("statistics", JSONB, server_default="{}"),
        sa.Column("pdf_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("exploration_reports")
    op.drop_table("sync_logs")
    op.drop_table("ml_predictions")
    op.drop_table("field_observations")
    op.drop_table("caliza_zones")
    op.drop_table("samples")
    op.drop_table("satellite_analyses")
    op.drop_table("users")
