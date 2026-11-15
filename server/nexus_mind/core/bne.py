"""
BNE - Behavioral Neurolinguistics Engine

Purpose: Transformer-based intent prediction from behavioral sequences.
Key features:
- 8 intent classes + sentiment + action prediction
- Inverse Reinforcement Learning (optional integration)
- Memory for pattern matching
"""

import torch
import torch.nn as nn
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)


class BNEEngine(nn.Module):
    """
    Behavioral Neurolinguistics Engine.

    Predicts user intent, sentiment, and actions from behavioral sequences.
    """

    # Intent classes
    INTENT_CLASSES = [
        "search",  # 0
        "purchase",  # 1
        "browse",  # 2
        "inquire",  # 3
        "compare",  # 4
        "review",  # 5
        "share",  # 6
        "complain",  # 7
    ]

    SENTIMENT_CLASSES = ["positive", "neutral", "negative"]
    ACTION_CLASSES = ["none", "click", "scroll", "submit"]

    def __init__(
        self,
        input_dim: int = 64,
        hidden_dim: int = 256,
        num_intents: int = 8,
        max_seq_len: int = 100,
        num_layers: int = 4,
        num_heads: int = 8,
    ):
        """
        Initialize BNE Engine.

        Args:
            input_dim: Input feature dimension
            hidden_dim: Hidden layer dimension
            num_intents: Number of intent classes
            max_seq_len: Maximum sequence length
            num_layers: Number of transformer layers
            num_heads: Number of attention heads
        """
        super().__init__()

        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.num_intents = num_intents
        self.max_seq_len = max_seq_len

        # Input projection
        self.input_proj = nn.Linear(input_dim, hidden_dim)

        # Transformer encoder
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=hidden_dim,
            nhead=num_heads,
            dim_feedforward=hidden_dim * 4,
            dropout=0.1,
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        # Output heads
        self.intent_head = nn.Linear(hidden_dim, num_intents)
        self.sentiment_head = nn.Linear(hidden_dim, 3)  # positive/neutral/negative
        self.action_head = nn.Linear(hidden_dim, 4)  # none/click/scroll/submit
        self.engagement_head = nn.Linear(hidden_dim, 1)

        # Fusion projection
        self.fusion_proj = nn.Linear(hidden_dim, 256)

        # Behavioral memory
        self.memory_size = 10
        self.memory = None

        # Layer norm
        self.norm = nn.LayerNorm(hidden_dim)

        logger.info(
            f"BNE Engine initialized: input={input_dim}, hidden={hidden_dim}, intents={num_intents}"
        )

    def forward(
        self,
        x: torch.Tensor,
        mask: Optional[torch.Tensor] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass through BNE.

        Args:
            x: Behavioral sequences of shape (B, seq_len, input_dim)
            mask: Optional attention mask
            context: Optional context from GIE (scene info, etc.)

        Returns:
            Dictionary containing:
                - features: Fusion features (batch, 256)
                - intent_logits: Intent classification (batch, 8)
                - sentiment: Sentiment classification (batch, 3)
                - action_logits: Action prediction (batch, 4)
                - engagement: Engagement score (batch, 1)
        """
        # Handle different input shapes
        if x.dim() == 2:
            x = x.unsqueeze(1)  # (batch, 1, input_dim)
        elif x.dim() == 1:
            x = x.unsqueeze(0).unsqueeze(0)  # (1, 1, input_dim)

        # Project input
        x = self.input_proj(x)  # (B, seq_len, hidden_dim)

        # Apply scene context if available
        if context and "scene" in context:
            scene_embed = context["scene"]
            if scene_embed is not None:
                x = x + scene_embed.unsqueeze(1) * 0.1

        # Transformer encoding
        x = self.transformer(x, src_key_padding_mask=mask)

        # Apply layer norm
        x = self.norm(x)

        # Mean pooling over sequence
        pooled = x.mean(dim=1)  # (B, hidden_dim)

        # Compute outputs
        intent_logits = self.intent_head(pooled)
        sentiment = self.sentiment_head(pooled)
        action_logits = self.action_head(pooled)
        engagement = torch.sigmoid(self.engagement_head(pooled))

        # Update memory
        self._update_memory(pooled)

        return {
            "features": self.fusion_proj(pooled),
            "intent_logits": intent_logits,
            "sentiment": sentiment,
            "action_logits": action_logits,
            "engagement": engagement,
            "intent_class": intent_logits.argmax(dim=-1),
            "sentiment_class": sentiment.argmax(dim=-1),
            "action_class": action_logits.argmax(dim=-1),
        }

    def _update_memory(self, hidden_state: torch.Tensor):
        """Update behavioral memory with new hidden state."""
        if self.memory is None:
            self.memory = hidden_state.detach()
        else:
            # Append new state, keep last N states
            self.memory = torch.cat([self.memory, hidden_state.detach()], dim=0)[
                -self.memory_size :
            ]

    def get_memory(self) -> Optional[torch.Tensor]:
        """Get current behavioral memory."""
        return self.memory

    def clear_memory(self):
        """Clear behavioral memory."""
        self.memory = None
        logger.info("BNE memory cleared")

    def get_intent_name(self, intent_id: int) -> str:
        """Get intent name from ID."""
        if 0 <= intent_id < len(self.INTENT_CLASSES):
            return self.INTENT_CLASSES[intent_id]
        return "unknown"

    def get_parameters(self) -> Dict[str, Any]:
        """Get current model parameters."""
        return {
            "input_dim": self.input_dim,
            "hidden_dim": self.hidden_dim,
            "num_intents": self.num_intents,
            "max_seq_len": self.max_seq_len,
            "memory_size": self.memory_size,
        }


class IRLModule(nn.Module):
    """
    Inverse Reinforcement Learning module.

    Optionally integrates with BNE to learn reward functions
    from demonstrations.
    """

    def __init__(self, state_dim: int = 256, hidden_dim: int = 128):
        super().__init__()

        self.state_encoder = nn.Sequential(
            nn.Linear(state_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
        )

        # Reward function
        self.reward_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )

        # Value function
        self.value_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
        )

    def forward(self, state: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Compute reward and value for a given state.

        Args:
            state: State tensor

        Returns:
            Dictionary with reward and value
        """
        encoded = self.state_encoder(state)
        reward = self.reward_head(encoded)
        value = self.value_head(encoded)

        return {"reward": reward, "value": value}

    def compute_advantage(
        self, rewards: torch.Tensor, values: torch.Tensor, gamma: float = 0.99
    ) -> torch.Tensor:
        """
        Compute advantage for policy gradient methods.

        Args:
            rewards: Reward tensor
            values: Value tensor
            gamma: Discount factor

        Returns:
            Advantage tensor
        """
        returns = []
        discounted_reward = 0

        for reward in reversed(rewards):
            discounted_reward = reward + gamma * discounted_reward
            returns.insert(0, discounted_reward)

        returns = torch.tensor(returns)
        advantage = returns - values

        return advantage
