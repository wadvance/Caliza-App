-- ============================================================
-- GeoCaliza - Esquema completo para Supabase (PostgreSQL + PostGIS)
-- ============================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Requiere extensión PostGIS: CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enum tipos
CREATE TYPE rock_type AS ENUM (
  'caliza', 'dolomita', 'arcilla', 'yeso', 'granito',
  'basalto', 'marga', 'travertino', 'caliche', 'desconocido'
);

CREATE TYPE sample_status AS ENUM ('pendiente', 'validado', 'descartado');

CREATE TYPE acid_reaction AS ENUM ('vigorosa', 'moderada', 'leve', 'nula');

CREATE TYPE probability_level AS ENUM ('alta', 'media', 'baja', 'pendiente');

CREATE TYPE zone_source AS ENUM ('satellite', 'field', 'model');

-- 3. Tabla: samples
CREATE TABLE samples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  photo_urls TEXT[] DEFAULT '{}',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude DOUBLE PRECISION DEFAULT 0,
  operator_name TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT DEFAULT '',
  estimated_rock_type rock_type DEFAULT 'desconocido',
  acid_reaction acid_reaction,
  hardness DOUBLE PRECISION,
  color TEXT,
  texture TEXT,
  stratification TEXT,
  fossil_presence BOOLEAN DEFAULT FALSE,
  estimated_caco3 DOUBLE PRECISION,
  lab_caco3 DOUBLE PRECISION,
  lab_mgo DOUBLE PRECISION,
  lab_sio2 DOUBLE PRECISION,
  lab_al2o3 DOUBLE PRECISION,
  lab_fe2o3 DOUBLE PRECISION,
  lab_loi DOUBLE PRECISION,
  lab_moisture DOUBLE PRECISION,
  lab_date TIMESTAMPTZ,
  lab_name TEXT,
  confidence_level DOUBLE PRECISION DEFAULT 0,
  status sample_status DEFAULT 'pendiente',
  synced BOOLEAN DEFAULT TRUE,
  geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_samples_user ON samples(user_id);
CREATE INDEX idx_samples_status ON samples(status);
CREATE INDEX idx_samples_geom ON samples USING GIST(geom);
CREATE INDEX idx_samples_rock_type ON samples(estimated_rock_type);
CREATE INDEX idx_samples_created ON samples(created_at DESC);
CREATE INDEX idx_samples_synced ON samples(synced);

ALTER TABLE samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own samples"
  ON samples FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own samples"
  ON samples FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own samples"
  ON samples FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own samples"
  ON samples FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Tabla: caliza_zones
CREATE TABLE caliza_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  coordinates JSONB NOT NULL DEFAULT '[]',
  probability probability_level DEFAULT 'pendiente',
  confidence DOUBLE PRECISION DEFAULT 0,
  source zone_source DEFAULT 'field',
  geom GEOMETRY(Polygon, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_zones_user ON caliza_zones(user_id);
CREATE INDEX idx_zones_geom ON caliza_zones USING GIST(geom);
CREATE INDEX idx_zones_probability ON caliza_zones(probability);

ALTER TABLE caliza_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own zones"
  ON caliza_zones FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own zones"
  ON caliza_zones FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own zones"
  ON caliza_zones FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. Tabla: field_observations
CREATE TABLE field_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'outcrop',
  description TEXT DEFAULT '',
  photos TEXT[] DEFAULT '{}',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  geom GEOMETRY(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_observations_user ON field_observations(user_id);
CREATE INDEX idx_observations_geom ON field_observations USING GIST(geom);

ALTER TABLE field_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own observations"
  ON field_observations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own observations"
  ON field_observations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6. Tabla: satellite_analyses
CREATE TABLE satellite_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  source TEXT DEFAULT 'sentinel2',
  ndvi DOUBLE PRECISION,
  clay_ratio DOUBLE PRECISION,
  carbonate_index DOUBLE PRECISION,
  quartz_index DOUBLE PRECISION,
  zones JSONB DEFAULT '[]',
  result JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_satellite_user ON satellite_analyses(user_id);

ALTER TABLE satellite_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own satellite analyses"
  ON satellite_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own satellite analyses"
  ON satellite_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 7. Tabla: sync_logs
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  synced INT DEFAULT 0,
  errors JSONB DEFAULT '[]',
  status TEXT DEFAULT 'success',
  client_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_user ON sync_logs(user_id);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync logs"
  ON sync_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 8. Tabla: exploration_reports
CREATE TABLE exploration_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT '',
  author TEXT DEFAULT '',
  date_range JSONB DEFAULT '{}',
  statistics JSONB DEFAULT '{}',
  samples JSONB DEFAULT '[]',
  zones JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_user ON exploration_reports(user_id);

ALTER TABLE exploration_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports"
  ON exploration_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON exploration_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 9. Función para muestras cercanas (usa PostGIS)
CREATE OR REPLACE FUNCTION get_nearby_samples(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 5
)
RETURNS SETOF samples
LANGUAGE SQL
STABLE
AS $$
  SELECT *
  FROM samples
  WHERE ST_DWithin(
    geom,
    ST_SetSRID(ST_MakePoint(lng, lat), 4326),
    radius_km * 0.009  -- aprox: 1 grado ≈ 111km
  )
  ORDER BY geom <-> ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  LIMIT 100;
$$;

-- 10. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_samples_updated_at
  BEFORE UPDATE ON samples
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 11. Bucket de storage
-- Ejecutar manualmente en Supabase Dashboard → Storage:
-- CREATE BUCKET "caliza-photos" WITH (public = FALSE);
-- Luego agregar policy:
-- CREATE POLICY "Users can view own photos"
--   ON storage.objects FOR SELECT
--   USING (auth.uid()::text = (storage.foldername(name))[1]);
-- CREATE POLICY "Users can upload photos"
--   ON storage.objects FOR INSERT
--   WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
