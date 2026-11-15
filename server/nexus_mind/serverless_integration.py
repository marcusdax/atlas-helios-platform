"""
Serverless Integration Module for Nexus Mind AI

Implements event-driven architecture patterns from AWS serverless patterns:
- API Gateway → EventBridge integration
- Async message queue processing with SQS
- Cloud-native monitoring and observability
"""

import asyncio
import json
import logging
import time
from typing import Dict, Any, Optional, Callable, List
from dataclasses import dataclass, asdict
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class EventType(Enum):
    """Event types for the cognitive pipeline."""

    INFERENCE_REQUEST = "nexus.inference.request"
    INFERENCE_RESPONSE = "nexus.inference.response"
    MODEL_UPDATE = "nexus.model.update"
    ALERT_TRIGGERED = "nexus.alert.triggered"
    HEALTH_CHECK = "nexus.health.check"
    METRICS_UPDATE = "nexus.metrics.update"


@dataclass
class CognitiveEvent:
    """Represents a cognitive processing event."""

    event_id: str
    event_type: str
    timestamp: float
    source: str
    data: Dict[str, Any]
    correlation_id: Optional[str] = None
    trace_id: Optional[str] = None

    def to_json(self) -> str:
        return json.dumps(asdict(self))

    @classmethod
    def from_json(cls, json_str: str) -> "CognitiveEvent":
        return cls(**json.loads(json_str))


class EventBus:
    """
    In-memory Event Bus implementing EventBridge-like patterns.
    Supports event filtering, dead-letter handling, and tracing.
    """

    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        self._event_history: List[CognitiveEvent] = []
        self._max_history = 1000
        self._dead_letter_queue: List[CognitiveEvent] = []
        self._trace_enabled = True

    def subscribe(self, event_type: str, handler: Callable[[CognitiveEvent], None]):
        """Subscribe to an event type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed handler to {event_type}")

    def publish(self, event: CognitiveEvent) -> bool:
        """Publish an event to all subscribers."""
        if self._trace_enabled:
            logger.debug(
                f"Publishing event: {event.event_id} of type {event.event_type}"
            )

        self._event_history.append(event)
        if len(self._event_history) > self._max_history:
            self._event_history.pop(0)

        handlers = self._subscribers.get(event.event_type, [])
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(f"Handler failed for {event.event_id}: {e}")
                self._dead_letter_queue.append(event)
                return False

        return True

    def get_history(
        self, event_type: Optional[str] = None, limit: int = 100
    ) -> List[CognitiveEvent]:
        """Get event history."""
        if event_type:
            return [e for e in self._event_history if e.event_type == event_type][
                -limit:
            ]
        return self._event_history[-limit:]

    def get_dead_letters(self) -> List[CognitiveEvent]:
        """Get events that failed processing."""
        return self._dead_letter_queue.copy()


class MessageQueue:
    """
    In-memory message queue implementing SQS-like patterns.
    Supports FIFO ordering, visibility timeout, and DLQ.
    """

    def __init__(self, name: str, max_retries: int = 3):
        self.name = name
        self._queue: List[Dict[str, Any]] = []
        self._processing: Dict[str, Dict[str, Any]] = {}
        self._max_retries = max_retries
        self._visibility_timeout = 30
        logger.info(f"MessageQueue '{name}' initialized")

    def send(self, message: Dict[str, Any], delay: float = 0) -> str:
        """Send a message to the queue."""
        message_id = str(uuid.uuid4())
        entry = {
            "message_id": message_id,
            "body": message,
            "status": "pending",
            "attempts": 0,
            "created_at": time.time(),
            "available_at": time.time() + delay,
            "receipt_handle": str(uuid.uuid4()),
        }
        self._queue.append(entry)
        logger.debug(f"Message {message_id} added to queue")
        return message_id

    def receive(
        self, wait_time: float = 1, max_messages: int = 1
    ) -> List[Dict[str, Any]]:
        """Receive messages from the queue."""
        now = time.time()
        available = [
            m
            for m in self._queue
            if m["status"] == "pending" and m["available_at"] <= now
        ]
        messages = available[:max_messages]

        for msg in messages:
            msg["status"] = "processing"
            msg["received_at"] = now
            msg["receipt_handle"] = str(uuid.uuid4())
            self._processing[msg["message_id"]] = msg

        return [
            {
                "message_id": m["message_id"],
                "body": m["body"],
                "receipt_handle": m["receipt_handle"],
            }
            for m in messages
        ]

    def delete(self, message_id: str):
        """Delete a processed message."""
        if message_id in self._processing:
            self._queue = [m for m in self._queue if m["message_id"] != message_id]
            del self._processing[message_id]
            logger.debug(f"Message {message_id} deleted")

    def release(self, message_id: str):
        """Release a message back to the queue."""
        if message_id in self._processing:
            msg = self._processing[message_id]
            msg["attempts"] += 1
            msg["status"] = "pending"
            msg["available_at"] = time.time()

            if msg["attempts"] >= self._max_retries:
                logger.warning(f"Message {message_id} exceeded max retries")
                msg["status"] = "failed"

            del self._processing[message_id]

    def get_stats(self) -> Dict[str, int]:
        """Get queue statistics."""
        return {
            "pending": len([m for m in self._queue if m["status"] == "pending"]),
            "processing": len(self._processing),
            "failed": len([m for m in self._queue if m["status"] == "failed"]),
        }


class AsyncInferenceHandler:
    """
    Handles async inference requests using queue pattern.
    Integrates with Nexus Mind cognitive pipeline.
    """

    def __init__(self, event_bus: EventBus):
        self.event_bus = event_bus
        self.inference_queue = MessageQueue("inference-queue")
        self.result_queue = MessageQueue("result-queue")
        self._running = False

        self._setup_event_handlers()

    def _setup_event_handlers(self):
        """Setup event bus handlers."""
        self.event_bus.subscribe(
            EventType.INFERENCE_REQUEST.value, self._handle_inference_event
        )

    def _handle_inference_event(self, event: CognitiveEvent):
        """Handle incoming inference events."""
        message_id = self.inference_queue.send(event.data)
        logger.info(f"Inference queued: {message_id}")

    async def process_queue(self, processor: Callable):
        """Process messages from the inference queue."""
        self._running = True
        while self._running:
            messages = self.inference_queue.receive(max_messages=10)
            for msg in messages:
                try:
                    result = await processor(msg["body"])
                    self.result_queue.send(
                        {
                            "message_id": msg["message_id"],
                            "result": result,
                            "processed_at": time.time(),
                        }
                    )

                    self.event_bus.publish(
                        CognitiveEvent(
                            event_id=str(uuid.uuid4()),
                            event_type=EventType.INFERENCE_RESPONSE.value,
                            timestamp=time.time(),
                            source="async-handler",
                            data={"message_id": msg["message_id"], "status": "success"},
                        )
                    )

                    self.inference_queue.delete(msg["message_id"])

                except Exception as e:
                    logger.error(f"Processing failed: {e}")
                    self.inference_queue.release(msg["message_id"])

            await asyncio.sleep(0.1)

    def stop(self):
        """Stop the queue processor."""
        self._running = False


class ServerlessMetrics:
    """
    CloudWatch-like metrics collector.
    Tracks latency, errors, and custom metrics.
    """

    def __init__(self, namespace: str = "NexusMind"):
        self.namespace = namespace
        self._metrics: Dict[str, List[float]] = {}
        self._counters: Dict[str, int] = {}

    def record_latency(self, operation: str, latency_ms: float):
        """Record operation latency."""
        if operation not in self._metrics:
            self._metrics[operation] = []
        self._metrics[operation].append(latency_ms)
        if len(self._metrics[operation]) > 1000:
            self._metrics[operation].pop(0)

    def increment_counter(self, name: str, value: int = 1):
        """Increment a counter metric."""
        self._counters[name] = self._counters.get(name, 0) + value

    def get_stats(self, operation: str) -> Dict[str, float]:
        """Get statistics for an operation."""
        if operation not in self._metrics or not self._metrics[operation]:
            return {}

        values = self._metrics[operation]
        sorted_values = sorted(values)
        n = len(sorted_values)

        return {
            "count": n,
            "mean": sum(values) / n,
            "p50": sorted_values[int(0.5 * n)],
            "p95": sorted_values[min(int(0.95 * n), n - 1)],
            "p99": sorted_values[min(int(0.99 * n), n - 1)],
            "max": max(values),
            "min": min(values),
        }

    def get_counters(self) -> Dict[str, int]:
        """Get all counter values."""
        return self._counters.copy()


def create_serverless_pipeline(nexus_manager) -> Dict[str, Any]:
    """
    Create a serverless-ready pipeline for Nexus Mind.

    Returns:
        Dictionary with event_bus, message_queue, and metrics
    """
    event_bus = EventBus()
    metrics = ServerlessMetrics()

    async def async_processor(data: Dict[str, Any]) -> Dict[str, Any]:
        """Process inference requests asynchronously."""
        start = time.time()

        try:
            result = nexus_manager.step(data.get("sensor_data"))
            latency = (time.time() - start) * 1000

            metrics.record_latency("inference", latency)
            metrics.increment_counter("inference_success")

            return result
        except Exception as e:
            metrics.increment_counter("inference_error")
            raise

    handler = AsyncInferenceHandler(event_bus)
    event_bus.subscribe(
        EventType.INFERENCE_RESPONSE.value,
        lambda e: metrics.increment_counter("inference_completed"),
    )

    return {
        "event_bus": event_bus,
        "inference_queue": handler.inference_queue,
        "result_queue": handler.result_queue,
        "metrics": metrics,
        "async_handler": handler,
    }
