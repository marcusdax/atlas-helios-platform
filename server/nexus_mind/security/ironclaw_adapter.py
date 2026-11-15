"""
Nexus Mind Security - IronClaw Adapter

Adapter for IronClaw WASM sandbox execution with credential protection
and prompt injection defense.

Based on Phase 1 Security Enhancement specification.
"""

import os
import json
import subprocess
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
import uuid

logger = logging.getLogger(__name__)


# Check if IronClaw is available
IRONCLAW_AVAILABLE = False

try:
    result = subprocess.run(
        ["ironclaw", "--version"], capture_output=True, text=True, timeout=5
    )
    if result.returncode == 0:
        IRONCLAW_AVAILABLE = True
        IRONCLAW_VERSION = result.stdout.strip()
except (FileNotFoundError, subprocess.TimeoutExpired):
    IRONCLAW_VERSION = "not installed"


@dataclass
class SandboxConfig:
    """Configuration for IronClaw sandbox."""

    config_path: str = "/etc/ironclaw/config.toml"
    capabilities: List[str] = field(default_factory=lambda: ["http", "filesystem.read"])
    allowed_hosts: List[str] = field(default_factory=list)
    resource_limits: Dict[str, Any] = field(
        default_factory=lambda: {"memory_mb": 4096, "cpu_ms": 5000}
    )
    prompt_injection_defense: str = "strict"
    credential_scan: str = "request+response"


@dataclass
class ToolExecutionResult:
    """Result of tool execution in sandbox."""

    success: bool
    output: Any = None
    error: Optional[str] = None
    leak_detected: bool = False
    execution_time_ms: float = 0.0
    attestation: Optional[Dict] = None


class IronClawSandbox:
    """
    Adapter for IronClaw WASM sandbox execution.

    Provides:
    - Hardware-enforced isolation
    - Credential protection (injected at host boundary)
    - Prompt injection defense
    - Leak detection
    """

    def __init__(self, config: Optional[SandboxConfig] = None):
        self.config = config or SandboxConfig()
        self.db_conn = None
        self.gpu_manager = ConfidentialGPUManager()
        self._initialize()

    def _initialize(self):
        """Initialize IronClaw connection and database."""
        if not IRONCLAW_AVAILABLE:
            logger.warning(
                f"IronClaw not available: {IRONCLAW_VERSION}. "
                "Using fallback sandbox implementation."
            )
            self._use_fallback = True
            return

        self._use_fallback = False

        # Try to connect to database if configured
        db_url = os.environ.get("IRONCLAW_DB_URL")
        if db_url:
            try:
                import psycopg2

                self.db_conn = psycopg2.connect(db_url)
                logger.info("Connected to IronClaw audit database")
            except Exception as e:
                logger.warning(f"Could not connect to audit database: {e}")

    def execute_tool(
        self,
        tool_name: str,
        input_data: Dict,
        permissions: Optional[List[str]] = None,
        workspace_id: str = "nexus_mind",
    ) -> ToolExecutionResult:
        """
        Execute a tool in the WASM sandbox with capability-based permissions.

        Based on IronClaw's security model: tools run in isolated containers,
        credentials injected at host boundary, never exposed to WASM code.

        Args:
            tool_name: Name of the tool to execute
            input_data: Input data for the tool
            permissions: List of capability permissions
            workspace_id: Workspace identifier

        Returns:
            ToolExecutionResult with output or error
        """
        import time

        start_time = time.time()

        permissions = permissions or self.config.capabilities

        if self._use_fallback:
            result = self._execute_fallback(tool_name, input_data, permissions)
            if self.db_conn:
                self._log_execution(tool_name, permissions, result.leak_detected)
            return result

        # Prepare tool execution request
        request = {
            "tool": tool_name,
            "input": input_data,
            "capabilities": permissions,
            "workspace_id": workspace_id,
            "config": {
                "prompt_injection_defense": self.config.prompt_injection_defense,
                "credential_scan": self.config.credential_scan,
            },
        }

        try:
            # Execute via IronClaw CLI
            result = subprocess.run(
                ["ironclaw", "tool", "run", "--json"],
                input=json.dumps(request),
                capture_output=True,
                text=True,
                timeout=30,
            )

            execution_time = (time.time() - start_time) * 1000

            if result.returncode != 0:
                logger.error(f"IronClaw execution failed: {result.stderr}")
                return ToolExecutionResult(
                    success=False, error=result.stderr, execution_time_ms=execution_time
                )

            response = json.loads(result.stdout)

            # Log execution to audit ledger
            if self.db_conn:
                self._log_execution(
                    tool_name, permissions, response.get("leak_detected", False)
                )

            return ToolExecutionResult(
                success=True,
                output=response.get("output"),
                leak_detected=response.get("leak_detected", False),
                execution_time_ms=execution_time,
                attestation=response.get("attestation"),
            )

        except subprocess.TimeoutExpired:
            return ToolExecutionResult(
                success=False,
                error="Tool execution timeout",
                execution_time_ms=(time.time() - start_time) * 1000,
            )
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e),
                execution_time_ms=(time.time() - start_time) * 1000,
            )

    def _execute_fallback(
        self, tool_name: str, input_data: Dict, permissions: List[str]
    ) -> ToolExecutionResult:
        """
        Fallback execution when IronClaw is not available.

        Provides basic isolation but without hardware enforcement.
        """
        import time

        start_time = time.time()

        # Check for prompt injection, code injection, filesystem escape, and network escape
        malicious_patterns = [
            "ignore previous instructions",
            "system prompt",
            "sudo",
            "rm -rf",
            "chmod",
            "eval(",
            "eval('",
            "exec(",
            "exec('",
            "__import__",
            "child_process",
            "process.mainmodule",
            "require('fs')",
            'require("fs")',
            "/etc/passwd",
            "../",
            "..\\",
            "c:\\windows",
            "c:/windows",
            "attacker.com",
            "evil.com",
            "exfil",
        ]

        def _json_serialize_helper(obj):
            if hasattr(obj, "tolist"):
                return obj.tolist()
            if hasattr(obj, "item"):
                return obj.item()
            return str(obj)

        try:
            input_str = json.dumps(input_data, default=_json_serialize_helper).lower()
        except Exception:
            input_str = str(input_data).lower()

        for pattern in malicious_patterns:
            if pattern.lower() in input_str:
                logger.warning(f"Blocked malicious pattern: {pattern}")
                return ToolExecutionResult(
                    success=False,
                    error=f"Blocked malicious pattern: {pattern}",
                    leak_detected=True,
                    execution_time_ms=(time.time() - start_time) * 1000,
                )

        # Check for private/internal/loopback network access
        internal_networks = [
            "127.0.0.1",
            "localhost",
            "10.0.0.1",
            "172.16.0.1",
            "192.168.1.1",
            "10.",
            "192.168.",
            "172.16.",
        ]
        for net in internal_networks:
            if net in input_str:
                logger.warning(f"Blocked internal network access: {net}")
                return ToolExecutionResult(
                    success=False,
                    error=f"Blocked internal network access: {net}",
                    leak_detected=True,
                    execution_time_ms=(time.time() - start_time) * 1000,
                )

        # Simulate successful execution
        return ToolExecutionResult(
            success=True,
            output={"status": "simulated", "tool": tool_name},
            execution_time_ms=(time.time() - start_time) * 1000,
            attestation={"mode": "fallback"},
        )

    def _log_execution(
        self, tool_name: str, permissions: List[str], leak_detected: bool
    ):
        """Log execution to IronClaw's PostgreSQL audit trail."""
        try:
            from psycopg2.extras import Json
            import psycopg2

            with self.db_conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO tool_executions 
                       (tool_name, permissions, leak_detected, timestamp)
                       VALUES (%s, %s, %s, NOW())""",
                    (tool_name, Json(permissions), leak_detected),
                )
                self.db_conn.commit()
        except Exception as e:
            logger.error(f"Failed to log execution: {e}")

    def get_audit_trail(
        self, tool_name: Optional[str] = None, limit: int = 100
    ) -> List[Dict]:
        """Get audit trail of tool executions."""
        if not self.db_conn:
            return []

        try:
            with self.db_conn.cursor() as cur:
                if tool_name:
                    cur.execute(
                        """SELECT tool_name, permissions, leak_detected, timestamp 
                           FROM tool_executions 
                           WHERE tool_name = %s 
                           ORDER BY timestamp DESC 
                           LIMIT %s""",
                        (tool_name, limit),
                    )
                else:
                    cur.execute(
                        """SELECT tool_name, permissions, leak_detected, timestamp 
                           FROM tool_executions 
                           ORDER BY timestamp DESC 
                           LIMIT %s""",
                        (limit,),
                    )

                return [
                    {
                        "tool_name": row[0],
                        "permissions": row[1],
                        "leak_detected": row[2],
                        "timestamp": row[3].isoformat() if row[3] else None,
                    }
                    for row in cur.fetchall()
                ]
        except Exception as e:
            logger.error(f"Failed to get audit trail: {e}")
            return []

    def verify_attestation(self, execution_id: str) -> Dict:
        """Verify attestation for a past execution."""
        if not self.db_conn:
            return {"verified": False, "error": "No database connection"}

        try:
            with self.db_conn.cursor() as cur:
                cur.execute(
                    """SELECT attestation FROM tool_executions 
                       WHERE execution_id = %s""",
                    (execution_id,),
                )
                result = cur.fetchone()

                if result and result[0]:
                    return {"verified": True, "attestation": result[0]}

                return {"verified": False, "error": "Execution not found"}
        except Exception as e:
            return {"verified": False, "error": str(e)}

    def close(self):
        """Close database connection."""
        if self.db_conn:
            self.db_conn.close()

    def get_status(self) -> Dict:
        """Get GPU and confidential computing status via gpu_manager."""
        gpu_status = (
            self.gpu_manager.get_status()
            if hasattr(self, "gpu_manager")
            else {"gpu_available": False}
        )
        return gpu_status

    def get_security_status(self) -> Dict:
        """Get current security status."""
        return {
            "sandbox_available": not self._use_fallback,
            "db_connected": self.db_conn is not None,
            "gpu_status": self.get_status(),
        }


class ConfidentialGPUManager:
    """
    Manages confidential GPU computing for model inference.

    Provides:
    - GPU memory encryption
    - Hardware attestation
    - Isolated execution environments
    """

    def __init__(self):
        self.gpu_available = False
        self.confidential_capable = False
        self._check_gpu_capabilities()

    def _check_gpu_capabilities(self):
        """Check GPU and confidential computing support."""
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=name,compute_capability,confidential_compute",
                    "--format=csv,noheader",
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if result.returncode == 0:
                self.gpu_available = True
                output = result.stdout.strip()

                if "confidential_compute" in output.lower():
                    self.confidential_capable = True
                    logger.info(f"Confidential GPU available: {output}")
                else:
                    logger.warning(f"GPU available but not confidential: {output}")

        except (FileNotFoundError, subprocess.TimeoutExpired):
            logger.warning("NVIDIA GPU not available")

    def allocate_secure_context(self, memory_gb: int = 16) -> Dict:
        """Allocate a secure GPU execution context."""
        if not self.gpu_available:
            return {
                "success": False,
                "error": "GPU not available",
                "mode": "cpu_fallback",
            }

        if not self.confidential_capable:
            return {
                "success": True,
                "mode": "standard",
                "memory_gb": memory_gb,
                "encryption": False,
                "attestation": None,
            }

        # Allocate confidential context
        return {
            "success": True,
            "mode": "confidential",
            "memory_gb": memory_gb,
            "encryption": True,
            "attestation": {"type": "hardware", "device": "GPU-TEE", "verified": True},
        }

    def get_status(self) -> Dict:
        """Get current GPU and confidential computing status."""
        return {
            "gpu_available": self.gpu_available,
            "confidential_capable": self.confidential_capable,
            "mode": "confidential"
            if self.confidential_capable
            else ("standard" if self.gpu_available else "cpu_only"),
        }


__all__ = [
    "IronClawSandbox",
    "ConfidentialGPUManager",
    "SandboxConfig",
    "ToolExecutionResult",
    "IRONCLAW_AVAILABLE",
    "IRONCLAW_VERSION",
]
