"""
Nexus Mind Phase 3 - Incentive Manager

Price optimization and incentive mechanism management for PRINCE SFL.
"""

import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timezone
import numpy as np

from .core import StackelbergEquilibriumSolver
from .device_registry import DeviceRegistry
from .core import TenantRegistry

logger = logging.getLogger(__name__)


@dataclass
class IncentivePricing:
    """Pricing model for device participation."""

    base_price: float
    quality_bonus: float
    reliability_bonus: float
    freshness_bonus: float
    total: float


class IncentiveManager:
    """
    Manages pricing and incentives for SFL device participation.

    Implements Stackelberg game-theoretic pricing to maximize
    tenant ROI while ensuring fair device compensation.
    """

    def __init__(
        self,
        device_registry: DeviceRegistry,
        tenant_registry: TenantRegistry,
    ):
        self.device_registry = device_registry
        self.tenant_registry = tenant_registry
        self.stackelberg = StackelbergEquilibriumSolver()
        self._price_history: Dict[str, List[float]] = {}

    def compute_optimal_price(
        self,
        tenant_id: str,
        device_pool: List[Dict],
    ) -> Dict[str, Any]:
        """
        Compute optimal price for tenant using Stackelberg equilibrium.

        Args:
            tenant_id: Tenant requesting pricing
            device_pool: Available devices to bid for

        Returns:
            Pricing decision with optimal price and expected ROI
        """
        tenant = self.tenant_registry.get_tenant(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant {tenant_id} not found")

        competing_tenants = [
            {"model_type": t.model_type.value}
            for t in self.tenant_registry.get_active_tenants()
            if t.tenant_id != tenant_id
        ]

        strategy = self.stackelberg.solve_tenant_strategy(
            tenant={"model_type": tenant.model_type.value},
            competing_tenants=competing_tenants,
            device_pool=device_pool,
        )

        self._price_history.setdefault(tenant_id, []).append(strategy["optimal_price"])

        roi = self._calculate_roi(
            strategy["optimal_price"],
            strategy["expected_devices"],
            tenant.performance_target,
        )

        return {
            "tenant_id": tenant_id,
            "optimal_price": strategy["optimal_price"],
            "expected_devices": strategy["expected_devices"],
            "expected_profit": strategy["expected_profit"],
            "roi": roi,
            "confidence": self._compute_confidence(tenant_id),
        }

    def compute_device_incentive(
        self,
        device_id: str,
        tenant_id: str,
        quality_score: float,
    ) -> IncentivePricing:
        """
        Compute incentive payment for a device.

        Args:
            device_id: Device being compensated
            tenant_id: Tenant receiving the work
            quality_score: Measured quality of device's contribution

        Returns:
            Detailed pricing breakdown
        """
        device = self.device_registry.get_device(device_id)
        if not device:
            raise ValueError(f"Device {device_id} not found")

        base_price = 0.5

        quality_bonus = quality_score * 0.3

        reliability_bonus = device.reliability_score * 0.2

        time_since_seen = (datetime.now(timezone.utc) - device.last_seen).total_seconds()
        freshness_bonus = max(0, 0.1 - time_since_seen / 36000)

        total = base_price + quality_bonus + reliability_bonus + freshness_bonus

        return IncentivePricing(
            base_price=base_price,
            quality_bonus=quality_bonus,
            reliability_bonus=reliability_bonus,
            freshness_bonus=freshness_bonus,
            total=total,
        )

    def adjust_price_dynamic(
        self,
        tenant_id: str,
        participation_rate: float,
        convergence_rate: float,
    ) -> float:
        """
        Dynamically adjust price based on real-time metrics.

        Args:
            tenant_id: Tenant to adjust
            participation_rate: Current device participation (0-1)
            convergence_rate: Model convergence rate

        Returns:
            Adjusted price
        """
        if tenant_id not in self._price_history:
            return 1.0

        history = self._price_history[tenant_id]
        base_price = history[-1] if history else 1.0

        if participation_rate < 0.5:
            adjustment = 0.8
        elif participation_rate > 0.9:
            adjustment = 1.2
        else:
            adjustment = 1.0

        if convergence_rate > 0.8:
            adjustment *= 1.1
        elif convergence_rate < 0.3:
            adjustment *= 0.9

        new_price = base_price * adjustment
        self._price_history[tenant_id].append(new_price)

        return new_price

    def get_market_stats(self) -> Dict[str, Any]:
        """Get aggregate market statistics."""
        all_devices = self.device_registry.get_device_stats()

        avg_price = 0.0
        if self._price_history:
            all_prices = [p for prices in self._price_history.values() for p in prices]
            avg_price = np.mean(all_prices) if all_prices else 0.0

        return {
            "total_devices": all_devices["total_devices"],
            "active_devices": all_devices["active_devices"],
            "average_price": avg_price,
            "tenant_count": len(self._tenant_registry.get_active_tenants())
            if hasattr(self, "_tenant_registry")
            else 0,
        }

    def _calculate_roi(
        self,
        price: float,
        expected_devices: int,
        performance_target: float,
    ) -> float:
        """Calculate expected ROI for tenant."""
        if expected_devices == 0:
            return 0.0

        # Scale normalized accuracy/performance target (0-1) to value points (0-100)
        value_scale = 100.0 if performance_target <= 1.0 else 1.0
        expected_value = performance_target * value_scale * expected_devices
        cost = price * expected_devices

        return (expected_value - cost) / max(cost, 0.01)

    def _compute_confidence(self, tenant_id: str) -> float:
        """Compute confidence in price prediction based on history."""
        if tenant_id not in self._price_history:
            return 0.5

        history = self._price_history[tenant_id]
        if len(history) < 3:
            return 0.5

        variance = np.std(history[-5:]) / np.mean(history[-5:])
        confidence = max(0.1, 1.0 - variance)

        return confidence


__all__ = ["IncentiveManager", "IncentivePricing"]
