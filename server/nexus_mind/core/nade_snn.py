"""
NADE SNN - Neuromorphic Anomaly Detection with snnTorch

This module provides a full SNN implementation using snntorch for
neuromorphic hardware support.

Installation:
    pip install snntorch

Requirements:
    - PyTorch >= 1.12
    - snntorch >= 0.8.0
"""

import torch
import torch.nn as nn
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

# Try to import snntorch, provide fallback if not available
try:
    import snntorch as snn
    from snntorch import surrogate

    SNNTORCH_AVAILABLE = True
except ImportError:
    SNNTORCH_AVAILABLE = False
    logger.warning(
        "snntorch not available. SNN NADE will fall back to ANN implementation."
    )


class NADESNN(nn.Module):
    """
    Neuromorphic Anomaly Detection Engine using snnTorch LIF neurons.

    This implementation uses Leaky Integrate-and-Fire (LIF) neurons
    with surrogate gradients for training.

    Key features:
    - Temporal processing over multiple time steps
    - Spike-based feature extraction
    - Membrane potential dynamics
    """

    def __init__(
        self,
        input_dim: int = 64,
        hidden_dim: int = 128,
        output_dim: int = 64,
        num_steps: int = 10,
        beta: float = 0.95,
        spike_grad=None,
    ):
        """
        Initialize SNN-based NADE.

        Args:
            input_dim: Input feature dimension
            hidden_dim: Hidden layer dimension
            output_dim: Output feature dimension
            num_steps: Number of temporal steps for SNN
            beta: Membrane potential decay rate
            spike_grad: Surrogate gradient function
        """
        super().__init__()

        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.output_dim = output_dim
        self.num_steps = num_steps

        if not SNNTORCH_AVAILABLE:
            raise ImportError(
                "snntorch is required for NADESNN. Install with: pip install snntorch"
            )

        if spike_grad is None:
            spike_grad = surrogate.fast_sigmoid()

        # First fully connected layer
        self.fc1 = nn.Linear(input_dim, hidden_dim)

        # LIF neuron layer 1
        self.lif1 = snn.Leaky(
            beta=beta, spike_grad=spike_grad, init_hidden=True, output=False
        )

        # Second fully connected layer
        self.fc2 = nn.Linear(hidden_dim, hidden_dim)

        # LIF neuron layer 2
        self.lif2 = snn.Leaky(
            beta=beta, spike_grad=spike_grad, init_hidden=True, output=False
        )

        # Output layer for anomaly score
        self.fc_out = nn.Linear(hidden_dim, 1)

        # Fusion projection (to match 128-dim required by KDA)
        self.fusion_proj = nn.Linear(hidden_dim, 128)

        logger.info(
            f"NADESNN initialized: input={input_dim}, hidden={hidden_dim}, steps={num_steps}"
        )

    def forward(
        self, x: torch.Tensor, context: Optional[Dict] = None
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass through SNN NADE.

        Args:
            x: Input tensor of shape (batch, time_steps, input_dim)
            context: Optional context dict (ignored for SNN)

        Returns:
            Dictionary containing:
                - features: Hidden features (batch, hidden_dim)
                - anomaly_score: Anomaly probability (batch, 1)
                - fusion_features: Features for KDA (batch, 128)
        """
        batch_size = x.size(0)

        # Initialize hidden states (membrane potential)
        mem1 = self.lif1.init_leaky()
        mem2 = self.lif2.init_leaky()

        # Store spikes over time
        spike_records = []

        # Loop over time steps
        for step in range(self.num_steps):
            # Get input at current time step
            cur_input = x[:, step, :]

            # First layer: linear -> LIF
            cur1 = self.fc1(cur_input)
            spk1, mem1 = self.lif1(cur1, mem1)

            # Second layer: linear -> LIF
            cur2 = self.fc2(spk1)
            spk2, mem2 = self.lif2(cur2, mem2)

            spike_records.append(spk2)

        # Aggregate spikes across time (mean spike count)
        avg_spikes = torch.stack(spike_records).mean(dim=0)  # (batch, hidden_dim)

        # Compute anomaly score
        anomaly_logit = self.fc_out(avg_spikes)
        anomaly_score = torch.sigmoid(anomaly_logit)

        # Project for fusion
        fusion_features = self.fusion_proj(avg_spikes)

        return {
            "features": avg_spikes,
            "anomaly_score": anomaly_score,
            "fusion_features": fusion_features,
            "is_anomaly": anomaly_score > 0.5,
        }

    def forward_with_membrane(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Alternative forward pass that also returns membrane potentials.
        Useful for detailed analysis.
        """
        batch_size = x.size(0)

        mem1 = self.lif1.init_leaky()
        mem2 = self.lif2.init_leaky()

        spike_records = []
        membrane_records = []

        for step in range(self.num_steps):
            cur_input = x[:, step, :]

            cur1 = self.fc1(cur_input)
            spk1, mem1 = self.lif1(cur1, mem1)

            cur2 = self.fc2(spk1)
            spk2, mem2 = self.lif2(cur2, mem2)

            spike_records.append(spk2)
            membrane_records.append(mem2)

        avg_spikes = torch.stack(spike_records).mean(dim=0)
        avg_membrane = torch.stack(membrane_records).mean(dim=0)

        anomaly_score = torch.sigmoid(self.fc_out(avg_spikes))

        return {
            "features": avg_spikes,
            "membrane_potential": avg_membrane,
            "anomaly_score": anomaly_score,
            "fusion_features": self.fusion_proj(avg_spikes),
        }


class NADESNNFactory:
    """
    Factory class to create NADE with optional SNN support.
    """

    @staticmethod
    def create(use_snn: bool = True, **kwargs):
        """
        Create a NADE instance.

        Args:
            use_snn: Whether to use SNN implementation
            **kwargs: Arguments passed to NADE

        Returns:
            NADE engine
        """
        if use_snn and SNNTORCH_AVAILABLE:
            logger.info("Creating SNN-based NADE")
            return NADESNN(**kwargs)
        elif use_snn and not SNNTORCH_AVAILABLE:
            logger.warning(
                "SNN requested but snntorch not available. Using ANN fallback."
            )
            from nexus_mind.core.nade import NADEEngine

            return NADEEngine(**kwargs)
        else:
            from nexus_mind.core.nade import NADEEngine

            return NADEEngine(**kwargs)

    @staticmethod
    def is_snn_available() -> bool:
        """Check if snntorch is available."""
        return SNNTORCH_AVAILABLE


def create_nade_snn(**kwargs) -> nn.Module:
    """
    Convenience function to create SNN NADE.

    Usage:
        nade = create_nade_snn(input_dim=64, hidden_dim=128, num_steps=10)
    """
    if not SNNTORCH_AVAILABLE:
        raise ImportError("snntorch required. Install: pip install snntorch")
    return NADESNN(**kwargs)
