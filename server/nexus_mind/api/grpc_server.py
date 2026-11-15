"""
gRPC Server for Nexus Mind

Provides gRPC service for inference.
"""

import asyncio
import logging
from typing import Optional

import torch
import grpc
from concurrent import futures

logger = logging.getLogger(__name__)


class NexusMindServicer:
    """
    gRPC servicer for Nexus Mind.
    """

    def __init__(self, cognitive_manager):
        """
        Initialize servicer.

        Args:
            cognitive_manager: CognitiveLoopManager instance
        """
        self.manager = cognitive_manager
        logger.info("NexusMindServicer initialized")

    async def ProcessInference(self, request, context):
        """
        Process inference request.

        Args:
            request: InferenceRequest
            context: gRPC context

        Returns:
            InferenceResponse
        """
        try:
            # Deserialize tensors
            sensor_data = torch.frombytes(request.sensor_data)
            geo_data = torch.frombytes(request.geo_data) if request.geo_data else None
            behavior_data = (
                torch.frombytes(request.behavior_data)
                if request.behavior_data
                else None
            )

            # Run inference
            result = self.manager.step(sensor_data, geo_data, behavior_data)

            # Serialize response
            response = InferenceResponse(
                fused=result["fused"].cpu().numpy().tolist(),
                anomaly_score=result["nade_anomaly"].cpu().numpy().tolist(),
                intent=result.get("bne_intent", [-1]).cpu().numpy().tolist()
                if result.get("bne_intent") is not None
                else [-1],
                confidence=result["confidence"].cpu().numpy().tolist(),
            )

            return response

        except Exception as e:
            logger.error(f"Inference error: {e}")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return InferenceResponse()

    async def GetStats(self, request, context):
        """
        Get system stats.

        Args:
            request: Empty
            context: gRPC context

        Returns:
            StatsResponse
        """
        state = self.manager.get_state()

        return StatsResponse(
            alert_level=state["alert_level"], history_length=state["history_length"]
        )


async def serve(cognitive_manager, port: int = 50051, max_workers: int = 10):
    """
    Start gRPC server.

    Args:
        cognitive_manager: CognitiveLoopManager instance
        port: Port to listen on
        max_workers: Maximum worker threads
    """
    server = grpc.aio.server(futures.ThreadPoolExecutor(max_workers))

    # Add servicer
    servicer = NexusMindServicer(cognitive_manager)

    # In production, generate from proto
    # nexus_mind_pb2_grpc.add_NexusMindServicer_to_server(servicer, server)

    server.add_insecure_port(f"[::]:{port}")
    await server.start()

    logger.info(f"gRPC server started on port {port}")

    return server


# Proto definitions (for reference)
"""
syntax = "proto3";

service NexusMind {
  rpc ProcessInference(InferenceRequest) returns (InferenceResponse);
  rpc GetStats(Empty) returns (StatsResponse);
}

message InferenceRequest {
  bytes sensor_data = 1;
  bytes geo_data = 2;
  bytes behavior_data = 3;
}

message InferenceResponse {
  repeated float fused = 1;
  float anomaly_score = 2;
  repeated float intent = 3;
  float confidence = 4;
}

message StatsResponse {
  float alert_level = 1;
  int32 history_length = 2;
}

message Empty {}
"""


# Placeholder classes for type hints
class InferenceRequest:
    sensor_data: bytes
    geo_data: bytes
    behavior_data: bytes


class InferenceResponse:
    fused: list
    anomaly_score: list
    intent: list
    confidence: list


class StatsResponse:
    alert_level: float
    history_length: int


class Empty:
    pass
