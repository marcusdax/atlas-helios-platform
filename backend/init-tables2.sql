-- Simple Atlas Helios Tables - CamelCase
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
    zipCode VARCHAR(20),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    settings JSONB,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    companyId UUID REFERENCES companies(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'active',
    emailVerified BOOLEAN DEFAULT FALSE,
    lastLoginAt TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    companyId UUID REFERENCES companies(id) ON DELETE CASCADE,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zipCode VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    propertyType VARCHAR(50) DEFAULT 'residential',
    yearBuilt INTEGER,
    squareFootage INTEGER,
    lotSize INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3, 1),
    roofType VARCHAR(50),
    constructionType VARCHAR(50),
    estimatedValue DECIMAL(12, 2),
    currentRiskLevel VARCHAR(50) DEFAULT 'low',
    lastAssessmentScore INTEGER,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE property_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    propertyId UUID REFERENCES properties(id) ON DELETE CASCADE,
    assessorId UUID REFERENCES users(id) ON DELETE SET NULL,
    assessmentType VARCHAR(50) DEFAULT 'initial',
    status VARCHAR(50) DEFAULT 'scheduled',
    overallScore INTEGER,
    damageScore INTEGER,
    riskLevel VARCHAR(50),
    estimatedRepairCost DECIMAL(12, 2),
    aiAnalysis JSONB,
    recommendations JSONB,
    startedAt TIMESTAMP,
    completedAt TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE storm_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    regionId VARCHAR(100) NOT NULL,
    regionName VARCHAR(255) NOT NULL,
    stormType VARCHAR(50) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    conditions JSONB,
    center JSONB NOT NULL,
    detectedAt TIMESTAMP NOT NULL,
    dissipatedAt TIMESTAMP,
    estimatedDuration VARCHAR(100),
    alertLevel VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    currentConditions JSONB,
    lastUpdate TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    companyId UUID REFERENCES companies(id) ON DELETE CASCADE,
    propertyId UUID REFERENCES properties(id) ON DELETE SET NULL,
    stormEventId UUID REFERENCES storm_events(id) ON DELETE SET NULL,
    damageProbabilityScore INTEGER NOT NULL,
    leadStatus VARCHAR(50) DEFAULT 'new',
    contactName VARCHAR(255),
    contactEmail VARCHAR(255),
    contactPhone VARCHAR(50),
    assignedTo VARCHAR(255),
    notes JSONB,
    estimatedValue DECIMAL(12, 2),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    companyId UUID REFERENCES companies(id) ON DELETE CASCADE,
    propertyId UUID REFERENCES properties(id) ON DELETE SET NULL,
    leadId UUID REFERENCES leads(id) ON DELETE SET NULL,
    createdBy UUID REFERENCES users(id) ON DELETE SET NULL,
    estimateNumber VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',
    totalAmount DECIMAL(12, 2),
    laborCost DECIMAL(12, 2),
    materialCost DECIMAL(12, 2),
    lineItems JSONB,
    notes TEXT,
    sentDate TIMESTAMP,
    approvedDate TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE monitoring_regions (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    center JSONB NOT NULL,
    radius INTEGER NOT NULL,
    bounds JSONB NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_properties_company ON properties(companyId);
CREATE INDEX IF NOT EXISTS idx_properties_risk ON properties(currentRiskLevel);
CREATE INDEX IF NOT EXISTS idx_assessments_property ON property_assessments(propertyId);
CREATE INDEX IF NOT EXISTS idx_storms_region ON storm_events(regionId);
CREATE INDEX IF NOT EXISTS idx_storms_status ON storm_events(status);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(companyId);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(leadStatus);
