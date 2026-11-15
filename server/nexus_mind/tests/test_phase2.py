"""
Nexus Mind Phase 2 - Tests

Tests for KrakenD gateway configuration and ACP-SQL Ledger client.
"""

import pytest
import json
import time
from unittest.mock import Mock, patch, MagicMock

from nexus_mind.security.krakend_config import (
    KrakenDConfig,
    create_nexus_gateway_config,
)
from nexus_mind.security.acp_client import ACPLedgerClient, ACPPacket, ACPActionType


class TestKrakenDConfig:
    """Tests for KrakenD configuration builder."""

    def test_config_initialization(self):
        """Test basic configuration initialization."""
        config = KrakenDConfig("Test-Gateway")
        assert config.config["name"] == "Test-Gateway"
        assert config.config["port"] == 8443

    def test_add_endpoint(self):
        """Test adding an endpoint."""
        config = KrakenDConfig()

        config.add_endpoint(
            endpoint="/v1/test",
            method="POST",
            backend_host="http://localhost:8080",
            backend_path="/test",
            jwks_url="https://auth.example.com/.well-known/jwks.json",
            issuer="https://auth.example.com",
            audience="test-audience",
        )

        assert len(config.config["endpoints"]) == 1
        endpoint = config.config["endpoints"][0]
        assert endpoint["endpoint"] == "/v1/test"
        assert endpoint["method"] == "POST"

    def test_add_endpoint_without_auth(self):
        """Test adding an endpoint without JWT auth."""
        config = KrakenDConfig()

        config.add_endpoint(
            endpoint="/health",
            method="GET",
            backend_host="http://localhost:8080",
            backend_path="/health",
            require_auth=False,
        )

        endpoint = config.config["endpoints"][0]
        assert "validation/jwt" not in endpoint.get("extra_config", {})

    def test_tls_config(self):
        """Test TLS configuration."""
        config = KrakenDConfig()
        config.set_tls(min_version="1.3")

        assert "tls" in config.config
        assert config.config["tls"]["min_version"] == "1.3"

    def test_security_middleware(self):
        """Test security middleware configuration."""
        config = KrakenDConfig()

        config.add_endpoint(
            endpoint="/v1/test",
            method="POST",
            backend_host="http://localhost:8080",
            backend_path="/test",
            require_auth=False,
        )

        config.add_security_middleware(
            bot_detection=True, cors_origins=["https://example.com"]
        )

        endpoint = config.config["endpoints"][0]
        assert "security/bot-detector" in endpoint["extra_config"]
        assert "security/cors" in endpoint["extra_config"]

    def test_rate_limiting(self):
        """Test rate limiting configuration."""
        config = KrakenDConfig()

        config.add_endpoint(
            endpoint="/v1/test",
            method="POST",
            backend_host="http://localhost:8080",
            backend_path="/test",
            require_auth=False,
        )

        config.add_rate_limiting(
            strategy="ip",
            max_rate=100,
            capacity=10,
        )

        endpoint = config.config["endpoints"][0]
        assert "qos/ratelimit" in endpoint["extra_config"]
        assert endpoint["extra_config"]["qos/ratelimit"]["max_rate"] == 100

    def test_circuit_breaker(self):
        """Test circuit breaker configuration."""
        config = KrakenDConfig()

        config.add_endpoint(
            endpoint="/v1/test",
            method="POST",
            backend_host="http://localhost:8080",
            backend_path="/test",
            require_auth=False,
        )

        config.add_circuit_breaker(
            enabled=True,
            max_errors=10,
        )

        endpoint = config.config["endpoints"][0]
        backend = endpoint["backend"][0]
        assert "qos/circuit-breaker" in backend.get("extra_config", {})

    def test_create_nexus_gateway_config(self):
        """Test creating the full Nexus gateway config."""
        config = create_nexus_gateway_config()

        assert len(config.config["endpoints"]) > 0
        assert config.config["name"] == "Nexus-Sovereign-Gateway"

    def test_config_to_json(self):
        """Test JSON serialization."""
        config = KrakenDConfig()
        config.add_endpoint(
            endpoint="/test",
            method="GET",
            backend_host="http://localhost",
            backend_path="/test",
            require_auth=False,
        )

        json_str = config.to_json()
        parsed = json.loads(json_str)

        assert "version" in parsed
        assert parsed["version"] == 3


class TestACPLedgerClient:
    """Tests for ACP Ledger client."""

    def test_client_initialization(self):
        """Test client initialization."""
        client = ACPLedgerClient()

        assert client._test_mode is True
        assert client.ledger_id == "default"

    def test_create_packet(self):
        """Test packet creation."""
        client = ACPLedgerClient()

        packet = client.create_packet(
            agent_id="test-agent",
            tenant_id="test-tenant",
            action_type="test.action",
            scope={"scope": "test"},
            payload={"data": "test"},
        )

        assert packet.agent_id == "test-agent"
        assert packet.tenant_id == "test-tenant"
        assert packet.action_type == "test.action"
        assert packet.payload_hash is not None
        assert packet.signature is not None

    def test_packet_chain(self):
        """Test packet chaining."""
        client = ACPLedgerClient()

        # Create first packet
        packet1 = client.create_packet(
            agent_id="test-agent",
            tenant_id="test-tenant",
            action_type="action1",
            scope={},
            payload={"step": 1},
        )

        # Create second packet with parent
        packet2 = client.create_packet(
            agent_id="test-agent",
            tenant_id="test-tenant",
            action_type="action2",
            scope={},
            payload={"step": 2},
            parent_id=packet1.packet_id,
        )

        assert packet2.parent_packet_id == packet1.packet_id

    def test_log_packet(self):
        """Test packet logging."""
        client = ACPLedgerClient()

        packet = client.create_packet(
            agent_id="test-agent",
            tenant_id="test-tenant",
            action_type="test.action",
            scope={},
            payload={"data": "test"},
        )

        result = client.log_packet(packet)

        assert result == packet.packet_id

    def test_log_execution_result(self):
        """Test execution result logging."""
        client = ACPLedgerClient()

        client.log_execution_result(
            packet_id="test-packet-id",
            result={"status": "success"},
            execution_time_ms=100,
        )

        # Should not raise

    def test_verify_chain(self):
        """Test chain verification."""
        client = ACPLedgerClient()

        result = client.verify_chain("test-packet-id")

        assert result["is_valid"] is True

    def test_log_and_execute(self):
        """Test log and execute workflow."""
        client = ACPLedgerClient()

        packet = client.create_packet(
            agent_id="test-agent",
            tenant_id="test-tenant",
            action_type="test.action",
            scope={},
            payload={"data": "test"},
        )

        def execute_fn(payload):
            return {"result": "success", "data": payload.get("data")}

        result = client.log_and_execute(packet, execute_fn)

        assert result.success is True
        assert result.result["result"] == "success"
        assert result.execution_time_ms >= 0

    def test_log_and_execute_with_error(self):
        """Test log and execute with error."""
        client = ACPLedgerClient()

        packet = client.create_packet(
            agent_id="test-agent",
            tenant_id="test-tenant",
            action_type="test.action",
            scope={},
            payload={"data": "test"},
        )

        def execute_fn(payload):
            raise ValueError("Test error")

        result = client.log_and_execute(packet, execute_fn)

        assert result.success is False
        assert result.error == "Test error"
        assert result.error_type == "ValueError"

    def test_get_audit_trail(self):
        """Test getting audit trail."""
        client = ACPLedgerClient()

        trail = client.get_audit_trail(limit=10)

        assert isinstance(trail, list)

    def test_get_metrics(self):
        """Test getting metrics."""
        client = ACPLedgerClient()

        metrics = client.get_metrics(hours=24)

        assert isinstance(metrics, list)

    def test_check_tamper(self):
        """Test tamper detection."""
        client = ACPLedgerClient()

        tamper = client.check_tamper(hours=24)

        assert isinstance(tamper, list)


class TestLedgerIntegration:
    """Integration tests for ledger with engines."""

    def test_ledger_enabled_engine(self):
        """Test ledger-enabled engine wrapper."""
        from nexus_mind.security.ledger_engines import LedgerEnabledNADE

        # Create mock engine
        mock_engine = Mock()
        mock_engine.return_value = {"features": "test", "anomaly_score": 0.5}

        # Create ledger-enabled wrapper
        client = ACPLedgerClient()
        wrapper = LedgerEnabledNADE(
            input_dim=64,
            hidden_dim=128,
            ledger_client=client,
        )

        # Forward pass should work
        result = wrapper.forward(
            agent_id="test-agent",
            tenant_id="test-tenant",
        )

        assert result is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
