"""
Nexus Mind Phase 3 - PRINCE Federated Learning

PRINCE (Price-Incentive Mechanism) for Multi-Tenant Split Federated Learning
Based on arXiv:2503.04971

This module provides:
- Device Registry: Track edge devices for SFL participation
- Tenant Registry: Register SFL tenants with model requirements
- Split Manager: Determine optimal split points for different model types
- Bias-Resilient Aggregator: Eliminate model biases from device participation
- Convergence Calculator: Derive rigorous convergence bounds
- SFL Coordinator: Orchestrate multi-tenant SFL rounds
- Stackelberg Solver: Game-theoretic incentive optimization
- Incentive Manager: Manage price incentives across tenants
"""

__all__ = [
    "DeviceRegistry",
    "EdgeDevice",
    "TenantRegistry",
    "SFLTenant",
    "ModelType",
    "SplitManager",
    "BiasResilientAggregator",
    "ConvergenceBoundCalculator",
    "SFLCoordinator",
    "StackelbergEquilibriumSolver",
    "IncentiveManager",
]
