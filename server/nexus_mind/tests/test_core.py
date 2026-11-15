"""
Test suite for Nexus Mind Core AI.
"""

import pytest
import torch
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nexus_mind.core.nade import NADEEngine
from nexus_mind.core.gie import GIEEngine
from nexus_mind.core.bne import BNEEngine
from nexus_mind.core.fusion import KimiDeltaAttention
from nexus_mind.cognitive.manager import CognitiveLoopManager


class TestNADE:
    """Tests for NADE Engine."""

    @pytest.fixture
    def nade(self):
        return NADEEngine(input_dim=64, hidden_dim=128, output_dim=64)

    def test_nade_forward_shape(self, nade):
        x = torch.randn(2, 10, 64)
        out = nade(x)

        assert "features" in out
        assert "anomaly_score" in out
        assert "is_anomaly" in out

        assert out["features"].shape == (2, 128)
        assert out["anomaly_score"].shape == (2, 1)

    def test_nade_adaptive_threshold(self, nade):
        x = torch.randn(1, 10, 64)

        # Normal context
        out1 = nade(x, context={"priming_factor": 1.0, "alert_level": 0.5})

        # High alert context
        out2 = nade(x, context={"priming_factor": 1.0, "alert_level": 0.9})

        # Quiet zone context
        out3 = nade(x, context={"priming_factor": 1.0, "alert_level": 0.1})

        assert out1["threshold"] != out2["threshold"]
        assert out1["threshold"] != out3["threshold"]

    def test_nade_priming(self, nade):
        # High-risk intent
        nade.update_priming(7)  # complain
        assert nade.priming_factor == 0.7

        # Normal intent
        nade.update_priming(1)  # purchase
        assert nade.priming_factor == 1.0


class TestGIE:
    """Tests for GIE Engine."""

    @pytest.fixture
    def gie(self):
        return GIEEngine(img_size=224, patch_size=16, embed_dim=256, depth=2)

    def test_gie_forward_shape(self, gie):
        x = torch.randn(2, 3, 224, 224)
        out = gie(x)

        assert "features" in out
        assert "property_logits" in out
        assert "ufz_logits" in out
        assert "objects_logits" in out

        assert out["features"].shape == (2, 256)
        assert out["property_logits"].shape == (2, 5)
        assert out["ufz_logits"].shape == (2, 10)
        assert out["objects_logits"].shape == (2, 20)

    def test_gie_with_attention(self, gie):
        x = torch.randn(2, 3, 224, 224)
        attention = torch.randn(2, 1)

        out = gie(x, attention_focus=attention)

        assert out["features"].shape == (2, 256)


class TestBNE:
    """Tests for BNE Engine."""

    @pytest.fixture
    def bne(self):
        return BNEEngine(input_dim=64, hidden_dim=256, num_intents=8)

    def test_bne_forward_shape(self, bne):
        x = torch.randn(2, 100, 64)
        out = bne(x)

        assert "features" in out
        assert "intent_logits" in out
        assert "sentiment" in out
        assert "action_logits" in out
        assert "engagement" in out

        assert out["features"].shape == (2, 256)
        assert out["intent_logits"].shape == (2, 8)
        assert out["sentiment"].shape == (2, 3)
        assert out["action_logits"].shape == (2, 4)
        assert out["engagement"].shape == (2, 1)

    def test_bne_intent_names(self, bne):
        assert bne.get_intent_name(0) == "search"
        assert bne.get_intent_name(7) == "complain"
        assert bne.get_intent_name(100) == "unknown"

    def test_bne_memory(self, bne):
        x = torch.randn(2, 100, 64)

        # First pass
        out1 = bne(x)
        memory1 = bne.get_memory()

        # Second pass
        out2 = bne(x)
        memory2 = bne.get_memory()

        # Memory should be updated
        assert memory2 is not None

        # Clear memory
        bne.clear_memory()
        assert bne.get_memory() is None


class TestFusion:
    """Tests for Kimi Delta Attention Fusion."""

    @pytest.fixture
    def fusion(self):
        return KimiDeltaAttention(dim_nade=128, dim_gie=256, dim_bne=256, fused_dim=512)

    def test_fusion_forward(self, fusion):
        nade_feat = torch.randn(2, 128)
        gie_feat = torch.randn(2, 256)
        bne_feat = torch.randn(2, 256)

        out = fusion(nade_feat, gie_feat, bne_feat)

        assert "fused" in out
        assert "confidence" in out

        assert out["fused"].shape == (2, 512)
        assert out["confidence"].shape == (2, 1)

    def test_fusion_single_sample(self, fusion):
        nade_feat = torch.randn(1, 128)
        gie_feat = torch.randn(1, 256)
        bne_feat = torch.randn(1, 256)

        out = fusion(nade_feat, gie_feat, bne_feat)

        assert out["fused"].shape == (1, 512)


class TestCognitiveManager:
    """Tests for Cognitive Loop Manager."""

    @pytest.fixture
    def manager(self):
        nade = NADEEngine()
        gie = GIEEngine()
        bne = BNEEngine()
        fusion = KimiDeltaAttention()

        return CognitiveLoopManager(nade, gie, bne, fusion)

    def test_manager_step(self, manager):
        sensor = torch.randn(4, 10, 64)

        result = manager.step(sensor)

        assert "fused" in result
        assert "confidence" in result
        assert "alert_level" in result
        assert "cognitive_state" in result

    def test_manager_full_pipeline(self, manager):
        sensor = torch.randn(4, 10, 64)
        geo = torch.randn(4, 3, 224, 224)
        behavior = torch.randn(4, 100, 64)

        result = manager.step(sensor, geo, behavior)

        assert result["fused"].shape == (4, 512)
        assert "gie_property" in result
        assert "bne_intent" in result

    def test_manager_reset(self, manager):
        sensor = torch.randn(4, 10, 64)
        manager.step(sensor)

        assert len(manager.history) > 0

        manager.reset()

        assert len(manager.history) == 0
        assert manager.alert_level == 0.0


class TestIntegration:
    """Integration tests."""

    def test_full_pipeline(self):
        """Test complete pipeline from inputs to fused output."""
        # Create engines
        nade = NADEEngine()
        gie = GIEEngine()
        bne = BNEEngine()
        fusion = KimiDeltaAttention()

        # Create manager
        manager = CognitiveLoopManager(nade, gie, bne, fusion)

        # Run inference
        sensor = torch.randn(2, 10, 64)
        geo = torch.randn(2, 3, 224, 224)
        behavior = torch.randn(2, 100, 64)

        result = manager.step(sensor, geo, behavior)

        # Verify outputs
        assert result["fused"].shape == (2, 512)
        assert (result["confidence"] >= 0).all() and (result["confidence"] <= 1).all()
        assert 0 <= result["alert_level"] <= 1

        # Check history
        history = manager.get_history(5)
        assert len(history) > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
