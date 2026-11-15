"""
Nexus Mind Phase 2 - Ledger-Enabled Core Engines

Integration of ACP-SQL Ledger with NADE, GIE, BNE, and Fusion engines.
Implements "no execution without logging" protocol.
"""

import logging
from typing import Dict, Optional, Any, Callable
from functools import wraps

from nexus_mind.security.acp_client import ACPLedgerClient, ACPActionType

logger = logging.getLogger(__name__)


class LedgerEnabledEngine:
    """
    Base class for ledger-enabled engines.

    All inference requests are logged to the immutable ledger
    before execution (protocol-first security).
    """

    def __init__(
        self,
        engine_name: str,
        engine,
        ledger_client: Optional[ACPLedgerClient] = None,
    ):
        """
        Initialize ledger-enabled engine.

        Args:
            engine_name: Name of the engine (nade, gie, bne, fusion)
            engine: The underlying engine module
            ledger_client: ACP Ledger client (optional)
        """
        self.engine_name = engine_name
        self.engine = engine
        self.ledger = ledger_client
        self._last_packet_id = None

    def _get_action_type(self) -> str:
        """Get the action type for this engine."""
        action_map = {
            "nade": ACPActionType.INFERENCE_NADE.value,
            "gie": ACPActionType.INFERENCE_GIE.value,
            "bne": ACPActionType.INFERENCE_BNE.value,
            "fusion": ACPActionType.INFERENCE_FUSION.value,
        }
        return action_map.get(self.engine_name, "inference.unknown")

    def forward(
        self,
        *args,
        agent_id: str = "system",
        tenant_id: str = "default",
        context: Optional[Dict] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        """
        Forward pass with ledger logging.

        Args:
            agent_id: Agent making the request
            tenant_id: Tenant identifier
            context: Additional context

        Returns:
            Engine output with packet_id
        """
        if not self.ledger:
            # No ledger, just run without logging
            return self._forward_impl(*args, **kwargs)

        # Prepare payload for logging
        payload = {
            "engine": self.engine_name,
            "args": str(args)[:100],  # Truncate for logging
            "kwargs": {k: str(v)[:50] for k, v in kwargs.items() if k != "self"},
        }

        # Create packet
        packet = self.ledger.create_packet(
            agent_id=agent_id,
            tenant_id=tenant_id,
            action_type=self._get_action_type(),
            scope=context or {},
            payload=payload,
            parent_id=self._last_packet_id,
            metadata={"engine": self.engine_name},
        )

        # Log and execute
        def execute_fn(p):
            return self._forward_impl(*args, **kwargs)

        result = self.ledger.log_and_execute(packet, execute_fn)

        # Store last packet ID for chaining
        self._last_packet_id = result.packet_id

        # Add packet info to result
        if isinstance(result.result, dict):
            result.result["_packet_id"] = result.packet_id
            result.result["_executed_at"] = result.completed_at
            result.result["_execution_time_ms"] = result.execution_time_ms

        return result

    def _forward_impl(self, *args, **kwargs) -> Dict[str, Any]:
        """Actual forward implementation - to be overridden by subclasses."""
        raise NotImplementedError("Subclasses must implement _forward_impl")


class LedgerEnabledNADE(LedgerEnabledEngine):
    """NADE Engine with ledger logging."""

    def __init__(
        self, *args, ledger_client: Optional[ACPLedgerClient] = None, **kwargs
    ):
        from nexus_mind.core.nade import NADEEngine

        engine = NADEEngine(*args, **kwargs)
        super().__init__("nade", engine, ledger_client)

    def _forward_impl(self, *args, **kwargs) -> Dict[str, Any]:
        return self.engine(*args, **kwargs)


class LedgerEnabledGIE(LedgerEnabledEngine):
    """GIE Engine with ledger logging."""

    def __init__(
        self, *args, ledger_client: Optional[ACPLedgerClient] = None, **kwargs
    ):
        from nexus_mind.core.gie import GIEEngine

        engine = GIEEngine(*args, **kwargs)
        super().__init__("gie", engine, ledger_client)

    def _forward_impl(self, *args, **kwargs) -> Dict[str, Any]:
        return self.engine(*args, **kwargs)


class LedgerEnabledBNE(LedgerEnabledEngine):
    """BNE Engine with ledger logging."""

    def __init__(
        self, *args, ledger_client: Optional[ACPLedgerClient] = None, **kwargs
    ):
        from nexus_mind.core.bne import BNEEngine

        engine = BNEEngine(*args, **kwargs)
        super().__init__("bne", engine, ledger_client)

    def _forward_impl(self, *args, **kwargs) -> Dict[str, Any]:
        return self.engine(*args, **kwargs)


class LedgerEnabledFusion(LedgerEnabledEngine):
    """Fusion Engine with ledger logging."""

    def __init__(
        self, *args, ledger_client: Optional[ACPLedgerClient] = None, **kwargs
    ):
        from nexus_mind.core.fusion import KimiDeltaAttention

        engine = KimiDeltaAttention(*args, **kwargs)
        super().__init__("fusion", engine, ledger_client)

    def _forward_impl(self, *args, **kwargs) -> Dict[str, Any]:
        return self.engine(*args, **kwargs)


def ledger_enabled(action_type: str = "inference.default"):
    """
    Decorator to make any function ledger-enabled.

    Usage:
        @ledger_enabled("inference.custom")
        def my_inference(data):
            return {"result": process(data)}
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(
            *args,
            _ledger_client=None,
            _agent_id="system",
            _tenant_id="default",
            **kwargs,
        ):
            if not _ledger_client:
                return func(*args, **kwargs)

            payload = {
                "function": func.__name__,
                "args": str(args)[:100],
                "kwargs": {k: str(v)[:50] for k, v in kwargs.items()},
            }

            packet = _ledger_client.create_packet(
                agent_id=_agent_id,
                tenant_id=_tenant_id,
                action_type=action_type,
                scope={},
                payload=payload,
            )

            def execute_fn(p):
                return func(*args, **kwargs)

            result = _ledger_client.log_and_execute(packet, execute_fn)

            if result.success:
                return result.result
            else:
                raise RuntimeError(f"Inference failed: {result.error}")

        return wrapper

    return decorator


class FusionOrchestrator:
    """
    Orchestrates multiple ledger-enabled engines for fused inference.

    Coordinates NADE, GIE, BNE with the Fusion engine while
    maintaining full audit trail.
    """

    def __init__(
        self,
        nade: LedgerEnabledNADE,
        gie: LedgerEnabledGIE,
        bne: LedgerEnabledBNE,
        fusion: LedgerEnabledFusion,
        ledger_client: Optional[ACPLedgerClient] = None,
    ):
        self.nade = nade
        self.gie = gie
        self.bne = bne
        self.fusion = fusion
        self.ledger = ledger_client

    def process(
        self,
        sensor_data,
        image_data,
        behavior_data,
        agent_id: str = "system",
        tenant_id: str = "default",
    ) -> Dict[str, Any]:
        """
        Process multi-modal input through all engines.

        Args:
            sensor_data: Input for NADE
            image_data: Input for GIE
            behavior_data: Input for BNE
            agent_id: Requesting agent
            tenant_id: Tenant identifier

        Returns:
            Fused result with packet IDs
        """
        results = {
            "nade": None,
            "gie": None,
            "bne": None,
            "fusion": None,
        }

        # Run each engine with ledger logging
        if sensor_data is not None:
            results["nade"] = self.nade.forward(
                sensor_data,
                agent_id=agent_id,
                tenant_id=tenant_id,
            )

        if image_data is not None:
            results["gie"] = self.gie.forward(
                image_data,
                agent_id=agent_id,
                tenant_id=tenant_id,
            )

        if behavior_data is not None:
            results["bne"] = self.bne.forward(
                behavior_data,
                agent_id=agent_id,
                tenant_id=tenant_id,
            )

        # Extract features for fusion
        nade_feat = None
        gie_feat = None
        bne_feat = None

        if results.get("nade"):
            nade_feat = results["nade"].get("features")
        if results.get("gie"):
            gie_feat = results["gie"].get("features")
        if results.get("bne"):
            bne_feat = results["bne"].get("features")

        # Run fusion
        if nade_feat is not None and gie_feat is not None and bne_feat is not None:
            results["fusion"] = self.fusion.forward(
                nade_feat,
                gie_feat,
                bne_feat,
                agent_id=agent_id,
                tenant_id=tenant_id,
            )

        return results


def create_fusion_orchestrator(
    ledger_client: Optional[ACPLedgerClient] = None, **engine_kwargs
) -> FusionOrchestrator:
    """
    Factory function to create a FusionOrchestrator.

    Args:
        ledger_client: ACP Ledger client
        **engine_kwargs: Arguments for engines

    Returns:
        Configured FusionOrchestrator
    """
    nade = LedgerEnabledNADE(
        input_dim=engine_kwargs.get("input_dim", 64),
        hidden_dim=engine_kwargs.get("hidden_dim", 128),
        ledger_client=ledger_client,
    )

    gie = LedgerEnabledGIE(
        img_size=engine_kwargs.get("img_size", 224),
        embed_dim=engine_kwargs.get("embed_dim", 256),
        ledger_client=ledger_client,
    )

    bne = LedgerEnabledBNE(
        input_dim=engine_kwargs.get("input_dim", 64),
        hidden_dim=engine_kwargs.get("hidden_dim", 256),
        ledger_client=ledger_client,
    )

    fusion = LedgerEnabledFusion(
        dim_nade=engine_kwargs.get("dim_nade", 128),
        dim_gie=engine_kwargs.get("dim_gie", 256),
        dim_bne=engine_kwargs.get("dim_bne", 256),
        ledger_client=ledger_client,
    )

    return FusionOrchestrator(nade, gie, bne, fusion, ledger_client)


__all__ = [
    "LedgerEnabledEngine",
    "LedgerEnabledNADE",
    "LedgerEnabledGIE",
    "LedgerEnabledBNE",
    "LedgerEnabledFusion",
    "FusionOrchestrator",
    "ledger_enabled",
    "create_fusion_orchestrator",
]
