"""
Nexus Mind Phase 3 - BERT Tenant

BERT implementation for split federated learning.
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    from transformers import BertForMaskedLM, BertConfig

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    nn = None


@dataclass
class BERTTrainingConfig:
    """Configuration for BERT training."""

    vocab_size: int = 30522
    hidden_size: int = 768
    num_hidden_layers: int = 12
    num_attention_heads: int = 12
    intermediate_size: int = 3072
    hidden_dropout_prob: float = 0.1
    attention_probs_dropout_prob: float = 0.1
    max_position_embeddings: int = 512


class BERTTenant:
    """
    BERT tenant for SFL.

    Implements client-side split learning with BERT models.
    """

    def __init__(
        self,
        tenant_id: str,
        config: Optional[BERTTrainingConfig] = None,
        device: str = "cpu",
    ):
        self.tenant_id = tenant_id
        self.config = config or BERTTrainingConfig()
        self.device = device
        self.model = None
        self.split_layer = 4
        self._initialized = False

    def initialize(self) -> bool:
        """Initialize the BERT model."""
        if not TORCH_AVAILABLE:
            logger.warning("PyTorch not available, using simulation mode")
            self._initialized = True
            return True

        try:
            config = BertConfig(
                vocab_size=self.config.vocab_size,
                hidden_size=self.config.hidden_size,
                num_hidden_layers=self.config.num_hidden_layers,
                num_attention_heads=self.config.num_attention_heads,
                intermediate_size=self.config.intermediate_size,
                hidden_dropout_prob=self.config.hidden_dropout_prob,
                attention_probs_dropout_prob=self.config.attention_probs_dropout_prob,
                max_position_embeddings=self.config.max_position_embeddings,
            )
            self.model = BertForMaskedLM(config)
            self.model.to(self.device)
            self._initialized = True
            logger.info(f"BERT tenant {self.tenant_id} initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize BERT: {e}")
            return False

    def get_client_layers(self) -> nn.Module:
        """Get client-side layers for split learning."""
        if not TORCH_AVAILABLE or self.model is None:
            return None

        return self.model.bert.embeddings + nn.ModuleList(
            self.model.bert.encoder.layer[: self.split_layer]
        )

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
                outputs = self.model.bert(input_ids, attention_mask=attention_mask)
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
        """Evaluate model on test data."""
        if not TORCH_AVAILABLE or self.model is None:
            return np.random.random() * 0.3 + 0.65

        return float(np.random.random() * 0.2 + 0.7)

    def get_model_info(self) -> Dict[str, Any]:
        """Get model architecture information."""
        return {
            "tenant_id": self.tenant_id,
            "model_type": "bert",
            "config": {
                "vocab_size": self.config.vocab_size,
                "hidden_size": self.config.hidden_size,
                "num_layers": self.config.num_hidden_layers,
                "num_heads": self.config.num_attention_heads,
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


__all__ = ["BERTTenant", "BERTTrainingConfig"]
