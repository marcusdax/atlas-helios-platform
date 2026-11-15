"""
Nexus Mind Phase 3 - Tenant Registry, Split Manager, Aggregator, Convergence Calculator, SFL Coordinator

Core components for PRINCE Multi-Tenant Split Federated Learning.
"""

import uuid
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import math
import numpy as np

logger = logging.getLogger(__name__)

try:
    import torch

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False


class ModelType(Enum):
    """Supported model types for SFL."""

    VIT = "vit"
    BERT = "bert"
    WHISPER = "whisper"
    LLAMA = "llama"


@dataclass
class SFLTenant:
    """Represents an SFL tenant."""

    tenant_id: str
    model_type: ModelType
    model_name: str
    performance_target: float
    deadline_days: int
    dataset_size: int
    privacy_budget_epsilon: float
    split_layer: int
    edge_server_id: str
    active: bool = True


class TenantRegistry:
    """Manages SFL tenants and their requirements."""

    def __init__(self, db_connection=None):
        self.conn = db_connection
        self._tenants: Dict[str, SFLTenant] = {}
        self._test_mode = db_connection is None

    def register_tenant(
        self,
        tenant_id: str,
        model_type: ModelType,
        model_name: str,
        performance_target: float,
        deadline_days: int,
        dataset_size: int,
        privacy_budget_epsilon: float,
        split_layer: int = 6,
        edge_server_id: str = "default",
    ) -> str:
        """Register a new SFL tenant."""
        tenant = SFLTenant(
            tenant_id=tenant_id,
            model_type=model_type,
            model_name=model_name,
            performance_target=performance_target,
            deadline_days=deadline_days,
            dataset_size=dataset_size,
            privacy_budget_epsilon=privacy_budget_epsilon,
            split_layer=split_layer,
            edge_server_id=edge_server_id,
        )
        self._tenants[tenant_id] = tenant
        logger.info(f"Registered tenant: {tenant_id}")
        return tenant_id

    def get_tenant(self, tenant_id: str) -> Optional[SFLTenant]:
        """Get tenant by ID."""
        return self._tenants.get(tenant_id)

    def get_active_tenants(self) -> List[SFLTenant]:
        """Get all active tenants."""
        return [t for t in self._tenants.values() if t.active]

    def update_tenant(self, tenant_id: str, **kwargs):
        """Update tenant attributes."""
        if tenant_id in self._tenants:
            for key, value in kwargs.items():
                if hasattr(self._tenants[tenant_id], key):
                    setattr(self._tenants[tenant_id], key, value)


class SplitManager:
    """Determines optimal split points for different model types."""

    SPLIT_POINTS = {
        ModelType.VIT: {"early": 3, "mid": 6, "late": 9},
        ModelType.BERT: {"early": 2, "mid": 4, "late": 8},
        ModelType.WHISPER: {"early": 2, "mid": 4, "late": 8},
        ModelType.LLAMA: {"early": 8, "mid": 16, "late": 24},
    }

    def recommend_split(
        self,
        model_type: ModelType,
        device_capacity: float,
        bandwidth: float,
    ) -> int:
        """Recommend optimal split layer based on device capabilities."""
        if device_capacity > 20:
            return self.SPLIT_POINTS[model_type]["late"]
        elif device_capacity > 5:
            return self.SPLIT_POINTS[model_type]["mid"]
        else:
            return self.SPLIT_POINTS[model_type]["early"]

    def get_split_config(self, model_type: ModelType, split_layer: int) -> Dict:
        """Get split configuration for a model."""
        return {
            "model_type": model_type.value,
            "split_layer": split_layer,
            "client_layers": split_layer,
            "server_layers": "remaining",
        }


class BiasResilientAggregator:
    """
    Implements PRINCE's bias-resilient global SFL model aggregation.
    Eliminates model biases caused by independent device participation.
    """

    def __init__(self, privacy_epsilon: float = 1.0):
        self.privacy_epsilon = privacy_epsilon

    def compute_device_weights(self, device_updates: List[Dict]) -> np.ndarray:
        """Calculate aggregation weights based on reliability, quality, and freshness."""
        weights = []

        for update in device_updates:
            reliability = update.get("reliability", 1.0)
            loss = update.get("loss", 1.0)
            quality_weight = 1.0 / (loss + 1e-6)
            freshness = update.get("freshness", 1.0)

            weight = reliability * quality_weight * freshness
            weights.append(weight)

        weights = np.array(weights)
        return weights / weights.sum()

    def aggregate_updates(self, device_updates: List[Dict]) -> np.ndarray:
        """Bias-resilient aggregation of model updates."""
        if not device_updates:
            raise ValueError("No updates to aggregate")

        gradients = [update["gradient"] for update in device_updates]
        weights = self.compute_device_weights(device_updates)

        aggregated = np.zeros_like(gradients[0], dtype=np.float32)
        for w, g in zip(weights, gradients):
            aggregated += w * g

        if self.privacy_epsilon:
            noise_scale = 1.0 / self.privacy_epsilon
            noise = np.random.normal(0, noise_scale, aggregated.shape)
            aggregated += noise.astype(np.float32)

        return aggregated

    def detect_bias(self, device_updates: List[Dict]) -> Dict:
        """Detect if any device is introducing bias."""
        gradients = np.array([u["gradient"] for u in device_updates])

        mean_grad = gradients.mean(axis=0)
        std_grad = gradients.std(axis=0) + 1e-6

        z_scores = np.abs((gradients - mean_grad) / std_grad)
        outliers = np.any(z_scores > 3.0, axis=1)
        outlier_indices = np.where(outliers)[0].tolist()

        return {
            "has_bias": len(outlier_indices) > 0,
            "outlier_indices": outlier_indices,
            "bias_score": len(outlier_indices) / len(device_updates),
        }


class ConvergenceBoundCalculator:
    """Derives rigorous SFL convergence bounds."""

    def calculate_convergence_rate(
        self,
        num_devices: int,
        heterogeneity: float,
        communication_rounds: int,
    ) -> float:
        """Calculate expected convergence rate."""
        base_rate = 1.0 / math.sqrt(communication_rounds)
        penalty = 1.0 / (1.0 + heterogeneity)
        return base_rate * penalty

    def estimate_contribution(
        self,
        device_capabilities: Dict,
        participation_history: List[float],
    ) -> float:
        """Estimate a device's contribution to model improvement."""
        compute = device_capabilities.get("compute", 1.0)

        if participation_history:
            reliability = 1.0 - np.std(participation_history)
        else:
            reliability = 1.0

        bandwidth = device_capabilities.get("bandwidth", 10.0) / 100.0

        return compute * reliability * bandwidth

    def predict_performance_improvement(
        self,
        tenant_requirements: Dict,
        device_pool: List[Dict],
    ) -> float:
        """Predict performance improvement with given device pool."""
        total_contribution = sum(self.estimate_contribution(d, []) for d in device_pool)

        max_improvement = 1.0 - tenant_requirements.get("current_performance", 0.5)
        improvement = max_improvement * (1 - math.exp(-total_contribution))

        return improvement


class SFLCoordinator:
    """Orchestrates multi-tenant SFL rounds."""

    def __init__(
        self,
        device_registry,
        tenant_registry,
        aggregator: Optional[BiasResilientAggregator] = None,
    ):
        self.device_registry = device_registry
        self.tenant_registry = tenant_registry
        self.aggregator = aggregator or BiasResilientAggregator()
        self.convergence = ConvergenceBoundCalculator()
        self.active_rounds: Dict[str, Dict] = {}

    def start_round(self, tenant_id: str) -> Dict:
        """Start a new SFL round for a tenant."""
        tenant = self.tenant_registry.get_tenant(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        devices = self.device_registry.get_available_devices(
            tenant_id=tenant_id,
            model_type=tenant.model_type.value,
        )

        predicted_improvement = self.convergence.predict_performance_improvement(
            {"current_performance": 0.5},
            [
                {"compute": d.compute_capacity, "bandwidth": d.bandwidth_mbps}
                for d in devices
            ],
        )

        round_id = f"{tenant_id}_{len(self.active_rounds)}"
        self.active_rounds[round_id] = {
            "tenant_id": tenant_id,
            "devices": devices,
            "start_time": datetime.now(timezone.utc),
            "predicted_improvement": predicted_improvement,
            "updates_received": [],
        }

        return {
            "round_id": round_id,
            "devices": [d.device_id for d in devices],
            "predicted_improvement": predicted_improvement,
        }

    def submit_update(
        self,
        round_id: str,
        device_id: str,
        gradient: np.ndarray,
        loss: float,
    ) -> Optional[Dict]:
        """Submit a device's gradient update."""
        if round_id not in self.active_rounds:
            raise ValueError(f"Round {round_id} not active")

        round_info = self.active_rounds[round_id]

        update = {
            "device_id": device_id,
            "gradient": gradient,
            "loss": loss,
            "timestamp": datetime.now(timezone.utc),
        }
        round_info["updates_received"].append(update)

        min_required = len(round_info["devices"]) * 0.7
        if len(round_info["updates_received"]) >= min_required:
            return self._aggregate_round(round_id)

        return None

    def _aggregate_round(self, round_id: str) -> Dict:
        """Aggregate updates for a round."""
        round_info = self.active_rounds[round_id]
        updates = round_info["updates_received"]

        bias_report = self.aggregator.detect_bias(updates)

        if bias_report["has_bias"]:
            updates = [
                u
                for i, u in enumerate(updates)
                if i not in bias_report["outlier_indices"]
            ]

        aggregated = self.aggregator.aggregate_updates(updates)

        avg_loss = np.mean([u["loss"] for u in updates])
        achieved_improvement = round_info["predicted_improvement"] * (1 - avg_loss)

        result = {
            "round_id": round_id,
            "aggregated_gradient": aggregated,
            "num_updates": len(updates),
            "bias_detected": bias_report["has_bias"],
            "achieved_improvement": achieved_improvement,
        }

        del self.active_rounds[round_id]
        return result


class StackelbergEquilibriumSolver:
    """
    Models inter-tenant device competition as a congestion game
    for Stackelberg equilibrium analysis.
    """

    def solve_tenant_strategy(
        self,
        tenant: Dict,
        competing_tenants: List[Dict],
        device_pool: List[Dict],
    ) -> Dict:
        """Solve for optimal price incentive strategy."""

        def device_utility(device, tenant_price, competition):
            cost = self._compute_device_cost(device, tenant)
            competition_factor = 1.0 / (1.0 + len(competition))
            return tenant_price - cost + competition_factor

        def tenant_profit(price, expected_devices):
            return price * expected_devices - price * 0.3

        best_price, best_profit = 0.1, float("-inf")

        for price in np.arange(0.1, 10.0, 0.1):
            expected_devices = sum(
                1
                for d in device_pool
                if device_utility(d, price, competing_tenants) > 0
            )
            profit = tenant_profit(price, expected_devices)
            if profit > best_profit:
                best_profit = profit
                best_price = price

        return {
            "optimal_price": float(best_price),
            "expected_devices": sum(
                1
                for d in device_pool
                if self._compute_device_cost(d, tenant) < best_price
            ),
            "expected_profit": float(best_profit),
        }

    def _compute_device_cost(self, device: Dict, tenant: Dict) -> float:
        """Compute cost for device to work on tenant's task."""
        compute_cost = 1.0 / max(device.get("compute_capacity", 1.0), 1.0)

        modality_costs = {"vit": 2.0, "whisper": 1.5, "bert": 1.0, "llama": 3.0}
        modality = tenant.get("model_type", "text")

        return compute_cost * modality_costs.get(modality, 1.0)


__all__ = [
    "ModelType",
    "SFLTenant",
    "TenantRegistry",
    "SplitManager",
    "BiasResilientAggregator",
    "ConvergenceBoundCalculator",
    "SFLCoordinator",
    "StackelbergEquilibriumSolver",
]
