"""
GIE Mamba - Geospatial Intelligence Engine with Mamba SSM

This module provides a full implementation using the official mamba-ssm library.

Installation:
    pip install causal-conv1d>=1.4.0
    pip install mamba-ssm

Requirements:
    - Linux (required for GPU version)
    - NVIDIA GPU with CUDA
    - PyTorch >= 1.12
    - CUDA >= 11.6
"""

import torch
import torch.nn as nn
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

# Try to import mamba_ssm, provide fallback if not available
try:
    from mamba_ssm import Mamba

    MAMBA_AVAILABLE = True
except ImportError:
    MAMBA_AVAILABLE = False
    logger.warning(
        "mamba-ssm not available. GIE will fall back to standard implementation."
    )


class GIEHybridMamba(nn.Module):
    """
    Geospatial Intelligence Engine with Vision Transformer patch embedding
    and Mamba SSM for global context processing.

    Key features:
    - ViT-style patch embedding
    - Mamba state-space layers for sequence processing
    - Linear-time complexity O(n)
    - Multi-task heads (property, zone, objects)
    """

    def __init__(
        self,
        img_size: int = 224,
        patch_size: int = 16,
        in_chans: int = 3,
        embed_dim: int = 256,
        depth: int = 6,
        mamba_d_state: int = 16,
        mamba_d_conv: int = 4,
        mamba_expand: int = 2,
    ):
        """
        Initialize GIE with Mamba.

        Args:
            img_size: Input image size
            patch_size: Patch size for ViT
            in_chans: Number of input channels
            embed_dim: Embedding dimension
            depth: Number of Mamba layers
            mamba_d_state: SSM state expansion factor
            mamba_d_conv: Local convolution width
            mamba_expand: Block expansion factor
        """
        super().__init__()

        if not MAMBA_AVAILABLE:
            raise ImportError(
                "mamba-ssm is required for GIEHybridMamba. Install with: pip install mamba-ssm"
            )

        self.img_size = img_size
        self.patch_size = patch_size
        self.in_chans = in_chans
        self.embed_dim = embed_dim
        self.depth = depth

        # Patch embedding (ViT-style)
        self.patch_embed = nn.Conv2d(
            in_chans, embed_dim, kernel_size=patch_size, stride=patch_size
        )

        num_patches = (img_size // patch_size) ** 2

        # Class token and position embeddings
        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        self.pos_embed = nn.Parameter(torch.randn(1, num_patches + 1, embed_dim))

        # Mamba layers
        self.mamba_layers = nn.ModuleList(
            [
                Mamba(
                    d_model=embed_dim,
                    d_state=mamba_d_state,
                    d_conv=mamba_d_conv,
                    expand=mamba_expand,
                )
                for _ in range(depth)
            ]
        )

        # Layer norm
        self.norm = nn.LayerNorm(embed_dim)

        # Output heads
        self.property_head = nn.Linear(embed_dim, 5)
        self.ufz_head = nn.Linear(embed_dim, 10)
        self.objects_head = nn.Linear(embed_dim, 20)

        # Fusion projection
        self.fusion_proj = nn.Linear(embed_dim, 256)

        logger.info(
            f"GIEHybridMamba initialized: img_size={img_size}, embed_dim={embed_dim}, depth={depth}"
        )

    def forward(
        self, x: torch.Tensor, attention_focus: Optional[torch.Tensor] = None
    ) -> Dict[str, torch.Tensor]:
        """
        Forward pass through GIE with Mamba.

        Args:
            x: Input images of shape (B, C, H, W)
            attention_focus: Optional attention modulation (currently ignored)

        Returns:
            Dictionary containing:
                - features: Pooled features (batch, embed_dim)
                - property_logits: Property classification (batch, 5)
                - ufz_logits: Urban functional zone (batch, 10)
                - objects_logits: Object detection (batch, 20)
                - fusion_features: Features for KDA (batch, 256)
        """
        B = x.shape[0]

        # Patch embedding
        x = self.patch_embed(x)  # (B, embed_dim, Hp, Wp)

        # Rearrange to sequence
        x = x.flatten(2).transpose(1, 2)  # (B, num_patches, embed_dim)

        # Add class token
        cls_tokens = self.cls_token.expand(B, -1, -1)
        x = torch.cat((cls_tokens, x), dim=1)  # (B, num_patches+1, embed_dim)

        # Add position embedding
        x = x + self.pos_embed[:, : x.size(1), :]

        # Pass through Mamba layers
        for layer in self.mamba_layers:
            x = layer(x)  # Mamba preserves shape

        # Apply norm
        x = self.norm(x)

        # Use class token output
        cls_out = x[:, 0]

        # Task predictions
        property_logits = self.property_head(cls_out)
        ufz_logits = self.ufz_head(cls_out)
        objects_logits = self.objects_head(cls_out)

        # Fusion features
        fusion_features = self.fusion_proj(cls_out)

        return {
            "features": cls_out,
            "property_logits": property_logits,
            "ufz_logits": ufz_logits,
            "objects_logits": objects_logits,
            "property_class": property_logits.argmax(dim=-1),
            "ufz_class": ufz_logits.argmax(dim=-1),
            "objects_class": objects_logits.argmax(dim=-1),
            "fusion_features": fusion_features,
        }


class GIEHybridMambaFactory:
    """
    Factory class to create GIE with optional Mamba support.
    """

    @staticmethod
    def create(use_mamba: bool = True, **kwargs):
        """
        Create a GIE instance.

        Args:
            use_mamba: Whether to use Mamba implementation
            **kwargs: Arguments passed to GIE

        Returns:
            GIE engine
        """
        if use_mamba and MAMBA_AVAILABLE:
            logger.info("Creating Mamba-based GIE")
            return GIEHybridMamba(**kwargs)
        elif use_mamba and not MAMBA_AVAILABLE:
            logger.warning(
                "Mamba requested but mamba-ssm not available. Using standard GIE."
            )
            from nexus_mind.core.gie import GIEEngine

            return GIEEngine(**kwargs)
        else:
            from nexus_mind.core.gie import GIEEngine

            return GIEEngine(**kwargs)

    @staticmethod
    def is_mamba_available() -> bool:
        """Check if mamba-ssm is available."""
        return MAMBA_AVAILABLE

    @staticmethod
    def check_requirements() -> Dict[str, bool]:
        """
        Check if system meets requirements for Mamba.

        Returns:
            Dictionary with requirement status
        """
        import platform
        import torch

        return {
            "linux": platform.system() == "Linux",
            "cuda": torch.cuda.is_available(),
            "mamba_installed": MAMBA_AVAILABLE,
        }


def create_gie_mamba(**kwargs) -> nn.Module:
    """
    Convenience function to create GIE with Mamba.

    Usage:
        gie = create_gie_mamba(img_size=224, embed_dim=256, depth=6)
    """
    if not MAMBA_AVAILABLE:
        raise ImportError("mamba-ssm required. Install: pip install mamba-ssm")
    return GIEHybridMamba(**kwargs)
