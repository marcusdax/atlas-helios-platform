"""
Nexus Mind Security - Engine Security Wrapper

Wraps NADE, GIE, BNE engines with IronClaw sandbox security,
credential protection, and audit logging.
"""

import torch
import logging
from typing import Dict, Optional, Any, Callable
from functools import wraps

from nexus_mind.security.ironclaw_adapter import (
    IronClawSandbox,
    SandboxConfig,
    ToolExecutionResult,
    ConfidentialGPUManager,
)

logger = logging.getLogger(__name__)


class SecureEngineWrapper:
    """
    Security wrapper for Nexus Mind core engines.

    Provides:
    - Tool execution sandboxing via IronClaw
    - Credential protection at host boundary
    - Audit logging to ACP ledger
    - Leak detection and blocking
    """

    def __init__(
        self,
        engine_name: str,
        engine: torch.nn.Module,
        sandbox_config: Optional[SandboxConfig] = None,
        enable_audit: bool = True,
    ):
        """
        Initialize secure engine wrapper.

        Args:
            engine_name: Name of the engine (nade, gie, bne)
            engine: The engine module to wrap
            sandbox_config: IronClaw sandbox configuration
            enable_audit: Whether to log to audit ledger
        """
        self.engine_name = engine_name
        self.engine = engine
        self.sandbox = IronClawSandbox(sandbox_config)
        self.gpu_manager = ConfidentialGPUManager()
        self.enable_audit = enable_audit

        self._tool_registry: Dict[str, Callable] = {}
        self._register_default_tools()

        logger.info(f"Secure wrapper initialized for {engine_name}")

    def _register_default_tools(self):
        """Register default tool functions for this engine."""
        if self.engine_name == "nade":
            self._tool_registry = {
                "detect_anomaly": self._tool_detect_anomaly,
                "update_threshold": self._tool_update_threshold,
                "get_features": self._tool_get_features,
            }
        elif self.engine_name == "gie":
            self._tool_registry = {
                "analyze_image": self._tool_analyze_image,
                "classify_property": self._tool_classify_property,
                "detect_objects": self._tool_detect_objects,
            }
        elif self.engine_name == "bne":
            self._tool_registry = {
                "predict_intent": self._tool_predict_intent,
                "analyze_sentiment": self._tool_analyze_sentiment,
                "get_engagement": self._tool_get_engagement,
            }

    def _tool_detect_anomaly(
        self, input_data: Dict, credentials: Optional[Dict] = None
    ) -> Dict:
        """Execute anomaly detection in sandbox."""
        if not isinstance(input_data.get("features"), torch.Tensor):
            raise ValueError("features must be a torch.Tensor")

        context = input_data.get("context", {})
        result = self.engine(input_data["features"], context=context)

        anomaly_score = result["anomaly_score"]
        if hasattr(anomaly_score, "numel") and anomaly_score.numel() > 1:
            anomaly_score_val = float(anomaly_score.mean().item())
        elif hasattr(anomaly_score, "item"):
            anomaly_score_val = float(anomaly_score.item())
        else:
            anomaly_score_val = float(anomaly_score)

        is_anomaly = result["is_anomaly"]
        if hasattr(is_anomaly, "numel") and is_anomaly.numel() > 1:
            is_anomaly_val = bool(is_anomaly.any().item())
        elif hasattr(is_anomaly, "item"):
            is_anomaly_val = bool(is_anomaly.item())
        else:
            is_anomaly_val = bool(is_anomaly)

        return {
            "anomaly_score": anomaly_score_val,
            "is_anomaly": is_anomaly_val,
            "threshold": result.get("threshold", 0.5),
        }

    def _tool_update_threshold(
        self, input_data: Dict, credentials: Optional[Dict] = None
    ) -> Dict:
        """Update detection threshold."""
        threshold = input_data.get("threshold")
        if threshold is None:
            return {"success": False, "error": "threshold required"}

        self.engine.set_threshold(threshold)
        return {"success": True, "new_threshold": threshold}

    def _tool_get_features(
        self, input_data: Dict, credentials: Optional[Dict] = None
    ) -> Dict:
        """Extract features from input."""
        if not isinstance(input_data.get("features"), torch.Tensor):
            raise ValueError("features must be a torch.Tensor")

        result = self.engine(input_data["features"])
        features = result.get("features")

        return {
            "features": features.detach().numpy().tolist()
            if features is not None
            else None
        }

    def _tool_analyze_image(
        self, input_data: Dict, credentials: Optional[Dict] = None
    ) -> Dict:
        """Analyze image for geospatial intelligence."""
        if not isinstance(input_data.get("image"), torch.Tensor):
            raise ValueError("image must be a torch.Tensor")

        result = self.engine(input_data["image"])

        return {
            "property_class": result["property_class"].item(),
            "ufz_class": result["ufz_class"].item(),
            "objects_class": result["objects_class"].item(),
        }

    def _tool_classify_property(
        self, input_data: Dict, credentials: Optional[Dict] = None
    ) -> Dict:
        """Classify property type."""
        result = self.engine(input_data["image"])
        return {"property_class": result["property_class"].item()}

    def _tool_detect_objects(
        self, input_data: Dict, credentials: Optional[Dict] = None
    ) -> Dict:
        """Detect objects in image."""
        result = self.engine(input_data["image"])
        return {"objects_class": result["objects_class"].item()}

    def _tool_predict_intent(
        self, input_data: Dict, credentials: Optional[Dict] = None
    ) -> Dict:
        """Predict user intent from behavioral sequence."""
        if not isinstance(input_data.get("behavior"), torch.Tensor):
            raise ValueError("behavior must be a torch.Tensor")

        context = input_data.get("context")
        result = self.engine(input_data["behavior"], context=context)

        return {
            "intent_class": result["intent_class"].item(),
            "intent_name": self.engine.get_intent_name(result["intent_class"].item()),
            "engagement": result["engagement"].item(),
        }

    def _tool_analyze_sentiment(
        self, input_data: Dict, credentials: Optional[Dict] = None
    ) -> Dict:
        """Analyze sentiment from behavioral sequence."""
        result = self.engine(input_data["behavior"])
        return {"sentiment_class": result["sentiment_class"].item()}

    def _tool_get_engagement(
        self, input_data: Dict, credentials: Optional[Dict] = None
    ) -> Dict:
        """Get engagement score."""
        result = self.engine(input_data["behavior"])
        return {"engagement": result["engagement"].item()}

    def execute_tool(
        self,
        tool_name: str,
        input_data: Dict,
        credentials: Optional[Dict] = None,
        permissions: Optional[list] = None,
    ) -> ToolExecutionResult:
        """
        Execute a tool through the sandbox.

        Args:
            tool_name: Name of tool to execute
            input_data: Input data for the tool
            credentials: Credentials (protected, never exposed to sandbox)
            permissions: Required permissions

        Returns:
            ToolExecutionResult
        """
        if tool_name not in self._tool_registry:
            return ToolExecutionResult(
                success=False,
                error=f"Unknown tool: {tool_name}",
            )

        result = self.sandbox.execute_tool(
            tool_name=tool_name,
            input_data=input_data,
            permissions=permissions,
        )

        if not result.success:
            return result

        tool_func = self._tool_registry[tool_name]

        try:
            output = tool_func(input_data, credentials)
            return ToolExecutionResult(
                success=True,
                output=output,
                execution_time_ms=result.execution_time_ms,
                attestation=result.attestation,
            )
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e),
                execution_time_ms=result.execution_time_ms,
            )

    def forward(self, *args, **kwargs) -> Dict[str, torch.Tensor]:
        """
        Forward pass through the engine.

        Wraps the engine's forward method with secure context allocation.
        """
        secure_context = self.gpu_manager.allocate_secure_context()

        if not secure_context["success"]:
            logger.warning(
                f"Secure context allocation failed: {secure_context.get('error')}. "
                "Using standard execution."
            )

        return self.engine(*args, **kwargs)

    def get_audit_trail(self, limit: int = 100) -> list:
        """Get audit trail for this engine."""
        return self.sandbox.get_audit_trail(tool_name=self.engine_name, limit=limit)

    def get_security_status(self) -> Dict:
        """Get current security status."""
        return {
            "engine": self.engine_name,
            "sandbox_available": not self.sandbox._use_fallback,
            "gpu_status": self.gpu_manager.get_status(),
            "audit_enabled": self.enable_audit,
        }

    def close(self):
        """Clean up resources."""
        self.sandbox.close()


class SecureEngineRegistry:
    """
    Registry for managing multiple secure engine wrappers.
    """

    def __init__(self, sandbox_config: Optional[SandboxConfig] = None):
        self.engines: Dict[str, SecureEngineWrapper] = {}
        self.config = sandbox_config

    def register(self, name: str, engine: torch.nn.Module) -> SecureEngineWrapper:
        """Register a secure engine wrapper."""
        wrapper = SecureEngineWrapper(
            engine_name=name, engine=engine, sandbox_config=self.config
        )
        self.engines[name] = wrapper
        logger.info(f"Registered secure engine: {name}")
        return wrapper

    def get(self, name: str) -> Optional[SecureEngineWrapper]:
        """Get a secure engine by name."""
        return self.engines.get(name)

    def get_all_status(self) -> Dict[str, Dict]:
        """Get security status for all engines."""
        return {
            name: wrapper.get_security_status()
            for name, wrapper in self.engines.items()
        }

    def close_all(self):
        """Close all engine connections."""
        for wrapper in self.engines.values():
            wrapper.close()
        self.engines.clear()


def secure_forward(engine_name: str):
    """
    Decorator to secure an engine's forward method.

    Usage:
        @secure_forward("nade")
        def forward(self, x, context=None):
            ...
    """

    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            secure_wrapper = getattr(self, "_secure_wrapper", None)

            if secure_wrapper is None:
                return func(self, *args, **kwargs)

            return secure_wrapper.forward(*args, **kwargs)

        return wrapper

    return decorator


__all__ = [
    "SecureEngineWrapper",
    "SecureEngineRegistry",
    "secure_forward",
]
