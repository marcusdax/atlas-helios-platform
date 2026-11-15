"""
Monitoring and Observability

Provides metrics collection and health checking.
"""

import time
import psutil
from collections import deque
from typing import Dict, Any, Optional, List
import logging

logger = logging.getLogger(__name__)


class MetricsCollector:
    """
    Collects and tracks system and inference metrics.
    """

    def __init__(self, window_size: int = 100):
        """
        Initialize Metrics Collector.

        Args:
            window_size: Size of sliding window for metrics
        """
        self.window_size = window_size
        self.latencies = deque(maxlen=window_size)
        self.errors = 0
        self.requests = 0
        self.start_time = time.time()

        logger.info(f"MetricsCollector initialized with window_size={window_size}")

    def record_inference(self, latency_ms: float):
        """
        Record an inference result.

        Args:
            latency_ms: Latency in milliseconds
        """
        self.latencies.append(latency_ms)
        self.requests += 1

    def record_error(self):
        """Record an error."""
        self.errors += 1

    def get_stats(self) -> Dict[str, Any]:
        """
        Get current statistics.

        Returns:
            Dictionary with metrics
        """
        latency_list = list(self.latencies)

        if not latency_list:
            return {
                "mean_latency": 0,
                "p50_latency": 0,
                "p95_latency": 0,
                "p99_latency": 0,
                "max_latency": 0,
                "requests": self.requests,
                "errors": self.errors,
                "error_rate": 0,
                "uptime_seconds": time.time() - self.start_time,
            }

        sorted_latencies = sorted(latency_list)
        n = len(sorted_latencies)

        return {
            "mean_latency": sum(latency_list) / n,
            "p50_latency": sorted_latencies[int(0.50 * n)],
            "p95_latency": sorted_latencies[int(0.95 * n)]
            if n >= 20
            else sorted_latencies[-1],
            "p99_latency": sorted_latencies[int(0.99 * n)]
            if n >= 100
            else sorted_latencies[-1],
            "max_latency": max(latency_list),
            "requests": self.requests,
            "errors": self.errors,
            "error_rate": self.errors / self.requests if self.requests > 0 else 0,
            "uptime_seconds": time.time() - self.start_time,
            "requests_per_second": self.requests / (time.time() - self.start_time),
        }

    def get_system_metrics(self) -> Dict[str, Any]:
        """
        Get system-level metrics.

        Returns:
            Dictionary with system metrics
        """
        return {
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "memory_used_mb": psutil.virtual_memory().used / 1024 / 1024,
            "disk_percent": psutil.disk_usage("/").percent
            if hasattr(psutil.disk_usage("/"), "percent")
            else 0,
        }

    def reset(self):
        """Reset all metrics."""
        self.latencies.clear()
        self.errors = 0
        self.requests = 0
        self.start_time = time.time()
        logger.info("Metrics reset")


class HealthChecker:
    """
    Checks health of system components.
    """

    def __init__(self):
        self.component_status = {}
        logger.info("HealthChecker initialized")

    def check_component(
        self, name: str, module: Any, test_input_shape: tuple = (1, 64)
    ) -> Dict[str, Any]:
        """
        Check health of a component.

        Args:
            name: Component name
            module: Module to test
            test_input_shape: Shape of test input

        Returns:
            Health status dictionary
        """
        try:
            import torch

            # Determine input type based on component
            if "gie" in name.lower():
                test_input = torch.randn(1, 3, 224, 224)
            else:
                test_input = torch.randn(*test_input_shape)

            # Forward pass
            module.eval()
            with torch.no_grad():
                _ = module(test_input)

            status = "healthy"
            latency_ms = 0.0

        except Exception as e:
            status = "degraded"
            latency_ms = 0.0
            logger.error(f"Health check failed for {name}: {e}")

        self.component_status[name] = {
            "status": status,
            "latency_ms": latency_ms,
            "timestamp": time.time(),
        }

        return self.component_status[name]

    def get_overall_health(self) -> Dict[str, Any]:
        """
        Get overall system health.

        Returns:
            Overall health status
        """
        if not self.component_status:
            return {"status": "unknown", "components": {}}

        statuses = [c["status"] for c in self.component_status.values()]

        if all(s == "healthy" for s in statuses):
            overall = "healthy"
        elif any(s == "degraded" for s in statuses):
            overall = "degraded"
        else:
            overall = "unhealthy"

        return {"status": overall, "components": self.component_status}

    def check_resources(self) -> Dict[str, Any]:
        """
        Check system resource availability.

        Returns:
            Resource status
        """
        cpu_percent = psutil.cpu_percent()
        memory_percent = psutil.virtual_memory().percent

        status = "healthy"
        if cpu_percent > 90 or memory_percent > 90:
            status = "critical"
        elif cpu_percent > 70 or memory_percent > 70:
            status = "warning"

        return {
            "status": status,
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent,
        }


class NexusMonitor:
    """
    Aggregated monitoring dashboard.
    """

    def __init__(self):
        self.metrics = MetricsCollector()
        self.health = HealthChecker()
        logger.info("NexusMonitor initialized")

    def get_full_status(self) -> Dict[str, Any]:
        """
        Get full system status.

        Returns:
            Complete status dictionary
        """
        return {
            "metrics": self.metrics.get_stats(),
            "system": self.metrics.get_system_metrics(),
            "health": self.health.get_overall_health(),
            "resources": self.health.check_resources(),
        }
