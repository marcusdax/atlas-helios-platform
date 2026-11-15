"""
Tests for Nexus Mind Security - Engine Wrapper

Tests the integration of IronClaw sandbox with core engines.
"""

import pytest
import torch
from unittest.mock import Mock, patch

from nexus_mind.security.engine_wrapper import (
    SecureEngineWrapper,
    SecureEngineRegistry,
    SecureEngineWrapper,
)


class TestSecureEngineWrapper:
    """Test cases for SecureEngineWrapper."""

    @pytest.fixture
    def mock_nade_engine(self):
        """Create a mock NADE engine."""
        engine = Mock()
        engine.input_dim = 64
        engine.hidden_dim = 128
        engine.output_dim = 64
        engine.threshold = 0.5

        def mock_forward(x, context=None):
            return {
                "features": torch.randn(x.size(0), 128),
                "anomaly_score": torch.rand(x.size(0), 1),
                "is_anomaly": torch.rand(x.size(0), 1) > 0.5,
                "threshold": 0.5,
            }

        engine.forward = Mock(side_effect=mock_forward)
        engine.side_effect = mock_forward
        engine.return_value = {
            "features": torch.randn(2, 128),
            "anomaly_score": torch.rand(2, 1),
            "is_anomaly": torch.rand(2, 1) > 0.5,
            "threshold": 0.5,
        }
        engine.set_threshold = Mock()
        return engine

    @pytest.fixture
    def mock_bne_engine(self):
        """Create a mock BNE engine."""
        engine = Mock()
        engine.input_dim = 64
        engine.hidden_dim = 256
        engine.num_intents = 8

        def mock_forward(x, mask=None, context=None):
            batch_size = x.size(0)
            return {
                "features": torch.randn(batch_size, 256),
                "intent_logits": torch.randn(batch_size, 8),
                "sentiment": torch.randn(batch_size, 3),
                "action_logits": torch.randn(batch_size, 4),
                "engagement": torch.rand(batch_size, 1),
                "intent_class": torch.randint(0, 8, (batch_size,)),
                "sentiment_class": torch.randint(0, 3, (batch_size,)),
                "action_class": torch.randint(0, 4, (batch_size,)),
            }

        engine.forward = Mock(side_effect=mock_forward)
        engine.side_effect = mock_forward
        engine.get_intent_name = Mock(
            side_effect=lambda x: [
                "search",
                "purchase",
                "browse",
                "inquire",
                "compare",
                "review",
                "share",
                "complain",
            ][x]
        )
        return engine

    def test_nade_wrapper_initialization(self, mock_nade_engine):
        """Test NADE wrapper initialization."""
        wrapper = SecureEngineWrapper(
            engine_name="nade",
            engine=mock_nade_engine,
            enable_audit=False,
        )

        assert wrapper.engine_name == "nade"
        assert wrapper.engine == mock_nade_engine
        assert "detect_anomaly" in wrapper._tool_registry

    def test_bne_wrapper_initialization(self, mock_bne_engine):
        """Test BNE wrapper initialization."""
        wrapper = SecureEngineWrapper(
            engine_name="bne",
            engine=mock_bne_engine,
            enable_audit=False,
        )

        assert wrapper.engine_name == "bne"
        assert wrapper.engine == mock_bne_engine
        assert "predict_intent" in wrapper._tool_registry

    def test_forward_pass(self, mock_nade_engine):
        """Test forward pass through wrapper."""
        wrapper = SecureEngineWrapper(
            engine_name="nade",
            engine=mock_nade_engine,
            enable_audit=False,
        )

        x = torch.randn(2, 10, 64)
        result = wrapper.forward(x)

        assert "features" in result
        assert "anomaly_score" in result
        assert result["features"].shape == (2, 128)

    def test_tool_execution(self, mock_nade_engine):
        """Test tool execution in sandbox."""
        wrapper = SecureEngineWrapper(
            engine_name="nade",
            engine=mock_nade_engine,
            enable_audit=False,
        )

        input_data = {
            "features": torch.randn(2, 10, 64),
        }

        result = wrapper.execute_tool("detect_anomaly", input_data)

        assert result.success is True
        assert result.output is not None
        assert "anomaly_score" in result.output

    def test_unknown_tool(self, mock_nade_engine):
        """Test execution of unknown tool."""
        wrapper = SecureEngineWrapper(
            engine_name="nade",
            engine=mock_nade_engine,
            enable_audit=False,
        )

        result = wrapper.execute_tool("nonexistent_tool", {})

        assert result.success is False
        assert "Unknown tool" in result.error

    def test_security_status(self, mock_nade_engine):
        """Test security status retrieval."""
        wrapper = SecureEngineWrapper(
            engine_name="nade",
            engine=mock_nade_engine,
            enable_audit=False,
        )

        status = wrapper.get_security_status()

        assert status["engine"] == "nade"
        assert "sandbox_available" in status
        assert "gpu_status" in status
        assert status["audit_enabled"] is False


class TestSecureEngineRegistry:
    """Test cases for SecureEngineRegistry."""

    @pytest.fixture
    def mock_engines(self):
        """Create mock engines."""
        nade = Mock()
        bne = Mock()

        nade.forward = lambda x: {
            "features": torch.randn(x.size(0), 128),
            "anomaly_score": torch.rand(x.size(0), 1),
        }

        bne.forward = lambda x: {
            "features": torch.randn(x.size(0), 256),
            "intent_logits": torch.randn(x.size(0), 8),
        }

        return {"nade": nade, "bne": bne}

    def test_registry_initialization(self, mock_engines):
        """Test registry initialization."""
        registry = SecureEngineRegistry()

        assert len(registry.engines) == 0

    def test_register_engine(self, mock_engines):
        """Test engine registration."""
        registry = SecureEngineRegistry()

        wrapper = registry.register("nade", mock_engines["nade"])

        assert "nade" in registry.engines
        assert wrapper.engine_name == "nade"

    def test_get_engine(self, mock_engines):
        """Test getting an engine from registry."""
        registry = SecureEngineRegistry()
        registry.register("nade", mock_engines["nade"])

        wrapper = registry.get("nade")

        assert wrapper is not None
        assert wrapper.engine_name == "nade"

    def test_get_nonexistent_engine(self, mock_engines):
        """Test getting a non-existent engine."""
        registry = SecureEngineRegistry()

        wrapper = registry.get("nonexistent")

        assert wrapper is None

    def test_get_all_status(self, mock_engines):
        """Test getting status for all engines."""
        registry = SecureEngineRegistry()
        registry.register("nade", mock_engines["nade"])
        registry.register("bne", mock_engines["bne"])

        status = registry.get_all_status()

        assert "nade" in status
        assert "bne" in status

    def test_close_all(self, mock_engines):
        """Test closing all engines."""
        registry = SecureEngineRegistry()
        registry.register("nade", mock_engines["nade"])
        registry.register("bne", mock_engines["bne"])

        registry.close_all()

        assert len(registry.engines) == 0


class TestMigrations:
    """Test cases for database migrations."""

    def test_migrations_available(self):
        """Test that migrations are available."""
        from nexus_mind.security.migrations import MIGRATIONS, get_all_migrations

        assert len(MIGRATIONS) >= 5
        assert "001_create_audit_ledger" in MIGRATIONS
        assert "002_create_tool_executions" in MIGRATIONS

    def test_get_migration(self):
        """Test getting a specific migration."""
        from nexus_mind.security.migrations import get_migration

        migration = get_migration("001_create_audit_ledger")

        assert migration is not None
        assert "CREATE TABLE" in migration
        assert "acp_ledger" in migration

    def test_get_all_migrations_ordered(self):
        """Test migrations are in order."""
        from nexus_mind.security.migrations import get_all_migrations

        migrations = get_all_migrations()

        names = [name for name, _ in migrations]
        assert names == sorted(names)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
