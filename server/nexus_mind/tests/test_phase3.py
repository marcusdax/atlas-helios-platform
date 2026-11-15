"""
Nexus Mind Phase 3 - Tests

Tests for PRINCE Federated Learning components.
"""

import unittest
import numpy as np
from datetime import datetime

from nexus_mind.learning.device_registry import DeviceRegistry, EdgeDevice, ModelType
from nexus_mind.learning.core import (
    TenantRegistry,
    ModelType as CoreModelType,
    SFLTenant,
    SplitManager,
    BiasResilientAggregator,
    ConvergenceBoundCalculator,
    SFLCoordinator,
    StackelbergEquilibriumSolver,
)
from nexus_mind.learning.incentive_manager import IncentiveManager, IncentivePricing
from nexus_mind.tenants import (
    ViTTenant,
    BERTTenant,
    WhisperTenant,
    LLAMATenant,
)


class TestDeviceRegistry(unittest.TestCase):
    """Test device registry functionality."""

    def setUp(self):
        self.registry = DeviceRegistry()

    def test_register_device(self):
        device = EdgeDevice(
            device_id="dev001",
            compute_capacity=10.0,
            memory_gb=16.0,
            bandwidth_mbps=100.0,
            supported_models=["vit", "bert"],
        )
        device_id = self.registry.register_device(device)
        self.assertEqual(device_id, "dev001")

    def test_get_available_devices(self):
        device = EdgeDevice(
            device_id="dev001",
            compute_capacity=10.0,
            memory_gb=16.0,
            bandwidth_mbps=100.0,
            supported_models=["vit"],
        )
        self.registry.register_device(device)
        available = self.registry.get_available_devices(model_type="vit")
        self.assertEqual(len(available), 1)


class TestTenantRegistry(unittest.TestCase):
    """Test tenant registry functionality."""

    def setUp(self):
        self.registry = TenantRegistry()

    def test_register_tenant(self):
        tenant_id = self.registry.register_tenant(
            tenant_id="tenant001",
            model_type=CoreModelType.VIT,
            model_name="vit-base",
            performance_target=0.9,
            deadline_days=7,
            dataset_size=10000,
            privacy_budget_epsilon=1.0,
        )
        self.assertEqual(tenant_id, "tenant001")

    def test_get_active_tenants(self):
        self.registry.register_tenant(
            tenant_id="tenant001",
            model_type=CoreModelType.VIT,
            model_name="vit-base",
            performance_target=0.9,
            deadline_days=7,
            dataset_size=10000,
            privacy_budget_epsilon=1.0,
        )
        active = self.registry.get_active_tenants()
        self.assertEqual(len(active), 1)


class TestSplitManager(unittest.TestCase):
    """Test split point recommendation."""

    def setUp(self):
        self.manager = SplitManager()

    def test_recommend_split(self):
        split = self.manager.recommend_split(
            CoreModelType.VIT, device_capacity=10.0, bandwidth=100.0
        )
        self.assertIn(split, [3, 6, 9])


class TestBiasResilientAggregator(unittest.TestCase):
    """Test bias-resilient aggregation."""

    def setUp(self):
        self.aggregator = BiasResilientAggregator(privacy_epsilon=1.0)

    def test_aggregate_updates(self):
        updates = [
            {
                "gradient": np.random.randn(10).astype(np.float32),
                "loss": 0.5,
                "reliability": 1.0,
                "freshness": 1.0,
            }
            for _ in range(3)
        ]
        result = self.aggregator.aggregate_updates(updates)
        self.assertEqual(result.shape, (10,))

    def test_detect_bias(self):
        updates = [
            {
                "gradient": np.random.randn(10).astype(np.float32),
                "loss": 0.5,
                "reliability": 1.0,
                "freshness": 1.0,
            }
            for _ in range(5)
        ]
        updates[0]["gradient"] = updates[0]["gradient"] * 10
        bias_report = self.aggregator.detect_bias(updates)
        self.assertIn("has_bias", bias_report)


class TestConvergenceBoundCalculator(unittest.TestCase):
    """Test convergence calculations."""

    def setUp(self):
        self.calc = ConvergenceBoundCalculator()

    def test_calculate_convergence_rate(self):
        rate = self.calc.calculate_convergence_rate(
            num_devices=10, heterogeneity=0.5, communication_rounds=100
        )
        self.assertGreater(rate, 0)

    def test_estimate_contribution(self):
        contribution = self.calc.estimate_contribution(
            device_capabilities={"compute": 10.0, "bandwidth": 100.0},
            participation_history=[1.0, 0.9, 1.0],
        )
        self.assertGreater(contribution, 0)


class TestStackelbergSolver(unittest.TestCase):
    """Test Stackelberg equilibrium solver."""

    def setUp(self):
        self.solver = StackelbergEquilibriumSolver()

    def test_solve_tenant_strategy(self):
        result = self.solver.solve_tenant_strategy(
            tenant={"model_type": "vit"},
            competing_tenants=[{"model_type": "bert"}],
            device_pool=[
                {"compute_capacity": 10.0, "bandwidth": 100.0},
                {"compute_capacity": 5.0, "bandwidth": 50.0},
            ],
        )
        self.assertIn("optimal_price", result)
        self.assertGreater(result["expected_devices"], 0)


class TestIncentiveManager(unittest.TestCase):
    """Test incentive management."""

    def setUp(self):
        self.device_registry = DeviceRegistry()
        self.tenant_registry = TenantRegistry()
        self.tenant_registry.register_tenant(
            tenant_id="tenant001",
            model_type=CoreModelType.VIT,
            model_name="vit-base",
            performance_target=0.9,
            deadline_days=7,
            dataset_size=10000,
            privacy_budget_epsilon=1.0,
        )
        self.manager = IncentiveManager(self.device_registry, self.tenant_registry)

    def test_compute_optimal_price(self):
        device_pool = [
            {"compute_capacity": 10.0, "bandwidth": 100.0},
            {"compute_capacity": 5.0, "bandwidth": 50.0},
        ]
        result = self.manager.compute_optimal_price("tenant001", device_pool)
        self.assertIn("optimal_price", result)
        self.assertGreater(result["roi"], 0)

    def test_compute_device_incentive(self):
        device = EdgeDevice(
            device_id="dev001",
            compute_capacity=10.0,
            memory_gb=16.0,
            bandwidth_mbps=100.0,
            supported_models=["vit"],
            reliability_score=0.9,
        )
        self.device_registry.register_device(device)

        pricing = self.manager.compute_device_incentive(
            device_id="dev001", tenant_id="tenant001", quality_score=0.8
        )
        self.assertIsInstance(pricing, IncentivePricing)
        self.assertGreater(pricing.total, 0)


class TestViTTenant(unittest.TestCase):
    """Test ViT tenant."""

    def setUp(self):
        self.tenant = ViTTenant("tenant-vit")

    def test_initialize(self):
        result = self.tenant.initialize()
        self.assertTrue(result)

    def test_compute_gradient(self):
        self.tenant.initialize()
        input_data = np.random.randn(1, 224, 224, 3).astype(np.float32)
        result = self.tenant.compute_gradient(input_data)
        self.assertIn("gradient", result)
        self.assertIn("loss", result)

    def test_get_model_info(self):
        info = self.tenant.get_model_info()
        self.assertEqual(info["model_type"], "vit")


class TestBERTTenant(unittest.TestCase):
    """Test BERT tenant."""

    def setUp(self):
        self.tenant = BERTTenant("tenant-bert")

    def test_initialize(self):
        result = self.tenant.initialize()
        self.assertTrue(result)

    def test_compute_gradient(self):
        self.tenant.initialize()
        input_data = np.random.randint(0, 30000, (1, 128))
        result = self.tenant.compute_gradient(input_data)
        self.assertIn("gradient", result)

    def test_get_model_info(self):
        info = self.tenant.get_model_info()
        self.assertEqual(info["model_type"], "bert")


class TestWhisperTenant(unittest.TestCase):
    """Test Whisper tenant."""

    def setUp(self):
        self.tenant = WhisperTenant("tenant-whisper")

    def test_initialize(self):
        result = self.tenant.initialize()
        self.assertTrue(result)

    def test_compute_gradient(self):
        self.tenant.initialize()
        input_data = np.random.randn(1, 80, 3000).astype(np.float32)
        result = self.tenant.compute_gradient(input_data)
        self.assertIn("gradient", result)


class TestLLAMATenant(unittest.TestCase):
    """Test LLaMA tenant."""

    def setUp(self):
        self.tenant = LLAMATenant("tenant-llama")

    def test_initialize(self):
        result = self.tenant.initialize()
        self.assertTrue(result)

    def test_compute_gradient(self):
        self.tenant.initialize()
        input_data = np.random.randint(0, 32000, (1, 512))
        result = self.tenant.compute_gradient(input_data)
        self.assertIn("gradient", result)

    def test_get_model_info(self):
        info = self.tenant.get_model_info()
        self.assertEqual(info["model_type"], "llama")


class TestSFLCoordinator(unittest.TestCase):
    """Test SFL coordinator."""

    def setUp(self):
        self.device_registry = DeviceRegistry()
        self.tenant_registry = TenantRegistry()
        self.tenant_registry.register_tenant(
            tenant_id="tenant001",
            model_type=CoreModelType.VIT,
            model_name="vit-base",
            performance_target=0.9,
            deadline_days=7,
            dataset_size=10000,
            privacy_budget_epsilon=1.0,
        )
        device = EdgeDevice(
            device_id="dev001",
            compute_capacity=10.0,
            memory_gb=16.0,
            bandwidth_mbps=100.0,
            supported_models=["vit"],
        )
        self.device_registry.register_device(device)
        self.coordinator = SFLCoordinator(self.device_registry, self.tenant_registry)

    def test_start_round(self):
        result = self.coordinator.start_round("tenant001")
        self.assertIn("round_id", result)
        self.assertIn("devices", result)


if __name__ == "__main__":
    unittest.main()
