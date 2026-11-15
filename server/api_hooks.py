#!/usr/bin/env python3
"""
ATLAS-HELIOS API Hooks System
Provides external API integration hooks for atlas-helios-enhanced
"""

import os
import sys
import json
import logging
from typing import Dict, Optional, Callable
from datetime import datetime
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("atlas-hooks")


class ExternalAPIHook:
    """Base class for external API hooks"""

    def __init__(self, name: str, base_url: str, api_key: Optional[str] = None):
        self.name = name
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        self.hooks: Dict[str, Callable] = {}
        self.enabled = True

        if api_key:
            self.session.headers.update({"Authorization": f"Bearer {api_key}"})

    def register_hook(self, event: str, callback: Callable):
        """Register a callback for an event"""
        self.hooks[event] = callback
        logger.info(f"Registered hook for {event} on {self.name}")

    def trigger_hook(self, event: str, data: Dict):
        """Trigger a hook callback"""
        if event in self.hooks:
            try:
                self.hooks[event](data)
            except Exception as e:
                logger.error(f"Hook error for {event}: {e}")

    def make_request(self, method: str, endpoint: str, **kwargs) -> Optional[Dict]:
        """Make HTTP request to external API"""
        if not self.enabled:
            return None

        url = f"{self.base_url}{endpoint}"
        try:
            response = self.session.request(method, url, timeout=30, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            return None


class NOAAWeatherHook(ExternalAPIHook):
    """Hook for NOAA Weather API"""

    def __init__(self):
        super().__init__("NOAA Weather", "https://api.weather.gov")
        self.session.headers.update({"User-Agent": "ATLAS-HELIOS/2.0"})

    def get_alerts(self, state: str = None, zone: str = None) -> Optional[Dict]:
        """Get weather alerts"""
        params = {"status": "actual"}
        if state:
            params["area"] = state
        if zone:
            params["zone"] = zone

        return self.make_request("GET", "/alerts/active", params=params)

    def get_forecast(self, lat: float, lon: float) -> Optional[Dict]:
        """Get forecast for location"""
        # First get gridpoint
        points = self.make_request("GET", f"/points/{lat},{lon}")
        if not points:
            return None

        # Then get forecast from gridpoint
        forecast_url = points.get("properties", {}).get("forecast")
        if forecast_url:
            return self.make_request("GET", forecast_url.replace(self.base_url, ""))
        return None

    def get_storm_data(self, storm_id: str) -> Optional[Dict]:
        """Get specific storm data"""
        return self.make_request("GET", f"/storms/{storm_id}")


class StormIntelligenceHook(ExternalAPIHook):
    """Hook for internal Storm Intelligence Service"""

    def __init__(self, base_url: Optional[str] = None):
        if base_url is None:
            port = os.getenv("PORT", os.getenv("BACKEND_PORT", "3001"))
            base_url = f"http://localhost:{port}"
        super().__init__("Storm Intelligence", base_url)

    def get_active_storms(self) -> Optional[Dict]:
        """Get list of active storms"""
        return self.make_request("GET", "/api/storms/active")

    def get_storm_details(self, storm_id: str) -> Optional[Dict]:
        """Get detailed storm information"""
        return self.make_request("GET", f"/api/storms/{storm_id}")

    def calculate_damage_probability(
        self, property_id: str, storm_id: str
    ) -> Optional[Dict]:
        """Calculate damage probability for property"""
        data = {"property_id": property_id, "storm_id": storm_id}
        return self.make_request("POST", "/api/storms/damage-probability", json=data)


class ComputerVisionHook(ExternalAPIHook):
    """Hook for Computer Vision Service"""

    def __init__(self, base_url: str = "http://localhost:3001"):
        super().__init__("Computer Vision", base_url)

    def analyze_image(
        self, image_path: str, analysis_type: str = "damage"
    ) -> Optional[Dict]:
        """Analyze image for damage"""
        data = {"image_path": image_path, "type": analysis_type}
        return self.make_request("POST", "/api/assessments/analyze", json=data)

    def detect_roof_damage(self, image_path: str, property_id: str = "1") -> Optional[Dict]:
        """Specifically detect roof damage"""
        data = {"image_path": image_path, "property_id": property_id}
        return self.make_request("POST", "/api/assessments/roof-damage", json=data)


class NexusMindHook(ExternalAPIHook):
    """Hook for Nexus Mind AI"""

    def __init__(self, base_url: str = "http://localhost:3001"):
        super().__init__("Nexus Mind AI", base_url)

    def run_inference(self, data: Dict) -> Optional[Dict]:
        """Run AI inference"""
        return self.make_request("POST", "/api/nexus/inference", json=data)

    def get_status(self) -> Optional[Dict]:
        """Get AI system status"""
        return self.make_request("GET", "/api/nexus/status")

    def cognitive_step(self, context: Dict) -> Optional[Dict]:
        """Execute cognitive processing step"""
        return self.make_request("POST", "/api/nexus/cognitive/step", json=context)


class PerceptionEncoderHook(ExternalAPIHook):
    """Hook for Perception Encoder"""

    def __init__(self, base_url: str = "http://localhost:3001"):
        super().__init__("Perception Encoder", base_url)

    def encode_image(self, image_path: str, config: Optional[Dict] = None) -> Optional[Dict]:
        """Encode image to feature vector"""
        data = {"image_path": image_path, "config": config or {}}
        return self.make_request("POST", "/api/perception/encode-image", json=data)

    def classify_image(self, image_path: str, labels: list) -> Optional[Dict]:
        """Classify image with custom labels"""
        data = {"image_path": image_path, "labels": labels}
        return self.make_request("POST", "/api/perception/classify", json=data)


class SentinelImageryHook(ExternalAPIHook):
    """Hook for Sentinel Satellite Imagery"""

    def __init__(self, base_url: str = "http://localhost:3001"):
        super().__init__("Sentinel Imagery", base_url)

    def search_imagery(
        self, lat: float, lon: float, start_date: str, end_date: str
    ) -> Optional[Dict]:
        """Search for satellite imagery"""
        data = {"lat": lat, "lon": lon, "startDate": start_date, "endDate": end_date}
        return self.make_request("POST", "/api/sentinel/search", json=data)

    def get_property_imagery(self, property_id: str, lat: Optional[float] = None, lon: Optional[float] = None) -> Optional[Dict]:
        """Get imagery for specific property"""
        data = {"property_id": property_id, "lat": lat or 32.7767, "lon": lon or -96.7970}
        return self.make_request("POST", "/api/sentinel/property-imagery", json=data)


class HookManager:
    """Manages all external API hooks"""

    def __init__(self):
        self.hooks: Dict[str, ExternalAPIHook] = {}
        self.webhook_server = None
        self.webhook_thread = None

    def register_hook(self, name: str, hook: ExternalAPIHook):
        """Register a hook"""
        self.hooks[name] = hook
        logger.info(f"Registered hook manager: {name}")

    def get_hook(self, name: str) -> Optional[ExternalAPIHook]:
        """Get a hook by name"""
        return self.hooks.get(name)

    def start_webhook_server(self, port: int = 5052):
        """Start webhook receiver server"""
        app = Flask(__name__)
        CORS(app)

        @app.route("/webhook/<hook_name>", methods=["POST"])
        def receive_webhook(hook_name):
            """Receive webhook from external service"""
            if hook_name not in self.hooks:
                return jsonify({"error": "Unknown hook"}), 404

            data = request.json
            hook = self.hooks[hook_name]

            # Trigger appropriate callback based on event type
            event_type = data.get("event_type", "default")
            hook.trigger_hook(event_type, data)

            return jsonify({"status": "received"})

        @app.route("/hooks/status", methods=["GET"])
        def get_hooks_status():
            """Get status of all hooks"""
            status = {}
            for name, hook in self.hooks.items():
                status[name] = {"enabled": hook.enabled, "base_url": hook.base_url}
            return jsonify(status)

        def run_server():
            app.run(host="0.0.0.0", port=port, debug=False)

        self.webhook_thread = threading.Thread(target=run_server, daemon=True)
        self.webhook_thread.start()
        logger.info(f"Webhook server started on port {port}")

    def health_check_all(self) -> Dict:
        """Check health of all hooks"""
        health = {}
        for name, hook in self.hooks.items():
            try:
                # Try to make a simple request
                response = hook.make_request("GET", "/health")
                health[name] = {
                    "status": "healthy" if response else "unhealthy",
                    "reachable": response is not None,
                }
            except Exception as e:
                health[name] = {"status": "error", "error": str(e)}
        return health


# Initialize hooks
hook_manager = HookManager()

# Register all hooks
hook_manager.register_hook("noaa_weather", NOAAWeatherHook())
hook_manager.register_hook("storm_intelligence", StormIntelligenceHook())
hook_manager.register_hook("computer_vision", ComputerVisionHook())
hook_manager.register_hook("nexus_mind", NexusMindHook())
hook_manager.register_hook("perception_encoder", PerceptionEncoderHook())
hook_manager.register_hook("sentinel_imagery", SentinelImageryHook())


if __name__ == "__main__":
    print("=" * 60)
    print("ATLAS-HELIOS API Hooks System")
    print("=" * 60)
    print()

    # Start webhook server
    hook_manager.start_webhook_server(port=5052)

    print("Registered hooks:")
    for name in hook_manager.hooks.keys():
        print(f"  - {name}")

    print()
    print("Webhook server running on http://localhost:5052")
    print("Press Ctrl+C to stop")
    print()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
