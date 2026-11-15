"""
Cognitive Loop Manager

Implements the three feedback loops:
- Alert Loop: NADE -> GIE
- Context Loop: GIE -> BNE
- Priming Loop: BNE -> NADE
"""

import torch
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class CognitiveLoopManager:
    """
    Manages cognitive feedback loops between engines.

    Implements:
    - Alert Loop: NADE anomalies focus GIE attention
    - Context Loop: GIE scene context informs BNE predictions
    - Priming Loop: BNE intent modulates NADE threshold
    """

    def __init__(self, nade, gie, bne, fusion, device: str = "cpu"):
        """
        Initialize Cognitive Loop Manager.

        Args:
            nade: NADE Engine instance
            gie: GIE Engine instance
            bne: BNE Engine instance
            fusion: KimiDeltaAttention instance
            device: Device to run on
        """
        self.nade = nade
        self.gie = gie
        self.bne = bne
        self.fusion = fusion
        self.device = device

        # Cognitive state
        self.alert_level = 0.0
        self.context = {
            "scene": None,
            "intent": None,
            "priming_factor": 1.0,
            "attention_focus": None,
        }

        # History
        self.history = []
        self.max_history = 100

        logger.info("Cognitive Loop Manager initialized")

    def step(
        self,
        sensor_data: torch.Tensor,
        geo_data: Optional[torch.Tensor] = None,
        behavior_data: Optional[torch.Tensor] = None,
    ) -> Dict[str, Any]:
        """
        Execute one step of the cognitive pipeline.

        Args:
            sensor_data: Sensor data for NADE
            geo_data: Geospatial data for GIE
            behavior_data: Behavioral data for BNE

        Returns:
            Dictionary containing all outputs and cognitive state
        """
        # Move data to device
        sensor_data = sensor_data.to(self.device)
        if geo_data is not None:
            geo_data = geo_data.to(self.device)
        if behavior_data is not None:
            behavior_data = behavior_data.to(self.device)

        # === ALERT LOOP: NADE -> GIE ===
        nade_out = self.nade(sensor_data, context=self.context)

        # Get batch size from NADE output
        batch_size = nade_out["features"].shape[0]

        # Compute alert level
        self.alert_level = nade_out["anomaly_score"].mean().item()

        # Determine attention focus from anomaly
        gie_attention = nade_out["is_anomaly"].float()
        self.context["attention_focus"] = gie_attention

        # === CONTEXT LOOP: GIE (with attention from NADE) ===
        if geo_data is not None:
            gie_out = self.gie(geo_data, attention_focus=gie_attention)
            # Store scene context
            self.context["scene"] = gie_out["features"].detach()
        else:
            gie_out = {"features": torch.zeros(batch_size, 256).to(self.device)}

        # === CONTEXT LOOP: GIE -> BNE ===
        if behavior_data is not None:
            bne_context = {"scene": self.context.get("scene")}
            bne_out = self.bne(behavior_data, context=bne_context)

            # Extract intent (use first sample)
            intent = bne_out["intent_class"][0].item()
            self.context["intent"] = intent
        else:
            bne_out = {"features": torch.zeros(batch_size, 256).to(self.device)}

        # === PRIMING LOOP: BNE -> NADE ===
        # If high-risk intent (complain = 7), lower NADE threshold
        if self.context.get("intent") == 7:
            self.context["priming_factor"] = 0.7
        else:
            self.context["priming_factor"] = 1.0

        # Update NADE priming
        self.nade.update_priming(self.context.get("intent"))

        # === FUSION ===
        fusion_out = self.fusion(
            nade_out["features"], gie_out["features"], bne_out["features"]
        )

        # === COMPILE RESULTS ===
        result = {
            "fused": fusion_out["fused"],
            "confidence": fusion_out["confidence"],
            "nade_anomaly": nade_out["anomaly_score"],
            "nade_is_anomaly": nade_out["is_anomaly"],
            "gie_features": gie_out.get("features"),
            "gie_property": gie_out.get("property_class"),
            "gie_ufz": gie_out.get("ufz_class"),
            "bne_intent": bne_out.get("intent_class"),
            "bne_sentiment": bne_out.get("sentiment_class"),
            "bne_action": bne_out.get("action_class"),
            "bne_engagement": bne_out.get("engagement"),
            "cognitive_state": self.context.copy(),
            "alert_level": self.alert_level,
        }

        # Store in history
        self._add_to_history(result)

        return result

    def _add_to_history(self, result: Dict[str, Any]):
        """Add result to history."""
        # Simplify for storage (detach tensors)
        # Take mean for batch > 1
        confidence_val = (
            result["confidence"].mean().item()
            if result["confidence"].numel() > 1
            else result["confidence"].item()
        )
        anomaly_val = (
            result["nade_is_anomaly"].float().mean().item()
            if result.get("nade_is_anomaly") is not None
            and result["nade_is_anomaly"].numel() > 1
            else (
                result["nade_is_anomaly"].item()
                if result.get("nade_is_anomaly") is not None
                else None
            )
        )

        history_item = {
            "alert_level": result["alert_level"],
            "confidence": confidence_val,
            "intent": result.get("bne_intent", None),
            "is_anomaly": anomaly_val,
        }

        self.history.append(history_item)
        if len(self.history) > self.max_history:
            self.history.pop(0)

    def get_history(self, n: int = 10) -> list:
        """Get last n history items."""
        return self.history[-n:]

    def reset(self):
        """Reset cognitive state."""
        self.alert_level = 0.0
        self.context = {
            "scene": None,
            "intent": None,
            "priming_factor": 1.0,
            "attention_focus": None,
        }
        self.history = []
        logger.info("Cognitive state reset")

    def get_state(self) -> Dict[str, Any]:
        """Get current cognitive state."""
        return {
            "alert_level": self.alert_level,
            "context": self.context,
            "history_length": len(self.history),
        }


class AlertLoop:
    """Alert Loop: NADE -> GIE attention modulation."""

    def __init__(self, threshold: float = 0.5):
        self.threshold = threshold

    def compute_attention(self, anomaly_scores: torch.Tensor) -> torch.Tensor:
        """Compute attention weights from anomaly scores."""
        # Convert anomaly scores to attention weights
        attention = (anomaly_scores > self.threshold).float()
        return attention


class ContextLoop:
    """Context Loop: GIE scene -> BNE context."""

    def __init__(self):
        pass

    def encode_context(
        self,
        scene_features: torch.Tensor,
        property_class: Optional[int] = None,
        ufz_class: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Encode scene context for BNE."""
        return {
            "scene": scene_features,
            "property_class": property_class,
            "ufz_class": ufz_class,
        }


class PrimingLoop:
    """Priming Loop: BNE intent -> NADE threshold modulation."""

    HIGH_RISK_INTENTS = [7]  # complain

    def __init__(self):
        pass

    def compute_priming_factor(self, intent: Optional[int]) -> float:
        """Compute priming factor based on intent."""
        if intent in self.HIGH_RISK_INTENTS:
            return 0.7  # Increase sensitivity
        return 1.0  # Normal threshold
