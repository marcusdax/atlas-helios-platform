#!/usr/bin/env python3
"""
ATLAS-HELIOS Integration Manager
Manages all external service integrations and provides unified API
"""

import os
import sys
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass, asdict
import threading
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("atlas-integration.log"), logging.StreamHandler()],
)
logger = logging.getLogger("atlas-integration")


@dataclass
class IntegrationStatus:
    """Status of an external integration"""

    name: str
    enabled: bool
    connected: bool
    last_check: str
    latency_ms: float
    error_count: int
    last_error: Optional[str] = None


class AtlasIntegrationManager:
    """
    Central manager for all ATLAS-HELIOS external integrations
    """

    def __init__(self):
        self.integrations: Dict[str, IntegrationStatus] = {}
        self.hooks = {}
        self.monitoring = True
        self.monitor_thread = None

        # Initialize all integrations
        self._init_integrations()

    def _init_integrations(self):
        """Initialize all external service integrations"""

        # NOAA Weather API
        self.integrations["noaa_weather"] = IntegrationStatus(
            name="NOAA Weather API",
            enabled=True,
            connected=False,
            last_check="",
            latency_ms=0.0,
            error_count=0,
        )

        # Storm Intelligence Service
        self.integrations["storm_intelligence"] = IntegrationStatus(
            name="Storm Intelligence Service",
            enabled=True,
            connected=False,
            last_check="",
            latency_ms=0.0,
            error_count=0,
        )

        # Computer Vision Service
        self.integrations["computer_vision"] = IntegrationStatus(
            name="Computer Vision Service",
            enabled=True,
            connected=False,
            last_check="",
            latency_ms=0.0,
            error_count=0,
        )

        # Nexus Mind AI
        self.integrations["nexus_mind"] = IntegrationStatus(
            name="Nexus Mind AI",
            enabled=True,
            connected=False,
            last_check="",
            latency_ms=0.0,
            error_count=0,
        )

        # Perception Encoder
        self.integrations["perception_encoder"] = IntegrationStatus(
            name="Perception Encoder",
            enabled=True,
            connected=False,
            last_check="",
            latency_ms=0.0,
            error_count=0,
        )

        # Sentinel Imagery
        self.integrations["sentinel_imagery"] = IntegrationStatus(
            name="Sentinel Satellite Imagery",
            enabled=True,
            connected=False,
            last_check="",
            latency_ms=0.0,
            error_count=0,
        )

        logger.info(f"Initialized {len(self.integrations)} integrations")

    def check_integration(self, name: str) -> bool:
        """Check if an integration is healthy"""
        if name not in self.integrations:
            return False

        integration = self.integrations[name]
        start_time = time.time()

        try:
            # Simulate health check (replace with actual checks)
            if name == "noaa_weather":
                # Check NOAA API
                connected = self._check_noaa_health()
            elif name == "nexus_mind":
                # Check Nexus Mind
                connected = self._check_nexus_health()
            elif name == "sentinel_imagery":
                # Check Sentinel
                connected = self._check_sentinel_health()
            else:
                # Generic check
                connected = True

            latency = (time.time() - start_time) * 1000

            integration.connected = connected
            integration.latency_ms = latency
            integration.last_check = datetime.now().isoformat()

            if not connected:
                integration.error_count += 1

            return connected

        except Exception as e:
            integration.connected = False
            integration.error_count += 1
            integration.last_error = str(e)
            integration.last_check = datetime.now().isoformat()
            logger.error(f"Health check failed for {name}: {e}")
            return False

    def _check_noaa_health(self) -> bool:
        """Check NOAA Weather API health"""
        try:
            import requests

            response = requests.get(
                "https://api.weather.gov/alerts/active?status=actual&limit=1",
                headers={"User-Agent": "ATLAS-HELIOS/2.0"},
                timeout=5,
            )
            return response.status_code == 200
        except:
            return False

    def _check_nexus_health(self) -> bool:
        """Check Nexus Mind AI health"""
        try:
            import requests
            import os

            port = os.getenv("PORT", os.getenv("BACKEND_PORT", "3001"))
            for p in [port, "3001", "3004"]:
                try:
                    response = requests.get(f"http://localhost:{p}/api/health", timeout=2)
                    if response.status_code == 200:
                        return True
                except:
                    continue
            return False
        except:
            return False

    def _check_sentinel_health(self) -> bool:
        """Check Sentinel API health"""
        try:
            import requests

            response = requests.get(
                "http://localhost:3001/api/sentinel/collections", timeout=2
            )
            return response.status_code == 200
        except:
            return False

    def check_all_integrations(self) -> Dict[str, bool]:
        """Check health of all integrations"""
        results = {}
        for name in self.integrations.keys():
            results[name] = self.check_integration(name)
        return results

    def get_integration_status(self, name: str) -> Optional[IntegrationStatus]:
        """Get status of a specific integration"""
        return self.integrations.get(name)

    def get_all_statuses(self) -> List[Dict]:
        """Get status of all integrations"""
        return [asdict(status) for status in self.integrations.values()]

    def enable_integration(self, name: str):
        """Enable an integration"""
        if name in self.integrations:
            self.integrations[name].enabled = True
            logger.info(f"Enabled integration: {name}")

    def disable_integration(self, name: str):
        """Disable an integration"""
        if name in self.integrations:
            self.integrations[name].enabled = False
            logger.info(f"Disabled integration: {name}")

    def start_monitoring(self, interval: int = 60):
        """Start continuous monitoring"""
        self.monitoring = True

        def monitor_loop():
            while self.monitoring:
                logger.info("Running integration health checks...")
                results = self.check_all_integrations()

                healthy = sum(results.values())
                total = len(results)
                logger.info(f"Integration health: {healthy}/{total} healthy")

                # Log any failures
                for name, is_healthy in results.items():
                    if not is_healthy:
                        logger.warning(f"Integration unhealthy: {name}")

                time.sleep(interval)

        self.monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        self.monitor_thread.start()
        logger.info(f"Started monitoring with {interval}s interval")

    def stop_monitoring(self):
        """Stop continuous monitoring"""
        self.monitoring = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        logger.info("Stopped monitoring")

    def export_status(self, filepath: str):
        """Export integration status to JSON"""
        data = {
            "timestamp": datetime.now().isoformat(),
            "integrations": self.get_all_statuses(),
        }

        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

        logger.info(f"Exported status to {filepath}")

    def generate_report(self) -> str:
        """Generate a text report of all integrations"""
        lines = []
        lines.append("=" * 70)
        lines.append("ATLAS-HELIOS Integration Report")
        lines.append("=" * 70)
        lines.append(f"Generated: {datetime.now().isoformat()}")
        lines.append("")

        for name, status in self.integrations.items():
            lines.append(f"{status.name}")
            lines.append(
                f"  Status: {'✓ Connected' if status.connected else '✗ Disconnected'}"
            )
            lines.append(f"  Enabled: {'Yes' if status.enabled else 'No'}")
            lines.append(f"  Latency: {status.latency_ms:.2f} ms")
            lines.append(f"  Errors: {status.error_count}")
            lines.append(f"  Last Check: {status.last_check}")
            if status.last_error:
                lines.append(f"  Last Error: {status.last_error}")
            lines.append("")

        lines.append("=" * 70)
        return "\n".join(lines)


def main():
    """Main function"""
    print("=" * 70)
    print("ATLAS-HELIOS Integration Manager")
    print("=" * 70)
    print()

    manager = AtlasIntegrationManager()

    # Check all integrations
    print("Checking all integrations...")
    results = manager.check_all_integrations()

    print("\nIntegration Status:")
    for name, is_healthy in results.items():
        status = manager.get_integration_status(name)
        print(
            f"  {status.name:30} {'✓' if is_healthy else '✗'} ({status.latency_ms:.1f}ms)"
        )

    # Generate report
    print("\n" + manager.generate_report())

    # Export to file
    manager.export_status("integration_status.json")

    # Start monitoring
    print("\nStarting continuous monitoring...")
    manager.start_monitoring(interval=30)

    print("\nPress Ctrl+C to stop")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n\nStopping...")
        manager.stop_monitoring()
        print("Done!")


if __name__ == "__main__":
    main()
