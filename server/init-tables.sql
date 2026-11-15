CREATE TABLE IF NOT EXISTS properties (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  year_built INTEGER,
  square_feet INTEGER,
  roof_type TEXT,
  property_type TEXT DEFAULT 'residential',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storms (
  id SERIAL PRIMARY KEY,
  storm_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  affected_areas JSONB,
  track_data JSONB,
  max_wind_speed NUMERIC(5, 2),
  max_hail_size NUMERIC(4, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storm_impacts (
  id SERIAL PRIMARY KEY,
  storm_id INTEGER REFERENCES storms(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  damage_probability NUMERIC(3, 2),
  estimated_damage_cost NUMERIC(12, 2),
  damage_type TEXT,
  severity TEXT,
  assessment_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (storm_id, property_id)
);

CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
  storm_id INTEGER REFERENCES storms(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  scheduled_date TIMESTAMP,
  completed_date TIMESTAMP,
  damage_report JSONB,
  images JSONB,
  total_estimate NUMERIC(12, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS integration_logs (
  id SERIAL PRIMARY KEY,
  integration_name TEXT NOT NULL,
  level TEXT DEFAULT 'info',
  message TEXT,
  data JSONB,
  latency_ms NUMERIC(8, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weather_cache (
  id SERIAL PRIMARY KEY,
  location_key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS properties_location_idx ON properties (latitude, longitude);
CREATE INDEX IF NOT EXISTS properties_city_state_idx ON properties (state, city);
CREATE INDEX IF NOT EXISTS storms_type_severity_idx ON storms (type, severity);
CREATE INDEX IF NOT EXISTS storm_impacts_property_idx ON storm_impacts (property_id);
CREATE INDEX IF NOT EXISTS assessments_property_idx ON assessments (property_id);
CREATE INDEX IF NOT EXISTS assessments_status_idx ON assessments (status);
CREATE INDEX IF NOT EXISTS integration_logs_name_idx ON integration_logs (integration_name);
CREATE INDEX IF NOT EXISTS integration_logs_created_at_idx ON integration_logs (created_at);
CREATE INDEX IF NOT EXISTS weather_cache_expires_at_idx ON weather_cache (expires_at);