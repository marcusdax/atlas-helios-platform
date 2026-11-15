"""
Nexus Mind Core AI - A unified cognitive architecture for multi-modal intelligence.

This package provides the core cognitive engines:
- NADE: Neuromorphic Anomaly Detection Engine
- GIE: Geospatial Intelligence Engine
- BNE: Behavioral Neurolinguistics Engine
- KimiDeltaAttention: Cross-modal fusion engine
"""

__version__ = "5.0.0"
__author__ = "WTP Collective Nexus"

from nexus_mind.core.nade import NADEEngine
from nexus_mind.core.gie import GIEEngine
from nexus_mind.core.bne import BNEEngine
from nexus_mind.core.fusion import KimiDeltaAttention
from nexus_mind.cognitive.manager import CognitiveLoopManager

__all__ = [
    "NADEEngine",
    "GIEEngine",
    "BNEEngine",
    "KimiDeltaAttention",
    "CognitiveLoopManager",
]
