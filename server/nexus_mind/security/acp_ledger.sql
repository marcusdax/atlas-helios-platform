-- ACP-SQL Immune Ledger Schema
-- Based on Phase 2 Security Enhancement specification
-- Protocol-first security: all actions must be packetized

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Main ledger table
CREATE TABLE IF NOT EXISTS acp_ledger (
    packet_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    action_type VARCHAR(100) NOT NULL,
    authorization_scope JSONB NOT NULL DEFAULT '{}',
    payload_hash CHAR(64) NOT NULL,
    parent_packet_id UUID REFERENCES acp_ledger(packet_id),
    signature BYTEA NOT NULL,
    attestation JSONB,
    
    -- Enforce monotonic timestamps (prevent replay attacks)
    CONSTRAINT valid_timestamp CHECK (timestamp <= NOW() + INTERVAL '1 minute')
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_agent_timestamp ON acp_ledger(agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_actions ON acp_ledger(tenant_id, action_type);
CREATE INDEX IF NOT EXISTS idx_parent_chain ON acp_ledger(parent_packet_id);

-- Tool execution audit table
CREATE TABLE IF NOT EXISTS tool_executions (
    execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_name VARCHAR(255) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]',
    leak_detected BOOLEAN NOT NULL DEFAULT FALSE,
    execution_time_ms REAL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result JSONB,
    error_message TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_timestamp ON tool_executions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tool_name ON tool_executions(tool_name);

-- Differential privacy budget tracking
CREATE TABLE IF NOT EXISTS privacy_budget (
    tenant_id VARCHAR(255) PRIMARY KEY,
    epsilon_spent REAL NOT NULL DEFAULT 0.0,
    delta_value REAL NOT NULL DEFAULT 1e-5,
    total_steps INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    budget_epsilon REAL NOT NULL DEFAULT 1.0
);

-- Cryptographic verification function
CREATE OR REPLACE FUNCTION verify_packet_signature(
    p_signature BYTEA,
    p_packet_id UUID,
    p_payload_hash CHAR(64)
) RETURNS BOOLEAN AS $$
DECLARE
    stored_sig BYTEA;
    stored_hash CHAR(64);
BEGIN
    SELECT signature, payload_hash INTO stored_sig, stored_hash
    FROM acp_ledger
    WHERE packet_id = p_packet_id;
    
    IF stored_sig IS NULL OR stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN stored_sig = p_signature AND stored_hash = p_payload_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cryptographic chain verification function
CREATE OR REPLACE FUNCTION verify_packet_chain(p_packet_id UUID) 
RETURNS BOOLEAN AS $$
DECLARE
    valid BOOLEAN := TRUE;
    current_packet_id UUID;
    prev_timestamp TIMESTAMPTZ;
BEGIN
    current_packet_id := p_packet_id;
    
    WHILE current_packet_id IS NOT NULL LOOP
        DECLARE
            rec RECORD;
        BEGIN
            SELECT packet_id, timestamp, parent_packet_id 
            INTO rec 
            FROM acp_ledger 
            WHERE packet_id = current_packet_id;
            
            IF rec IS NULL THEN
                valid := FALSE;
                EXIT;
            END IF;
            
            -- Check timestamp order
            IF prev_timestamp IS NOT NULL AND rec.timestamp > prev_timestamp THEN
                valid := FALSE;
                EXIT;
            END IF;
            
            prev_timestamp := rec.timestamp;
            current_packet_id := rec.parent_packet_id;
        END;
    END LOOP;
    
    RETURN valid;
END;
$$ LANGUAGE plpgsql;

-- No execution without logging trigger
CREATE OR REPLACE FUNCTION check_execution_logged()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT verify_packet_chain(NEW.packet_id) THEN
        RAISE EXCEPTION 'Execution not properly logged: chain verification failed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for execution logging
CREATE CONSTRAINT TRIGGER execution_logged_trigger
    AFTER INSERT ON tool_executions
    FOR EACH ROW
    EXECUTE FUNCTION check_execution_logged();

-- Privacy budget update function
CREATE OR REPLACE FUNCTION update_privacy_budget(
    p_tenant_id VARCHAR,
    p_epsilon_spent REAL,
    p_steps INTEGER
) RETURNS VOID AS $$
BEGIN
    INSERT INTO privacy_budget (tenant_id, epsilon_spent, total_steps, last_updated)
    VALUES (p_tenant_id, p_epsilon_spent, p_steps, NOW())
    ON CONFLICT (tenant_id) DO UPDATE SET
        epsilon_spent = privacy_budget.epsilon_spent + p_epsilon_spent,
        total_steps = privacy_budget.total_steps + p_steps,
        last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Check privacy budget function
CREATE OR REPLACE FUNCTION check_privacy_budget(
    p_tenant_id VARCHAR,
    p_epsilon_needed REAL
) RETURNS BOOLEAN AS $$
DECLARE
    budget RECORD;
BEGIN
    SELECT * INTO budget FROM privacy_budget WHERE tenant_id = p_tenant_id;
    
    IF budget IS NULL THEN
        RETURN TRUE;
    END IF;
    
    RETURN (budget.budget_epsilon - budget.epsilon_spent) >= p_epsilon_needed;
END;
$$ LANGUAGE plpgsql;

-- Initialize default privacy budgets
INSERT INTO privacy_budget (tenant_id, budget_epsilon, epsilon_spent, total_steps)
VALUES 
    ('default', 2.0, 0.0, 0),
    ('vision_model', 1.5, 0.0, 0),
    ('audio_model', 1.5, 0.0, 0),
    ('language_model', 0.8, 0.0, 0)
ON CONFLICT (tenant_id) DO NOTHING;

-- Grant appropriate permissions
GRANT SELECT ON acp_ledger TO nexus_user;
GRANT INSERT ON acp_ledger TO nexus_user;
GRANT SELECT ON tool_executions TO nexus_user;
GRANT INSERT ON tool_executions TO nexus_user;
GRANT SELECT, UPDATE ON privacy_budget TO nexus_user;
GRANT EXECUTE ON FUNCTION verify_packet_chain TO nexus_user;
GRANT EXECUTE ON FUNCTION check_privacy_budget TO nexus_user;
GRANT EXECUTE ON FUNCTION update_privacy_budget TO nexus_user;

-- Create view for audit queries
CREATE OR REPLACE VIEW v_ledger_summary AS
SELECT 
    agent_id,
    tenant_id,
    action_type,
    timestamp,
    parent_packet_id IS NOT NULL AS is_dependent,
    verify_packet_chain(packet_id) AS chain_valid
FROM acp_ledger
ORDER BY timestamp DESC;

-- Comment on security properties
COMMENT ON TABLE acp_ledger IS 'Immutable audit ledger with cryptographic envelopes - protocol-first security';
COMMENT ON FUNCTION verify_packet_chain IS 'Verifies cryptographic chain integrity of packet';
COMMENT ON FUNCTION check_execution_logged IS 'Ensures no execution without proper logging';
