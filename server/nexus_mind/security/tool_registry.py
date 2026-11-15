"""
Nexus Mind Security - Tool Registry

Manages registration and lifecycle of tools that run in the IronClaw WASM sandbox.
"""

import json
import hashlib
import logging
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class ToolStatus(Enum):
    """Tool registration status."""

    REGISTERED = "registered"
    ACTIVE = "active"
    DEPRECATED = "deprecated"
    DISABLED = "disabled"


class ToolCapability(Enum):
    """Available tool capabilities."""

    HTTP = "http"
    FILESYSTEM_READ = "filesystem.read"
    FILESYSTEM_WRITE = "filesystem.write"
    COMPUTE_CPU = "compute:cpu"
    COMPUTE_GPU = "compute:gpu"
    NETWORK_INTERNAL = "network:internal"
    NETWORK_EXTERNAL = "network:external"
    ENV_READ = "env:read"


@dataclass
class ToolMetadata:
    """Metadata for a registered tool."""

    tool_id: str
    name: str
    version: str
    description: str
    entry_point: str
    capabilities: List[ToolCapability]
    resource_limits: Dict[str, Any] = field(default_factory=dict)
    environment_vars: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    status: ToolStatus = ToolStatus.REGISTERED
    wasm_path: Optional[str] = None
    hash: Optional[str] = None


@dataclass
class ToolExecution:
    """Record of a tool execution."""

    execution_id: str
    tool_id: str
    input_hash: str
    output_hash: Optional[str]
    status: str
    start_time: datetime
    end_time: Optional[datetime]
    error: Optional[str]
    permissions_used: List[str]


class ToolRegistry:
    """
    Registry for managing tools that run in WASM sandbox.

    Provides:
    - Tool registration and versioning
    - Capability-based access control
    - Resource limit enforcement
    - Execution tracking
    """

    def __init__(self, db_conn=None):
        self.db_conn = db_conn
        self._tools: Dict[str, ToolMetadata] = {}
        self._executing: Dict[str, ToolExecution] = {}
        self._load_tools()

    def _load_tools(self):
        """Load tools from database if available."""
        if not self.db_conn:
            self._register_default_tools()
            return

        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor

            with self.db_conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM registered_tools WHERE status = 'active'")
                rows = cur.fetchall()

                for row in rows:
                    tool = ToolMetadata(
                        tool_id=row["tool_id"],
                        name=row["name"],
                        version=row["version"],
                        description=row["description"],
                        entry_point=row["entry_point"],
                        capabilities=[ToolCapability(c) for c in row["capabilities"]],
                        resource_limits=row.get("resource_limits", {}),
                        status=ToolStatus(row["status"]),
                        wasm_path=row.get("wasm_path"),
                        hash=row.get("hash"),
                    )
                    self._tools[tool.tool_id] = tool

                logger.info(f"Loaded {len(self._tools)} tools from database")

        except Exception as e:
            logger.warning(f"Could not load tools from database: {e}")
            self._register_default_tools()

    def _register_default_tools(self):
        """Register default Nexus Mind tools."""
        default_tools = [
            ToolMetadata(
                tool_id="nade_detector",
                name="NADE Detector",
                version="1.0.0",
                description="Neuromorphic Anomaly Detection Engine",
                entry_point="detect_anomaly",
                capabilities=[ToolCapability.COMPUTE_GPU, ToolCapability.COMPUTE_CPU],
                resource_limits={"memory_mb": 4096, "gpu_memory_mb": 8192},
            ),
            ToolMetadata(
                tool_id="gie_analyzer",
                name="GIE Analyzer",
                version="1.0.0",
                description="Geospatial Intelligence Engine",
                entry_point="analyze_image",
                capabilities=[
                    ToolCapability.COMPUTE_GPU,
                    ToolCapability.FILESYSTEM_READ,
                ],
                resource_limits={"memory_mb": 8192, "gpu_memory_mb": 16384},
            ),
            ToolMetadata(
                tool_id="bne_predictor",
                name="BNE Predictor",
                version="1.0.0",
                description="Behavioral Neurolinguistics Engine",
                entry_point="predict_intent",
                capabilities=[ToolCapability.COMPUTE_GPU, ToolCapability.COMPUTE_CPU],
                resource_limits={"memory_mb": 4096, "gpu_memory_mb": 8192},
            ),
            ToolMetadata(
                tool_id="fusion_engine",
                name="Fusion Engine",
                version="1.0.0",
                description="Multi-engine fusion coordinator",
                entry_point="fuse_outputs",
                capabilities=[
                    ToolCapability.COMPUTE_GPU,
                    ToolCapability.NETWORK_INTERNAL,
                ],
                resource_limits={"memory_mb": 8192, "gpu_memory_mb": 16384},
            ),
        ]

        for tool in default_tools:
            self._tools[tool.tool_id] = tool

        logger.info(f"Registered {len(default_tools)} default tools")

    def register_tool(
        self,
        name: str,
        version: str,
        description: str,
        entry_point: str,
        capabilities: List[ToolCapability],
        wasm_path: Optional[str] = None,
        resource_limits: Optional[Dict[str, Any]] = None,
    ) -> ToolMetadata:
        """Register a new tool in the registry."""
        # Validate tool registration against malicious / unauthorized indicators
        combined = f"{name} {description} {entry_point}".lower()
        malicious_indicators = [
            "malicious",
            "steal",
            "exfiltrate",
            "backdoor",
            "trojan",
            "unauthorized",
            "exploit",
        ]
        if any(indicator in combined for indicator in malicious_indicators):
            logger.warning(f"Registration blocked for malicious tool: {name}")
            raise ValueError(f"Malicious tool registration blocked: {name}")

        tool_id = hashlib.sha256(f"{name}:{version}".encode()).hexdigest()[:16]

        tool = ToolMetadata(
            tool_id=tool_id,
            name=name,
            version=version,
            description=description,
            entry_point=entry_point,
            capabilities=capabilities,
            resource_limits=resource_limits or {},
            status=ToolStatus.ACTIVE,
            wasm_path=wasm_path,
        )

        if wasm_path:
            tool.hash = self._compute_wasm_hash(wasm_path)

        self._tools[tool_id] = tool

        if self.db_conn:
            self._save_tool_to_db(tool)

        logger.info(f"Registered tool: {name} v{version} ({tool_id})")
        return tool

    def _compute_wasm_hash(self, wasm_path: str) -> str:
        """Compute SHA-256 hash of WASM binary."""
        import hashlib

        with open(wasm_path, "rb") as f:
            return hashlib.sha256(f.read()).hexdigest()

    def _save_tool_to_db(self, tool: ToolMetadata):
        """Save tool to database."""
        try:
            import psycopg2
            from psycopg2.extras import Json

            with self.db_conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO registered_tools 
                       (tool_id, name, version, description, entry_point, 
                        capabilities, resource_limits, status, wasm_path, hash)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT (tool_id) DO UPDATE SET
                       version = EXCLUDED.version,
                       updated_at = NOW()""",
                    (
                        tool.tool_id,
                        tool.name,
                        tool.version,
                        tool.description,
                        tool.entry_point,
                        [c.value for c in tool.capabilities],
                        Json(tool.resource_limits),
                        tool.status.value,
                        tool.wasm_path,
                        tool.hash,
                    ),
                )
                self.db_conn.commit()
        except Exception as e:
            logger.error(f"Failed to save tool to database: {e}")

    def get_tool(self, tool_id: str) -> Optional[ToolMetadata]:
        """Get a tool by ID."""
        return self._tools.get(tool_id)

    def get_tool_by_name(self, name: str) -> Optional[ToolMetadata]:
        """Get a tool by name."""
        for tool in self._tools.values():
            if tool.name == name or tool.tool_id == name or tool.name.lower() == name.lower():
                return tool
        return None

    def list_tools(
        self,
        status: Optional[ToolStatus] = None,
        capability: Optional[ToolCapability] = None,
    ) -> List[ToolMetadata]:
        """List tools with optional filtering."""
        tools = list(self._tools.values())

        if status:
            tools = [t for t in tools if t.status == status]

        if capability:
            tools = [t for t in tools if capability in t.capabilities]

        return tools

    def verify_capabilities(
        self, tool_id: str, required_capabilities: List[ToolCapability]
    ) -> bool:
        """Verify a tool has required capabilities."""
        tool = self._tools.get(tool_id)
        if not tool:
            return False

        return all(cap in tool.capabilities for cap in required_capabilities)

    def start_execution(self, tool_id: str, input_data: Dict) -> ToolExecution:
        """Record start of tool execution."""
        tool = self._tools.get(tool_id)
        if not tool:
            raise ValueError(f"Tool not found: {tool_id}")

        execution_id = str(uuid.uuid4())
        input_hash = hashlib.sha256(json.dumps(input_data).encode()).hexdigest()

        execution = ToolExecution(
            execution_id=execution_id,
            tool_id=tool_id,
            input_hash=input_hash,
            output_hash=None,
            status="running",
            start_time=datetime.now(timezone.utc),
            end_time=None,
            error=None,
            permissions_used=[c.value for c in tool.capabilities],
        )

        self._executing[execution_id] = execution
        return execution

    def complete_execution(
        self,
        execution_id: str,
        output_data: Optional[Dict] = None,
        error: Optional[str] = None,
    ):
        """Record completion of tool execution."""
        execution = self._executing.get(execution_id)
        if not execution:
            logger.warning(f"Execution not found: {execution_id}")
            return

        execution.end_time = datetime.now(timezone.utc)

        if error:
            execution.status = "failed"
            execution.error = error
        else:
            execution.status = "success"
            if output_data:
                execution.output_hash = hashlib.sha256(
                    json.dumps(output_data).encode()
                ).hexdigest()

        if self.db_conn:
            self._save_execution_to_db(execution)

    def _save_execution_to_db(self, execution: ToolExecution):
        """Save execution record to database."""
        try:
            import psycopg2
            from psycopg2.extras import Json

            with self.db_conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO tool_executions 
                       (execution_id, tool_id, input_hash, output_hash, 
                        status, start_time, end_time, error, permissions_used)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (
                        execution.execution_id,
                        execution.tool_id,
                        execution.input_hash,
                        execution.output_hash,
                        execution.status,
                        execution.start_time,
                        execution.end_time,
                        execution.error,
                        Json(execution.permissions_used),
                    ),
                )
                self.db_conn.commit()
        except Exception as e:
            logger.error(f"Failed to save execution to database: {e}")

    def get_execution_history(
        self, tool_id: Optional[str] = None, limit: int = 100
    ) -> List[ToolExecution]:
        """Get execution history."""
        executions = list(self._executing.values())

        if tool_id:
            executions = [e for e in executions if e.tool_id == tool_id]

        executions.sort(key=lambda e: e.start_time, reverse=True)
        return executions[:limit]


class ToolValidator:
    """Validates tool inputs and outputs for security."""

    def __init__(self):
        self._input_schemas: Dict[str, Dict] = {}
        self._output_schemas: Dict[str, Dict] = {}

    def register_schema(self, tool_id: str, input_schema: Dict, output_schema: Dict):
        """Register input/output schemas for a tool."""
        self._input_schemas[tool_id] = input_schema
        self._output_schemas[tool_id] = output_schema

    def validate_input(self, tool_id: str, data: Dict) -> bool:
        """Validate input data against schema."""
        import jsonschema

        schema = self._input_schemas.get(tool_id)
        if not schema:
            return True

        try:
            jsonschema.validate(data, schema)
            return True
        except jsonschema.ValidationError as e:
            logger.warning(f"Input validation failed for {tool_id}: {e}")
            return False


__all__ = [
    "ToolRegistry",
    "ToolValidator",
    "ToolMetadata",
    "ToolExecution",
    "ToolStatus",
    "ToolCapability",
]
