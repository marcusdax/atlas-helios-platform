-- Simple Atlas Helios Tables - Proper column names
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS property_assessments CASCADE;
DROP TABLE IF EXISTS storm_events CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS estimates CASCADE;
DROP TABLE IF EXISTS monitoring_regions CASCADE;

CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    property_type VARCHAR(50) DEFAULT 'residential',
    year_built INTEGER,
    square_footage INTEGER,
    lot_size INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    roof_type VARCHAR(50),
    construction_type VARCHAR(50),
    estimated_value DECIMAL(12, 2),
    current_risk_level VARCHAR(50) DEFAULT 'low',
    last_assessment_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE property_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    assessor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assessment_type VARCHAR(50) DEFAULT 'initial',
    status VARCHAR(50) DEFAULT 'scheduled',
    overall_score INTEGER,
    damage_score INTEGER,
    risk_level VARCHAR(50),
    estimated_repair_cost DECIMAL(12, 2),
    ai_analysis JSONB,
    recommendations JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE storm_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region_id VARCHAR(100) NOT NULL,
    region_name VARCHAR(255) NOT NULL,
    storm_type VARCHAR(50) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    conditions JSONB,
    center JSONB NOT NULL,
    detected_at TIMESTAMP NOT NULL,
    dissipated_at TIMESTAMP,
    estimated_duration VARCHAR(100),
    alert_level VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    current_conditions JSONB,
    last_update TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    storm_event_id UUID REFERENCES storm_events(id) ON DELETE SET NULL,
    damage_probability_score INTEGER NOT NULL,
    lead_status VARCHAR(50) DEFAULT 'new',
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    assigned_to VARCHAR(255),
    notes JSONB,
    estimated_value DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    estimate_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    total_amount DECIMAL(12, 2),
    labor_cost DECIMAL(12, 2),
    material_cost DECIMAL(12, 2),
    line_items JSONB,
    notes TEXT,
    sent_date TIMESTAMP,
    approved_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monitoring_regions (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    center JSONB NOT NULL,
    radius INTEGER NOT NULL,
    bounds JSONB NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_properties_company ON properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_risk ON properties(current_risk_level);
CREATE INDEX IF NOT EXISTS idx_assessments_property ON property_assessments(property_id);
CREATE INDEX IF NOT EXISTS idx_storms_region ON storm_events(region_id);
CREATE INDEX IF NOT EXISTS idx_storms_status ON storm_events(status);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status);
