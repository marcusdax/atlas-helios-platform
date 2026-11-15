"""
Advanced Nexus Mind - Factory for SNN and Mamba Integration

This module provides a unified interface to create Nexus Mind components
with optional SNN (snnTorch) and Mamba SSM support.

Usage:
    # Create with SNN and Mamba
    from nexus_mind.advanced import create_nexus_mind

    manager = create_nexus_mind(use_snn=True, use_mamba=True)

    # Or use individual factories
    from nexus_mind.advanced import NADESNNFactory, GIEHybridMambaFactory, KimiFusionMambaFactory
"""

import torch
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

# Import base classes
from nexus_mind.core.nade import NADEEngine
from nexus_mind.core.gie import GIEEngine
from nexus_mind.core.bne import BNEEngine
from nexus_mind.core.fusion import KimiDeltaAttention
from nexus_mind.cognitive.manager import CognitiveLoopManager

# Try to import advanced implementations
try:
    from nexus_mind.core.nade_snn import (
        NADESNN,
        NADESNNFactory,
        create_nade_snn,
        SNNTORCH_AVAILABLE,
    )
except ImportError:
    NADESNN = None
    NADESNNFactory = None
    create_nade_snn = None
    SNNTORCH_AVAILABLE = False

try:
    from nexus_mind.core.gie_mamba import (
        GIEHybridMamba,
        GIEHybridMambaFactory,
        create_gie_mamba,
        MAMBA_AVAILABLE as GIE_MAMBA_AVAILABLE,
    )
except ImportError:
    GIEHybridMamba = None
    GIEHybridMambaFactory = None
    create_gie_mamba = None
    GIE_MAMBA_AVAILABLE = False

try:
    from nexus_mind.core.fusion_kimi import (
        KimiFusionMamba,
        KimiFusionFactory,
        create_kimi_fusion_mamba,
        MAMBA_AVAILABLE as FUSION_MAMBA_AVAILABLE,
    )
except ImportError:
    KimiFusionMamba = None
    KimiFusionFactory = None
    create_kimi_fusion_mamba = None
    FUSION_MAMBA_AVAILABLE = False

# Overall availability
ADVANCED_AVAILABLE = SNNTORCH_AVAILABLE or GIE_MAMBA_AVAILABLE


class NexusMindFactory:
    """
    Factory class to create Nexus Mind with optional advanced implementations.
    """

    @staticmethod
    def create_advanced(
        use_snn: bool = True, use_mamba: bool = True, device: str = "cpu", **kwargs
    ) -> CognitiveLoopManager:
        """
        Create Nexus Mind with SNN and/or Mamba.

        Args:
            use_snn: Use snnTorch for NADE
            use_mamba: Use mamba-ssm for GIE and Fusion
            device: Device to run on
            **kwargs: Additional arguments for engines

        Returns:
            CognitiveLoopManager instance
        """
        # Create NADE
        if use_snn and SNNTORCH_AVAILABLE:
            logger.info("Using SNN-based NADE")
            nade = NADESNN(
                input_dim=kwargs.get("input_dim", 64),
                hidden_dim=kwargs.get("hidden_dim", 128),
                num_steps=kwargs.get("num_steps", 10),
            )
        else:
            if use_snn:
                logger.warning("SNN requested but snntorch not available. Using ANN.")
            nade = NADEEngine(
                input_dim=kwargs.get("input_dim", 64),
                hidden_dim=kwargs.get("hidden_dim", 128),
            )

        # Create GIE
        if use_mamba and GIE_MAMBA_AVAILABLE:
            logger.info("Using Mamba-based GIE")
            gie = GIEHybridMamba(
                img_size=kwargs.get("img_size", 224),
                embed_dim=kwargs.get("embed_dim", 256),
                depth=kwargs.get("gie_depth", 6),
            )
        else:
            if use_mamba:
                logger.warning(
                    "Mamba requested but mamba-ssm not available. Using standard GIE."
                )
            gie = GIEEngine(
                img_size=kwargs.get("img_size", 224),
                embed_dim=kwargs.get("embed_dim", 256),
            )

        # Create BNE
        bne = BNEEngine(
            input_dim=kwargs.get("input_dim", 64),
            hidden_dim=kwargs.get("bne_hidden", 256),
        )

        # Create Fusion
        if use_mamba and FUSION_MAMBA_AVAILABLE:
            logger.info("Using Mamba-based Kimi Fusion")
            fusion = KimiFusionMamba(
                dim_nade=kwargs.get("fusion_nade", 128),
                dim_gie=kwargs.get("fusion_gie", 256),
                dim_bne=kwargs.get("fusion_bne", 256),
            )
        else:
            if use_mamba:
                logger.warning(
                    "Mamba requested but mamba-ssm not available. Using standard Fusion."
                )
            fusion = KimiDeltaAttention()

        # Move to device
        nade = nade.to(device)
        gie = gie.to(device)
        bne = bne.to(device)
        fusion = fusion.to(device)

        # Create manager
        manager = CognitiveLoopManager(nade, gie, bne, fusion, device=device)

        return manager

    @staticmethod
    def create_standard(device: str = "cpu", **kwargs) -> CognitiveLoopManager:
        """
        Create Nexus Mind with standard (non-SNN, non-Mamba) implementations.

        Args:
            device: Device to run on
            **kwargs: Additional arguments

        Returns:
            CognitiveLoopManager instance
        """
        return NexusMindFactory.create_advanced(
            use_snn=False, use_mamba=False, device=device, **kwargs
        )

    @staticmethod
    def get_capabilities() -> Dict[str, bool]:
        """
        Get available capabilities.

        Returns:
            Dictionary with capability status
        """
        return {
            "snn": SNNTORCH_AVAILABLE,
            "mamba_gie": GIE_MAMBA_AVAILABLE,
            "mamba_fusion": FUSION_MAMBA_AVAILABLE,
            "advanced": ADVANCED_AVAILABLE,
        }

    @staticmethod
    def check_requirements() -> Dict[str, Any]:
        """
        Check system requirements for advanced features.

        Returns:
            Dictionary with requirement checks
        """
        import platform

        result = {
            "snn": {
                "available": SNNTORCH_AVAILABLE,
                "package": "snntorch",
                "install": "pip install snntorch",
            },
            "mamba": {
                "available": GIE_MAMBA_AVAILABLE and FUSION_MAMBA_AVAILABLE,
                "package": "mamba-ssm",
                "install": "pip install causal-conv1d mamba-ssm",
                "requirements": {
                    "linux": platform.system() == "Linux",
                    "cuda": torch.cuda.is_available(),
                },
            },
        }

        return result


def create_nexus_mind(
    use_snn: bool = True, use_mamba: bool = True, device: str = "cpu", **kwargs
) -> CognitiveLoopManager:
    """
    Convenience function to create Nexus Mind.

    Usage:
        # With SNN and Mamba (if available)
        manager = create_nexus_mind(use_snn=True, use_mamba=True)

        # Standard (fallback)
        manager = create_nexus_mind(use_snn=False, use_mamba=False)

        # Check capabilities first
        capabilities = NexusMindFactory.get_capabilities()
        print(capabilities)
    """
    return NexusMindFactory.create_advanced(
        use_snn=use_snn, use_mamba=use_mamba, device=device, **kwargs
    )


__all__ = [
    "NexusMindFactory",
    "create_nexus_mind",
    "NADESNNFactory",
    "GIEHybridMambaFactory",
    "KimiFusionFactory",
    "get_capabilities",
    "get_capabilities",
    "ADVANCED_AVAILABLE",
]


def get_capabilities() -> Dict[str, bool]:
    """Get available capabilities."""
    return NexusMindFactory.get_capabilities()
