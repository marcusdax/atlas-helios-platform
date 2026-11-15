"""
Nexus Mind Phase 3 - Device Registry

Manages edge device pool for Split Federated Learning participation.
"""

import uuid
import logging
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class ModelType(Enum):
    """Supported model types for SFL."""

    VIT = "vit"  # Vision Transformer
    BERT = "bert"  # Text
    WHISPER = "whisper"  # Audio
    LLAMA = "llama"  # Large language model


@dataclass
class EdgeDevice:
    """Represents an edge device in the SFL network."""

    device_id: str
    compute_capacity: float  # TFLOPS
    memory_gb: float
    bandwidth_mbps: float
    supported_models: List[str]
    reliability_score: float = 1.0
    last_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    location_region: str = "us-west"
    active: bool = True


class DeviceRegistry:
    """
    Manages edge device pool for SFL participation.

    Tracks device capabilities, reliability, and availability.
    """

    def __init__(self, db_connection=None):
        self.conn = db_connection
        self._devices: Dict[str, EdgeDevice] = {}
        self._test_mode = db_connection is None

    def register_device(self, device: EdgeDevice) -> str:
        """
        Register a new edge device.

        Args:
            device: EdgeDevice to register

        Returns:
            device_id of registered device
        """
        device.device_id = device.device_id or str(uuid.uuid4())[:8]
        self._devices[device.device_id] = device

        logger.info(f"Registered device: {device.device_id}")
        return device.device_id

    def get_device(self, device_id: str) -> Optional[EdgeDevice]:
        """Get device by ID."""
        return self._devices.get(device_id)

    def get_available_devices(
        self,
        tenant_id: Optional[str] = None,
        model_type: Optional[str] = None,
    ) -> List[EdgeDevice]:
        """
        Get available devices, optionally filtered.

        Args:
            tenant_id: Filter by tenant history
            model_type: Filter by supported model type

        Returns:
            List of available EdgeDevices
        """
        available = [
            d
            for d in self._devices.values()
            if d.active and (datetime.now(timezone.utc) - d.last_seen).total_seconds() < 3600
        ]

        if model_type:
            available = [d for d in available if model_type in d.supported_models]

        return sorted(available, key=lambda d: d.reliability_score, reverse=True)

    def update_device_status(self, device_id: str, active: bool = True):
        """Update device active status."""
        if device_id in self._devices:
            self._devices[device_id].active = active
            self._devices[device_id].last_seen = datetime.now(timezone.utc)

    def get_device_stats(self) -> Dict:
        """Get statistics about registered devices."""
        active = [d for d in self._devices.values() if d.active]

        return {
            "total_devices": len(self._devices),
            "active_devices": len(active),
            "avg_reliability": sum(d.reliability_score for d in active)
            / max(len(active), 1),
            "by_region": self._count_by_region(active),
            "by_model_support": self._count_by_model(active),
        }

    def _count_by_region(self, devices: List[EdgeDevice]) -> Dict[str, int]:
        """Count devices by region."""
        counts = {}
        for d in devices:
            counts[d.location_region] = counts.get(d.location_region, 0) + 1
        return counts

    def _count_by_model(self, devices: List[EdgeDevice]) -> Dict[str, int]:
        """Count devices by supported model."""
        counts = {}
        for d in devices:
            for model in d.supported_models:
                counts[model] = counts.get(model, 0) + 1
        return counts


__all__ = ["DeviceRegistry", "EdgeDevice", "ModelType"]
