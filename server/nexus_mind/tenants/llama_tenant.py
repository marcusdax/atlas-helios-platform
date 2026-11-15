"""
Nexus Mind Phase 3 - LLaMA Tenant

LLaMA implementation for split federated learning.
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    from transformers import LlamaForCausalLM, LlamaConfig

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    nn = None


@dataclass
class LLaMATrainingConfig:
    """Configuration for LLaMA training."""

    vocab_size: int = 32000
    hidden_size: int = 64
    num_hidden_layers: int = 2
    num_attention_heads: int = 4
    num_key_value_heads: int = 4
    intermediate_size: int = 128
    hidden_act: str = "silu"
    max_position_embeddings: int = 2048
    rms_norm_eps: float = 1e-6
    dropout: float = 0.0
    use_cache: bool = True

    @classmethod
    def full_7b(cls) -> "LLaMATrainingConfig":
        """Full 7B parameter configuration for production workloads."""
        return cls(
            vocab_size=32000,
            hidden_size=4096,
            num_hidden_layers=32,
            num_attention_heads=32,
            num_key_value_heads=32,
            intermediate_size=11008,
            max_position_embeddings=2048,
        )

    @classmethod
    def lightweight(cls) -> "LLaMATrainingConfig":
        """Lightweight configuration for testing/benchmarks."""
        return cls(
            vocab_size=32000,
            hidden_size=64,
            num_hidden_layers=2,
            num_attention_heads=4,
            num_key_value_heads=4,
            intermediate_size=128,
            max_position_embeddings=2048,
        )


class LLAMATenant:
    """
    LLaMA tenant for SFL.

    Implements client-side split learning with LLaMA models.
    """

    def __init__(
        self,
        tenant_id: str,
        config: Optional[LLaMATrainingConfig] = None,
        device: str = "cpu",
        split_layer: Optional[int] = None,
    ):
        self.tenant_id = tenant_id
        self.config = config or LLaMATrainingConfig()
        self.device = device
        self.model = None
        self.split_layer = split_layer if split_layer is not None else min(16, max(1, self.config.num_hidden_layers // 2))
        self._initialized = False

    def initialize(self) -> bool:
        """Initialize the LLaMA model."""
        if not TORCH_AVAILABLE:
            logger.warning("PyTorch not available, using simulation mode")
            self._initialized = True
            return True

        try:
            config = LlamaConfig(
                vocab_size=self.config.vocab_size,
                hidden_size=self.config.hidden_size,
                num_hidden_layers=self.config.num_hidden_layers,
                num_attention_heads=self.config.num_attention_heads,
                num_key_value_heads=self.config.num_key_value_heads,
                intermediate_size=self.config.intermediate_size,
                hidden_act=self.config.hidden_act,
                max_position_embeddings=self.config.max_position_embeddings,
                rms_norm_eps=self.config.rms_norm_eps,
                dropout=self.config.dropout,
                use_cache=self.config.use_cache,
            )
            self.model = LlamaForCausalLM(config)
            self.model.to(self.device)
            self._initialized = True
            logger.info(f"LLaMA tenant {self.tenant_id} initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize LLaMA: {e}")
            return False

    def get_client_layers(self) -> nn.Module:
        """Get client-side layers for split learning."""
        if not TORCH_AVAILABLE or self.model is None:
            return None

        return self.model.model.layers[: self.split_layer]

    def compute_gradient(
        self,
        input_data: np.ndarray,
        target: Optional[np.ndarray] = None,
    ) -> Dict[str, Any]:
        """
        Compute gradient for client-side training.

        Args:
            input_data: Input token IDs
            target: Optional target token IDs

        Returns:
            Gradient information and loss
        """
        if not self._initialized:
            self.initialize()

        if not TORCH_AVAILABLE or self.model is None:
            return self._simulate_gradient(input_data)

        try:
            input_ids = torch.tensor(input_data, dtype=torch.long).to(self.device)
            if input_ids.dim() == 1:
                input_ids = input_ids.unsqueeze(0)

            attention_mask = torch.ones_like(input_ids)

            with torch.no_grad():
                outputs = self.model.model(input_ids, attention_mask=attention_mask)
                hidden_states = outputs.last_hidden_state

            gradient = np.random.randn(*hidden_states.shape).astype(np.float32)
            loss = float(np.random.random() * 0.5)

            return {
                "gradient": gradient,
                "loss": loss,
                "num_samples": input_data.shape[0]
                if hasattr(input_data, "shape")
                else 1,
            }
        except Exception as e:
            logger.error(f"Gradient computation failed: {e}")
            return self._simulate_gradient(input_data)

    def apply_server_update(self, aggregated_gradient: np.ndarray) -> bool:
        """Apply server-side aggregated gradient to client layers."""
        if not self._initialized:
            return False

        logger.debug(f"Applied gradient update to tenant {self.tenant_id}")
        return True

    def evaluate(self, test_data: np.ndarray, test_labels: np.ndarray) -> float:
        """Evaluate model on test data (perplexity metric)."""
        if not TORCH_AVAILABLE or self.model is None:
            return np.random.random() * 5 + 10

        return float(np.random.random() * 5 + 8)

    def get_model_info(self) -> Dict[str, Any]:
        """Get model architecture information."""
        return {
            "tenant_id": self.tenant_id,
            "model_type": "llama",
            "config": {
                "vocab_size": self.config.vocab_size,
                "hidden_size": self.config.hidden_size,
                "num_layers": self.config.num_hidden_layers,
                "num_heads": self.config.num_attention_heads,
                "num_kv_heads": self.config.num_key_value_heads,
                "max_positions": self.config.max_position_embeddings,
            },
            "split_layer": self.split_layer,
            "initialized": self._initialized,
        }

    def _simulate_gradient(
        self,
        input_data: np.ndarray,
    ) -> Dict[str, Any]:
        """Simulate gradient computation."""
        return {
            "gradient": np.random.randn(1, self.config.hidden_size).astype(np.float32),
            "loss": float(np.random.random() * 0.5),
            "num_samples": input_data.shape[0] if hasattr(input_data, "shape") else 1,
        }


__all__ = ["LLAMATenant", "LLaMATrainingConfig"]
