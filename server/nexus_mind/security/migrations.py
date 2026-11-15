"""
Nexus Mind Security - Database Migrations

PostgreSQL migration scripts for ACP audit ledger and IronClaw integration.
Run migrations in order: 001 -> 002 -> etc.
"""

import os
import logging

logger = logging.getLogger(__name__)


MIGRATIONS = {
    "001_create_audit_ledger": """
-- Migration 001: Create core ACP audit ledger tables
-- Creates the immutable audit ledger for all system actions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Main audit ledger table (append-only, immutable)
CREATE TABLE IF NOT EXISTS acp_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ledger_id UUID NOT NULL DEFAULT uuid_generate_v4(),
    sequence_number BIGSERIAL,
    
    -- Action details
    action_type VARCHAR(100) NOT NULL,
    actor_id VARCHAR(255) NOT NULL,
    actor_type VARCHAR(50) NOT NULL DEFAULT 'system',
    
    -- Resource details
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    
    -- Timestamp (immutable after insert)
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Action data (encrypted JSON)
    payload JSONB NOT NULL,
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64) NOT NULL,
    
    -- Integrity verification
    signature BYTEA,
    verified BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    correlation_id UUID,
    session_id VARCHAR(255),
    ip_address INET,
    
    CONSTRAINT valid_ledger_order CHECK (
        sequence_number > 0
    )
);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_ledger_timestamp 
    ON acp_ledger (timestamp DESC);

-- Index for actor queries
CREATE INDEX IF NOT EXISTS idx_ledger_actor 
    ON acp_ledger (actor_id, timestamp DESC);

-- Index for resource queries  
CREATE INDEX IF NOT EXISTS idx_ledger_resource 
    ON acp_ledger (resource_type, resource_id, timestamp DESC);

-- Index for correlation tracking
CREATE INDEX IF NOT EXISTS idx_ledger_correlation 
    ON acp_ledger (correlation_id);

-- Make ledger tamper-evident with triggers
CREATE OR REPLACE FUNCTION update_ledger_hash()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate hash including previous entry's hash
    NEW.current_hash := encode(
        digest(
            COALESCE(NEW.previous_hash, '') || 
            COALESCE(NEW.action_type, '') || 
            COALESCE(NEW.actor_id, '') ||
            COALESCE(NEW.payload::TEXT, ''),
            'sha256'
        ),
        'hex'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Prevent updates (append-only)
CREATE OR REPLACE FUNCTION prevent_ledger_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ACP Ledger is append-only: updates not allowed';
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent updates/deletes
DROP TRIGGER IF EXISTS no_update_ledger ON acp_ledger;
CREATE CONSTRAINT TRIGGER no_update_ledger
    AFTER UPDATE OR DELETE ON acp_ledger
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_update();

-- Trigger for hash calculation on insert
DROP TRIGGER IF EXISTS set_ledger_hash ON acp_ledger;
CREATE TRIGGER set_ledger_hash
    BEFORE INSERT ON acp_ledger
    FOR EACH ROW EXECUTE FUNCTION update_ledger_hash();
""",
    "002_create_tool_executions": """
-- Migration 002: IronClaw tool execution audit trail
-- Tracks all tool executions through the sandbox

CREATE TABLE IF NOT EXISTS tool_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Execution details
    tool_name VARCHAR(255) NOT NULL,
    workspace_id VARCHAR(255) DEFAULT 'nexus_mind',
    
    -- Permissions and security
    permissions JSONB NOT NULL DEFAULT '[]',
    leak_detected BOOLEAN DEFAULT FALSE,
    blocked_pattern VARCHAR(255),
    
    -- Timing
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    execution_time_ms FLOAT,
    
    -- Results
    success BOOLEAN NOT NULL,
    error_message TEXT,
    output JSONB,
    
    -- Attestation (for hardware verification)
    attestation JSONB,
    attestation_verified BOOLEAN DEFAULT FALSE,
    
    -- Foreign key to main ledger
    ledger_entry_id UUID REFERENCES acp_ledger(id),
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for tool execution queries
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool 
    ON tool_executions (tool_name, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_tool_executions_workspace 
    ON tool_executions (workspace_id, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_tool_executions_leak 
    ON tool_executions (leak_detected, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_tool_executions_ledger 
    ON tool_executions (ledger_entry_id);
""",
    "003_create_credentials": """
-- Migration 003: Secure credential storage
-- Stores credentials with encryption for sandbox injection

CREATE TABLE IF NOT EXISTS credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Credential metadata (unencrypted)
    name VARCHAR(255) NOT NULL,
    credential_type VARCHAR(50) NOT NULL, -- api_key, token, password, etc.
    workspace_id VARCHAR(255),
    
    -- Encrypted credential value (AES-256)
    encrypted_value BYTEA NOT NULL,
    
    -- Key derivation info
    kdf_salt BYTEA,
    kdf_iterations INTEGER DEFAULT 100000,
    
    -- Access control
    allowed_tools TEXT[],
    allowed_ips INET[],
    expires_at TIMESTAMPTZ,
    
    -- Rotation tracking
    rotation_required BOOLEAN DEFAULT FALSE,
    last_rotated_at TIMESTAMPTZ,
    rotation_count INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL
);

-- Index for credential lookup
CREATE INDEX IF NOT EXISTS idx_credentials_id 
    ON credentials (credential_id);

CREATE INDEX IF NOT EXISTS idx_credentials_workspace 
    ON credentials (workspace_id, credential_type);

-- Function to rotate credential
CREATE OR REPLACE FUNCTION rotate_credential(
    p_credential_id VARCHAR,
    p_new_value BYTEA,
    p_rotated_by VARCHAR
) RETURNS VOID AS $$
BEGIN
    UPDATE credentials 
    SET encrypted_value = p_new_value,
        last_rotated_at = NOW(),
        rotation_count = rotation_count + 1,
        updated_at = NOW()
    WHERE credential_id = p_credential_id;
    
    -- Log to ledger
    INSERT INTO acp_ledger (action_type, actor_id, actor_type, resource_type, resource_id, payload)
    VALUES (
        'credential.rotate',
        p_rotated_by,
        'system',
        'credential',
        p_credential_id,
        jsonb_build_object('action' , 'rotate', 'credential_id', p_credential_id)
    );
END;
$$ LANGUAGE plpgsql;
""",
    "004_create_policy_rules": """
-- Migration 004: ACP policy rules
-- Defines access control and filtering policies

CREATE TABLE IF NOT EXISTS policy_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Rule definition
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- allow, deny, filter, rate_limit
    priority INTEGER DEFAULT 100,
    
    -- Matching conditions
    conditions JSONB NOT NULL, -- JSON logic for matching
    target_resources TEXT[], -- Resources this applies to
    target_actors TEXT[], -- Actors this applies to
    
    -- Action
    action JSONB NOT NULL, -- What to do when matched
    
    -- Temporal
    enabled BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    
    -- Metadata
    description TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ()
);

-- NOT NULL DEFAULT NOW Index for policy evaluation
CREATE INDEX IF NOT EXISTS idx_policy_rules_priority 
    ON policy_rules (priority DESC);

CREATE INDEX IF NOT EXISTS idx_policy_rules_type 
    ON policy_rules (rule_type);

CREATE INDEX IF NOT EXISTS idx_policy_rules_enabled 
    ON policy_rules (enabled);
""",
    "005_create_sessions": """
-- Migration 005: Secure session management
-- Tracks authenticated sessions with cryptographic verification

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    
    -- Session details
    user_id VARCHAR(255) NOT NULL,
    session_type VARCHAR(50) NOT NULL DEFAULT 'interactive',
    
    -- Cryptographic verification
    session_token_hash VARCHAR(64) NOT NULL,
    token_version INTEGER DEFAULT 1,
    
    -- Access scope
    scopes TEXT[] NOT NULL DEFAULT '{}',
    workspace_id VARCHAR(255),
    
    -- Security context
    ip_address INET,
    user_agent TEXT,
    mfa_verified BOOLEAN DEFAULT FALSE,
    
    -- Temporal
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    terminated_at TIMESTAMPTZ,
    termination_reason VARCHAR(100)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user 
    ON sessions (user_id, active);

CREATE INDEX IF NOT EXISTS idx_sessions_expires 
    ON sessions (expires_at) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash 
    ON sessions (session_token_hash);
""",
}


def get_migration(name: str) -> str:
    """Get a specific migration by name."""
    return MIGRATIONS.get(name, "")


def get_all_migrations() -> list:
    """Get all available migrations in order."""
    return [(name, sql) for name, sql in sorted(MIGRATIONS.items())]


def run_migration(db_conn, migration_name: str) -> bool:
    """
    Run a specific migration.

    Args:
        db_conn: Database connection
        migration_name: Name of migration to run

    Returns:
        True if successful, False otherwise
    """
    if migration_name not in MIGRATIONS:
        logger.error(f"Unknown migration: {migration_name}")
        return False

    sql = MIGRATIONS[migration_name]

    try:
        with db_conn.cursor() as cur:
            cur.execute(sql)
        db_conn.commit()
        logger.info(f"Migration {migration_name} completed successfully")
        return True
    except Exception as e:
        logger.error(f"Migration {migration_name} failed: {e}")
        db_conn.rollback()
        return False


def migrate_all(db_conn) -> bool:
    """
    Run all migrations in order.

    Args:
        db_conn: Database connection

    Returns:
        True if all successful, False otherwise
    """
    for name, sql in get_all_migrations():
        if not run_migration(db_conn, name):
            return False
    return True


__all__ = [
    "MIGRATIONS",
    "get_migration",
    "get_all_migrations",
    "run_migration",
    "migrate_all",
]
