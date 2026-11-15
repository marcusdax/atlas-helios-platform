"""
Kimi Fusion with Mamba - Cross-Modal Fusion using State-Space Models

This module provides Kimi Delta Attention implementation using Mamba
for linear-complexity cross-modal fusion.

Installation:
    pip install causal-conv1d>=1.4.0
    pip install mamba-ssm
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

# Try to import mamba_ssm
try:
    from mamba_ssm import Mamba

    MAMBA_AVAILABLE = True
except ImportError:
    MAMBA_AVAILABLE = False
    logger.warning(
        "mamba-ssm not available. KimiFusion will use fallback implementation."
    )


class KimiFusionMamba(nn.Module):
    """
    Kimi Delta Attention Fusion using Mamba SSM.

    This implementation uses Mamba to process concatenated tokens from
    NADE, GIE, and BNE, providing O(n) linear complexity for
    cross-modal fusion.

    Key features:
    - Concatenates tokens from all three engines
    - Uses Mamba for cross-modal processing
    - Learnable gating parameters
    - Confidence estimation
    """

    def __init__(
        self,
        dim_nade: int = 128,
        dim_gie: int = 256,
        dim_bne: int = 256,
        fused_dim: int = 512,
        d_state: int = 16,
        d_conv: int = 4,
        expand: int = 2,
    ):
        """
        Initialize Kimi Fusion with Mamba.

        Args:
            dim_nade: NADE output dimension
            dim_gie: GIE output dimension
            dim_bne: BNE output dimension
            fused_dim: Final fused dimension
            d_state: SSM state expansion factor
            d_conv: Local convolution width
            expand: Block expansion factor
        """
        super().__init__()

        self.dim_nade = dim_nade
        self.dim_gie = dim_gie
        self.dim_bne = dim_bne
        self.fused_dim = fused_dim

        # Project each engine to fused_dim
        self.proj_nade = nn.Linear(dim_nade, fused_dim)
        self.proj_gie = nn.Linear(dim_gie, fused_dim)
        self.proj_bne = nn.Linear(dim_bne, fused_dim)

        # Mamba for cross-modal processing
        self.mamba = Mamba(
            d_model=fused_dim, d_state=d_state, d_conv=d_conv, expand=expand
        )

        # Output projection
        self.out_proj = nn.Linear(fused_dim, fused_dim)
        self.norm = nn.LayerNorm(fused_dim)

        # Confidence head
        self.confidence_head = nn.Sequential(
            nn.Linear(fused_dim, fused_dim // 4),
            nn.ReLU(),
            nn.Linear(fused_dim // 4, 1),
            nn.Sigmoid(),
        )

        # Learnable gating weights
        self.gate_weights = nn.Parameter(torch.ones(3) / 3)

        logger.info(f"KimiFusionMamba initialized: fused_dim={fused_dim}")

    def forward(
        self, nade_feat: torch.Tensor, gie_feat: torch.Tensor, bne_feat: torch.Tensor
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass through Kimi Fusion with Mamba.

        Args:
            nade_feat: NADE features (batch, dim_nade)
            gie_feat: GIE features (batch, dim_gie)
            bne_feat: BNE features (batch, dim_bne)

        Returns:
            Dictionary containing:
                - fused: Fused intelligence vector (batch, fused_dim)
                - confidence: Confidence score (batch, 1)
        """
        # Project each to fused_dim
        nade = self.proj_nade(nade_feat).unsqueeze(1)  # (B, 1, F)
        gie = self.proj_gie(gie_feat).unsqueeze(1)  # (B, 1, F)
        bne = self.proj_bne(bne_feat).unsqueeze(1)  # (B, 1, F)

        # Concatenate along sequence dimension
        tokens = torch.cat([nade, gie, bne], dim=1)  # (B, 3, F)

        # Process with Mamba
        out = self.mamba(tokens)  # (B, 3, F)

        # Apply learnable gating
        weights = F.softmax(self.gate_weights, dim=0)
        gated_out = out * weights.view(1, 3, 1)  # (B, 3, F)

        # Aggregate (weighted mean over tokens)
        fused = gated_out.sum(dim=1)  # (B, F)

        # Final projection and normalization
        fused = self.out_proj(fused)
        fused = self.norm(F.gelu(fused))

        # Confidence score
        confidence = self.confidence_head(fused)

        return {"fused": fused, "confidence": confidence}


class KimiFusionFactory:
    """
    Factory class to create Kimi Fusion with optional Mamba support.
    """

    @staticmethod
    def create(use_mamba: bool = True, **kwargs):
        """
        Create a Kimi Fusion instance.

        Args:
            use_mamba: Whether to use Mamba implementation
            **kwargs: Arguments passed to Fusion

        Returns:
            Fusion engine
        """
        if use_mamba and MAMBA_AVAILABLE:
            logger.info("Creating Mamba-based Kimi Fusion")
            return KimiFusionMamba(**kwargs)
        elif use_mamba and not MAMBA_AVAILABLE:
            logger.warning(
                "Mamba requested but mamba-ssm not available. Using standard Fusion."
            )
            from nexus_mind.core.fusion import KimiDeltaAttention

            return KimiDeltaAttention(**kwargs)
        else:
            from nexus_mind.core.fusion import KimiDeltaAttention

            return KimiDeltaAttention(**kwargs)

    @staticmethod
    def is_mamba_available() -> bool:
        """Check if mamba-ssm is available."""
        return MAMBA_AVAILABLE


def create_kimi_fusion_mamba(**kwargs) -> nn.Module:
    """
    Convenience function to create Kimi Fusion with Mamba.

    Usage:
        fusion = create_kimi_fusion_mamba(dim_nade=128, dim_gie=256, dim_bne=256)
    """
    if not MAMBA_AVAILABLE:
        raise ImportError("mamba-ssm required. Install: pip install mamba-ssm")
    return KimiFusionMamba(**kwargs)
