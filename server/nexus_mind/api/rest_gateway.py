"""
REST Gateway for Nexus Mind

Provides REST API for inference (optional alternative to gRPC).
"""

import json
from typing import Dict, Any, Optional
import logging

import torch
from aiohttp import web

logger = logging.getLogger(__name__)


class RESTServer:
    """
    REST API server for Nexus Mind.
    """

    def __init__(self, cognitive_manager, port: int = 8080):
        """
        Initialize REST server.

        Args:
            cognitive_manager: CognitiveLoopManager instance
            port: Port to listen on
        """
        self.manager = cognitive_manager
        self.port = port
        self.app = None

        logger.info(f"RESTServer initialized on port {port}")

    def setup_routes(self):
        """Setup API routes."""
        self.app.router.add_post("/api/v1/infer", self.handle_infer)
        self.app.router.add_post("/api/v1/infer/batch", self.handle_batch_infer)
        self.app.router.add_get("/api/v1/health", self.handle_health)
        self.app.router.add_get("/api/v1/stats", self.handle_stats)
        self.app.router.add_post("/api/v1/reset", self.handle_reset)

    async def handle_infer(self, request: web.Request) -> web.Response:
        """
        Handle single inference request.

        POST /api/v1/infer
        Body: {
            "sensor_data": [[...]],  // 2D array
            "geo_data": [[...]],     // optional
            "behavior_data": [[...]] // optional
        }
        """
        try:
            data = await request.json()

            # Convert to tensors
            sensor_data = torch.tensor(data.get("sensor_data", []), dtype=torch.float32)
            geo_data = None
            behavior_data = None

            if "geo_data" in data and data["geo_data"]:
                geo_data = torch.tensor(data["geo_data"], dtype=torch.float32)

            if "behavior_data" in data and data["behavior_data"]:
                behavior_data = torch.tensor(data["behavior_data"], dtype=torch.float32)

            # Run inference
            result = self.manager.step(sensor_data, geo_data, behavior_data)

            # Format response
            response = {
                "success": True,
                "data": {
                    "fused": result["fused"].cpu().numpy().tolist(),
                    "confidence": result["confidence"].item(),
                    "anomaly_score": result["nade_anomaly"].item(),
                    "is_anomaly": result["nade_is_anomaly"].item(),
                    "intent": int(result.get("bne_intent", -1))
                    if result.get("bne_intent") is not None
                    else None,
                    "sentiment": int(result.get("bne_sentiment", -1))
                    if result.get("bne_sentiment") is not None
                    else None,
                },
                "cognitive_state": {
                    "alert_level": result["alert_level"],
                    "priming_factor": result["cognitive_state"].get(
                        "priming_factor", 1.0
                    ),
                },
            }

            return web.json_response(response)

        except Exception as e:
            logger.error(f"Inference error: {e}")
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_batch_infer(self, request: web.Request) -> web.Response:
        """
        Handle batch inference request.

        POST /api/v1/infer/batch
        Body: {
            "requests": [
                {"sensor_data": [...]},
                {"sensor_data": [...]}
            ]
        }
        """
        try:
            data = await request.json()
            requests = data.get("requests", [])

            results = []
            for req in requests:
                sensor_data = torch.tensor(
                    req.get("sensor_data", []), dtype=torch.float32
                )

                result = self.manager.step(sensor_data)

                results.append(
                    {
                        "fused": result["fused"].cpu().numpy().tolist(),
                        "confidence": result["confidence"].item(),
                    }
                )

            return web.json_response({"success": True, "results": results})

        except Exception as e:
            logger.error(f"Batch inference error: {e}")
            return web.json_response({"success": False, "error": str(e)}, status=500)

    async def handle_health(self, request: web.Request) -> web.Response:
        """Health check endpoint."""
        return web.json_response({"status": "healthy", "service": "nexus-mind"})

    async def handle_stats(self, request: web.Request) -> web.Response:
        """Stats endpoint."""
        state = self.manager.get_state()

        return web.json_response(
            {
                "alert_level": state["alert_level"],
                "history_length": state["history_length"],
                "context": {
                    "intent": state["context"].get("intent"),
                    "priming_factor": state["context"].get("priming_factor"),
                },
            }
        )

    async def handle_reset(self, request: web.Request) -> web.Response:
        """Reset cognitive state."""
        self.manager.reset()

        return web.json_response({"success": True, "message": "Cognitive state reset"})

    async def start(self):
        """Start the REST server."""
        self.app = web.Application()
        self.setup_routes()

        runner = web.AppRunner(self.app)
        await runner.setup()

        site = web.TCPSite(runner, "0.0.0.0", self.port)
        await site.start()

        logger.info(f"REST server started on port {self.port}")

        return runner


async def create_app(cognitive_manager, port: int = 8080) -> web.Application:
    """
    Create aiohttp application.

    Args:
        cognitive_manager: CognitiveLoopManager instance
        port: Port to listen on

    Returns:
        Configured aiohttp application
    """
    server = RESTServer(cognitive_manager, port)
    return server.app
