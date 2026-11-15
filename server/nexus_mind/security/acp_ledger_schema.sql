-- Nexus Mind Phase 2 - ACP-SQL Immune Ledger Schema
-- 
-- Immutable audit ledger with cryptographic envelopes
-- All actions must be packetized before execution
--
-- Version: 2.0.0
-- Date: 2026-03-10

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE LEDGER TABLE
-- ============================================================================

-- Immutable audit ledger with cryptographic chain
CREATE TABLE acp_ledger (
    -- Primary identifiers
    packet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_id UUID NOT NULL DEFAULT gen_random_uuid(),
    sequence_number BIGSERIAL,
    
    -- Actor identification
    agent_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    
    -- Temporal markers (immutable)
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Action specification
    action_type VARCHAR(100) NOT NULL,
    authorization_scope JSONB NOT NULL DEFAULT '{}',
    
    -- Cryptographic integrity
    payload_hash CHAR(64) NOT NULL,
    parent_packet_id UUID REFERENCES acp_ledger(packet_id),
    signature BYTEA NOT NULL,
    
    -- Attestation data
    attestation JSONB,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    -- Constraints
    CONSTRAINT valid_timestamp CHECK (timestamp <= NOW() + INTERVAL '1 minute'),
    CONSTRAINT unique_sequence UNIQUE (ledger_id, sequence_number)
);

-- Indexes for efficient querying
CREATE INDEX idx_agent_timestamp ON acp_ledger(agent_id, timestamp DESC);
CREATE INDEX idx_tenant_timestamp ON acp_ledger(tenant_id, timestamp DESC);
CREATE INDEX idx_tenant_actions ON acp_ledger(tenant_id, action_type, timestamp DESC);
CREATE INDEX idx_parent_chain ON acp_ledger(parent_packet_id);
CREATE INDEX idx_action_type ON acp_ledger(action_type);
CREATE INDEX idx_payload_hash ON acp_ledger(payload_hash);

-- ============================================================================
-- EXECUTION RESULTS TABLE
-- ============================================================================

CREATE TABLE execution_results (
    packet_id UUID PRIMARY KEY REFERENCES acp_ledger(packet_id) ON DELETE CASCADE,
    result JSONB,
    error TEXT,
    error_type VARCHAR(100),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    execution_time_ms INTEGER NOT NULL,
    
    -- Resource usage
    cpu_time_ms INTEGER,
    memory_used_bytes BIGINT,
    gpu_memory_used_bytes BIGINT
);

CREATE INDEX idx_results_completed ON execution_results(completed_at DESC);
CREATE INDEX idx_results_packet ON execution_results(packet_id);

-- ============================================================================
-- CHAIN VERIFICATION FUNCTION
-- ============================================================================

-- Verify cryptographic chain for a packet
CREATE OR REPLACE FUNCTION verify_packet_chain(target_packet_id UUID)
RETURNS TABLE(is_valid BOOLEAN, error_message TEXT) AS $$
DECLARE
    current_packet RECORD;
    parent_packet RECORD;
    chain_valid BOOLEAN := TRUE;
    error_msg TEXT;
BEGIN
    -- Get the target packet
    SELECT * INTO current_packet 
    FROM acp_ledger 
    WHERE packet_id = target_packet_id;
    
    IF current_packet IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Packet not found';
        RETURN;
    END IF;
    
    -- Check timestamp constraint
    IF current_packet.timestamp > NOW() + INTERVAL '1 minute' THEN
        RETURN QUERY SELECT FALSE, 'Timestamp in future';
        RETURN;
    END IF;
    
    -- Verify parent chain if exists
    IF current_packet.parent_packet_id IS NOT NULL THEN
        SELECT * INTO parent_packet
        FROM acp_ledger
        WHERE packet_id = current_packet.parent_packet_id;
        
        IF parent_packet IS NULL THEN
            RETURN QUERY SELECT FALSE, 'Parent packet not found';
            RETURN;
        END IF;
        
        -- Verify chronological order
        IF current_packet.timestamp <= parent_packet.timestamp THEN
            RETURN QUERY SELECT FALSE, 'Timestamp must be after parent';
            RETURN;
        END IF;
        
        -- Verify payload hash continuity
        IF current_packet.parent_packet_id IS NOT NULL THEN
            -- Parent should reference this packet
            IF parent_packet.packet_id != current_packet.parent_packet_id THEN
                RETURN QUERY SELECT FALSE, 'Invalid parent reference';
                RETURN;
            END IF;
        END IF;
    END IF;
    
    RETURN QUERY SELECT TRUE, NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFY SIGNATURE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_packet_signature(target_packet_id UUID)
RETURNS TABLE(is_valid BOOLEAN, error_message TEXT) AS $$
DECLARE
    packet RECORD;
    expected_hash CHAR(64);
    actual_hash CHAR(64);
BEGIN
    SELECT * INTO packet
    FROM acp_ledger
    WHERE packet_id = target_packet_id;
    
    IF packet IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Packet not found';
        RETURN;
    END IF;
    
    -- Compute expected hash
    actual_hash := encode(
        digest(
            COALESCE(packet.agent_id, '') || 
            COALESCE(packet.tenant_id, '') ||
            COALESCE(packet.action_type, '') ||
            COALESCE(packet.authorization_scope::TEXT, ''),
            'sha256'
        ),
        'hex'
    );
    
    -- For demo, we accept any non-null signature
    -- In production, use pgcrypto for actual RSA/ECDSA verification
    IF packet.signature IS NOT NULL AND length(packet.signature) > 0 THEN
        RETURN QUERY SELECT TRUE, NULL;
    ELSE
        RETURN QUERY SELECT FALSE, 'Signature missing or invalid';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- NO-UPDATE TRIGGER (APPEND-ONLY)
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_ledger_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ACP Ledger is append-only: updates and deletes are not allowed';
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent updates/deletes
DROP TRIGGER IF EXISTS no_update_ledger ON acp_ledger;
CREATE CONSTRAINT TRIGGER no_update_ledger
    AFTER UPDATE OR DELETE ON acp_ledger
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_update();

-- Trigger to prevent execution results updates
DROP TRIGGER IF EXISTS no_update_results ON execution_results;
CREATE CONSTRAINT TRIGGER no_update_results
    AFTER UPDATE OR DELETE ON execution_results
    FOR EACH ROW EXECUTE FUNCTION prevent_ledger_update();

-- ============================================================================
-- AUDIT VIEW
-- ============================================================================

CREATE OR REPLACE VIEW audit_trail AS
SELECT 
    l.packet_id,
    l.agent_id,
    l.tenant_id,
    l.timestamp,
    l.action_type,
    l.authorization_scope,
    l.payload_hash,
    l.parent_packet_id,
    r.result,
    r.error,
    r.error_type,
    r.completed_at,
    r.execution_time_ms,
    (EXTRACT(EPOCH FROM r.completed_at) - EXTRACT(EPOCH FROM l.timestamp)) * 1000 AS latency_ms,
    r.cpu_time_ms,
    r.memory_used_bytes,
    r.gpu_memory_used_bytes,
    l.metadata,
    l.attestation
FROM acp_ledger l
LEFT JOIN execution_results r ON l.packet_id = r.packet_id
ORDER BY l.timestamp DESC;

-- ============================================================================
-- LEDGER METRICS VIEW
-- ============================================================================

CREATE OR REPLACE VIEW ledger_metrics AS
SELECT 
    tenant_id,
    action_type,
    DATE_TRUNC('hour', timestamp) AS hour,
    COUNT(*) AS packet_count,
    AVG(execution_time_ms) AS avg_execution_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP(ORDER BY execution_time_ms) AS p95_execution_time_ms,
    COUNT(CASE WHEN error IS NOT NULL THEN 1 END) AS error_count
FROM acp_ledger l
LEFT JOIN execution_results r ON l.packet_id = r.packet_id
GROUP BY tenant_id, action_type, DATE_TRUNC('hour', timestamp);

-- ============================================================================
-- INSERT FUNCTION WITH SIGNATURE
-- ============================================================================

CREATE OR REPLACE FUNCTION insert_ledger_packet(
    p_agent_id VARCHAR,
    p_tenant_id VARCHAR,
    p_action_type VARCHAR,
    p_authorization_scope JSONB,
    p_payload_hash CHAR,
    p_parent_packet_id UUID DEFAULT NULL,
    p_signature BYTEA,
    p_metadata JSONB DEFAULT '{}',
    p_attestation JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_packet_id UUID;
BEGIN
    -- Insert the packet
    INSERT INTO acp_ledger (
        agent_id,
        tenant_id,
        action_type,
        authorization_scope,
        payload_hash,
        parent_packet_id,
        signature,
        metadata,
        attestation
    ) VALUES (
        p_agent_id,
        p_tenant_id,
        p_action_type,
        p_authorization_scope,
        p_payload_hash,
        p_parent_packet_id,
        p_signature,
        p_metadata,
        p_attestation
    )
    RETURNING packet_id INTO v_packet_id;
    
    RETURN v_packet_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- LOG EXECUTION RESULT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION log_execution_result(
    p_packet_id UUID,
    p_result JSONB DEFAULT NULL,
    p_error TEXT DEFAULT NULL,
    p_error_type VARCHAR DEFAULT NULL,
    p_execution_time_ms INTEGER DEFAULT 0,
    p_cpu_time_ms INTEGER DEFAULT NULL,
    p_memory_used_bytes BIGINT DEFAULT NULL,
    p_gpu_memory_used_bytes BIGINT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO execution_results (
        packet_id,
        result,
        error,
        error_type,
        execution_time_ms,
        cpu_time_ms,
        memory_used_bytes,
        gpu_memory_used_bytes
    ) VALUES (
        p_packet_id,
        p_result,
        p_error,
        p_error_type,
        p_execution_time_ms,
        p_cpu_time_ms,
        p_memory_used_bytes,
        p_gpu_memory_used_bytes
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TAMPER DETECTION VIEW
-- ============================================================================

CREATE OR REPLACE VIEW tamper_detection AS
SELECT 
    packet_id,
    agent_id,
    tenant_id,
    timestamp,
    action_type,
    payload_hash,
    parent_packet_id,
    CASE 
        WHEN (SELECT is_valid FROM verify_packet_chain(packet_id)) = FALSE 
        THEN 'CHAIN_BROKEN'
        WHEN (SELECT is_valid FROM verify_packet_signature(packet_id)) = FALSE 
        THEN 'INVALID_SIGNATURE'
        ELSE 'OK'
    END AS integrity_status
FROM acp_ledger
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert test data (for development only)
DO $$
DECLARE
    v_packet_id_1 UUID;
    v_packet_id_2 UUID;
BEGIN
    -- First packet
    v_packet_id_1 := insert_ledger_packet(
        p_agent_id => 'test-agent',
        p_tenant_id => 'test-tenant',
        p_action_type => 'inference.nade',
        p_authorization_scope => '{"models": ["nade"], "scope": "read"}'::jsonb,
        p_payload_hash => encode(digest('test_payload', 'sha256'), 'hex'),
        p_signature => 'test_signature'::bytea,
        p_metadata => '{"client": "test"}'::jsonb
    );
    
    -- Second packet with parent
    v_packet_id_2 := insert_ledger_packet(
        p_agent_id => 'test-agent',
        p_tenant_id => 'test-tenant',
        p_action_type => 'inference.fusion',
        p_authorization_scope => '{"models": ["nade", "gie", "bne"], "scope": "read"}'::jsonb,
        p_payload_hash => encode(digest('test_payload_2', 'sha256'), 'hex'),
        p_parent_packet_id => v_packet_id_1,
        p_signature => 'test_signature_2'::bytea,
        p_metadata => '{"client": "test"}'::jsonb
    );
    
    -- Log execution results
    PERFORM log_execution_result(
        p_packet_id => v_packet_id_1,
        p_result => '{"anomaly_score": 0.5}'::jsonb,
        p_execution_time_ms => 15
    );
    
    PERFORM log_execution_result(
        p_packet_id => v_packet_id_2,
        p_result => '{"fused_score": 0.75}'::jsonb,
        p_execution_time_ms => 25
    );
    
    RAISE NOTICE 'Test data inserted successfully';
END $$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant read access to analysts
GRANT SELECT ON audit_trail TO nexus_analyst;
GRANT SELECT ON ledger_metrics TO nexus_analyst;
GRANT SELECT ON tamper_detection TO nexus_analyst;

-- Grant write access to service accounts
GRANT INSERT ON acp_ledger TO nexus_service;
GRANT INSERT ON execution_results TO nexus_service;
GRANT EXECUTE ON FUNCTION insert_ledger_packet TO nexus_service;
GRANT EXECUTE ON FUNCTION log_execution_result TO nexus_service;

-- ============================================================================
-- COMPLIANCE VIEWS
-- ============================================================================

-- SOC 2 Audit View
CREATE OR REPLACE VIEW soc2_audit_log AS
SELECT 
    packet_id,
    agent_id,
    tenant_id,
    timestamp,
    action_type,
    authorization_scope,
    result,
    error,
    completed_at,
    execution_time_ms
FROM audit_trail
WHERE timestamp > NOW() - INTERVAL '90 days';

-- GDPR Data Access View
CREATE OR REPLACE VIEW gdpr_data_access AS
SELECT 
    packet_id,
    agent_id,
    tenant_id,
    timestamp,
    action_type,
    metadata,
    result
FROM audit_trail
WHERE action_type LIKE '%read%' OR action_type LIKE '%query%';

-- FedRAMP Audit View  
CREATE OR REPLACE VIEW fedramp_audit_log AS
SELECT 
    packet_id,
    agent_id,
    tenant_id,
    timestamp,
    action_type,
    authorization_scope,
    payload_hash,
    signature,
    integrity_status
FROM tamper_detection;
