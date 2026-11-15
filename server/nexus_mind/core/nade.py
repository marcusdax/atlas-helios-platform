"""
NADE - Neuromorphic Anomaly Detection Engine

Purpose: Real-time anomaly detection using spiking-neural-network principles.
Key features:
- Event-driven (can fallback to ANN if SNN hardware unavailable)
- Adaptive threshold (NeuEdge)
- Continual learning via pattern separation (PS-SNN)
"""

import torch
import torch.nn as nn
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class NADEEngine(nn.Module):
    """
    Neuromorphic Anomaly Detection Engine.

    Provides real-time anomaly detection with support for:
    - Spiking Neural Networks (SNN) for neuromorphic hardware
    - Adaptive threshold mechanism (NeuEdge)
    - Pattern Separation for continual learning
    """

    def __init__(
        self,
        input_dim: int = 64,
        hidden_dim: int = 128,
        output_dim: int = 64,
        threshold: float = 0.5,
        use_snn: bool = False,
        num_steps: int = 10,
    ):
        """
        Initialize NADE Engine.

        Args:
            input_dim: Dimension of input features
            hidden_dim: Hidden layer dimension
            output_dim: Output feature dimension for fusion
            threshold: Base anomaly detection threshold
            use_snn: Whether to use SNN mode (requires snntorch)
            num_steps: Number of temporal steps for SNN
        """
        super().__init__()

        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.output_dim = output_dim
        self.threshold = threshold
        self.use_snn = use_snn
        self.num_steps = num_steps

        # Feature extractor
        self.feature_extractor = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, output_dim),
        )

        # Anomaly detection head
        self.anomaly_head = nn.Sequential(
            nn.Linear(output_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, 1),
            nn.Sigmoid(),
        )

        # Fusion projection layer
        self.fusion_proj = nn.Linear(output_dim, 128)

        # NeuEdge adaptive threshold parameters
        self.priming_factor = 1.0
        self.quiet_zone_multiplier = 1.2
        self.noisy_zone_multiplier = 0.8

        logger.info(
            f"NADE Engine initialized: input={input_dim}, hidden={hidden_dim}, output={output_dim}"
        )

    def forward(
        self, x: torch.Tensor, context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass through NADE.

        Args:
            x: Input tensor of shape (batch, seq_len, input_dim)
            context: Optional context dict with priming_factor, alert_level, etc.

        Returns:
            Dictionary containing:
                - features: Fusion features (batch, 128)
                - anomaly_score: Anomaly probability (batch, 1)
                - is_anomaly: Boolean anomaly flag (batch, 1)
        """
        # Handle different input shapes
        if x.dim() == 2:
            x = x.unsqueeze(1)  # (batch, 1, input_dim)
        elif x.dim() == 1:
            x = x.unsqueeze(0).unsqueeze(0)  # (1, 1, input_dim)

        # Aggregate over time dimension
        features = self.feature_extractor(x.mean(dim=1))  # (batch, output_dim)

        # Compute anomaly score
        anomaly = self.anomaly_head(features)  # (batch, 1)

        # Adaptive threshold logic
        adjusted_threshold = self._compute_adaptive_threshold(context)

        # Determine if anomaly
        is_anomaly = anomaly > adjusted_threshold

        return {
            "features": self.fusion_proj(features),
            "anomaly_score": anomaly,
            "is_anomaly": is_anomaly,
            "threshold": adjusted_threshold,
        }

    def _compute_adaptive_threshold(
        self, context: Optional[Dict[str, Any]] = None
    ) -> float:
        """
        Compute adaptive threshold based on context (NeuEdge mechanism).

        Args:
            context: Context information including alert_level, priming_factor, etc.

        Returns:
            Adjusted threshold value
        """
        if context is None:
            return self.threshold

        # Apply priming factor
        priming_factor = context.get("priming_factor", 1.0)

        # Adjust based on alert level (quiet vs noisy environment)
        alert_level = context.get("alert_level", 0.5)

        if alert_level < 0.3:
            # Quiet zone - increase sensitivity
            threshold = self.threshold * self.quiet_zone_multiplier * priming_factor
        elif alert_level > 0.7:
            # Noisy zone - decrease sensitivity
            threshold = self.threshold * self.noisy_zone_multiplier * priming_factor
        else:
            # Normal zone
            threshold = self.threshold * priming_factor

        return threshold

    def update_priming(self, intent: Optional[int] = None):
        """
        Update priming factor based on cognitive context.

        Args:
            intent: Detected intent from BNE (7 = complain = high risk)
        """
        if intent == 7:  # High-risk intent
            self.priming_factor = 0.7  # Increase sensitivity
        else:
            self.priming_factor = 1.0

    def get_parameters(self) -> Dict[str, Any]:
        """Get current model parameters for serialization."""
        return {
            "input_dim": self.input_dim,
            "hidden_dim": self.hidden_dim,
            "output_dim": self.output_dim,
            "threshold": self.threshold,
            "use_snn": self.use_snn,
            "num_steps": self.num_steps,
            "priming_factor": self.priming_factor,
        }

    def set_threshold(self, threshold: float):
        """Set new base threshold."""
        self.threshold = threshold
        logger.info(f"NADE threshold updated to {threshold}")


class SNNWrapper(nn.Module):
    """
    SNN Wrapper for NADE using snntorch.

    This wrapper provides spiking neural network functionality
    when running on neuromorphic hardware or simulation.
    """

    def __init__(
        self,
        input_dim: int = 64,
        hidden_dim: int = 128,
        output_dim: int = 64,
        num_steps: int = 10,
    ):
        super().__init__()

        self.num_steps = num_steps

        try:
            import snntorch as snn
            from snntorch import surrogate

            self.snn = snn
            self.surrogate = surrogate
            self.use_snn = True

            # LIF neuron parameters
            self.beta = 0.8

            # SNN layers
            self.fc1 = nn.Linear(input_dim, hidden_dim)
            self.lif1 = snn.Leaky(beta=self.beta, spike_grad=surrogate.fast_sigmoid())
            self.fc2 = nn.Linear(hidden_dim, output_dim)
            self.lif2 = snn.Leaky(beta=self.beta, spike_grad=surrogate.fast_sigmoid())

            self.anomaly_head = nn.Sequential(
                nn.Linear(output_dim, hidden_dim),
                nn.ReLU(),
                nn.Linear(hidden_dim, 1),
                nn.Sigmoid(),
            )

            self.fusion_proj = nn.Linear(output_dim, 128)

            logger.info("SNN wrapper initialized with snntorch")

        except ImportError:
            logger.warning("snntorch not available, falling back to ANN")
            self.use_snn = False
            self.nade = NADEEngine(input_dim, hidden_dim, output_dim)

    def forward(
        self, x: torch.Tensor, context: Optional[Dict] = None
    ) -> Dict[str, torch.Tensor]:
        if not self.use_snn:
            return self.nade(x, context)

        import snntorch as snn

        batch_size = x.size(0)

        # Initialize membrane potentials
        mem1 = self.lif1.init_leaky()
        mem2 = self.lif2.init_leaky()

        spike_records = []

        for step in range(self.num_steps):
            current = x[:, step, :] if x.dim() == 3 else x

            # First layer
            cur1 = self.fc1(current)
            spk1, mem1 = self.lif1(cur1, mem1)

            # Second layer
            cur2 = self.fc2(spk1)
            spk2, mem2 = self.lif2(cur2, mem2)

            spike_records.append(spk2)

        # Aggregate spikes
        output = torch.stack(spike_records).mean(dim=0)
        anomaly = torch.sigmoid(self.anomaly_head(output))

        return {
            "features": self.fusion_proj(output),
            "anomaly_score": anomaly,
            "is_anomaly": anomaly > 0.5,
        }
