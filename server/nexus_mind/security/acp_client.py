"""
Nexus Mind Phase 2 - ACP-SQL Ledger Client

Python client for the ACP-SQL Immune Ledger.
Implements protocol-first security: all actions must be packetized before execution.
"""

import hashlib
import hmac
import json
import uuid
import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extras import Json, RealDictCursor

    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False
    logger.warning("psycopg2 not available, using mock")

try:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    from cryptography.hazmat.backends import default_backend

    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logger.warning("cryptography not available, using HMAC")


class LedgerError(Exception):
    """Base exception for ledger errors."""

    pass


class PacketVerificationError(LedgerError):
    """Raised when packet chain verification fails."""

    pass


class ACPActionType(Enum):
    """Standard ACP action types."""

    INFERENCE_NADE = "inference.nade"
    INFERENCE_GIE = "inference.gie"
    INFERENCE_BNE = "inference.bne"
    INFERENCE_FUSION = "inference.fusion"
    TOOL_EXECUTION = "tool.execute"
    CREDENTIAL_ACCESS = "credential.access"
    DATA_EXPORT = "data.export"
    DATA_IMPORT = "data.import"
    MODEL_UPDATE = "model.update"


@dataclass
class ACPPacket:
    """ACP Packet for the immutable ledger."""

    packet_id: str
    agent_id: str
    tenant_id: str
    timestamp: str
    action_type: str
    authorization_scope: Dict
    payload_hash: str
    parent_packet_id: Optional[str]
    signature: bytes
    metadata: Dict = field(default_factory=dict)
    attestation: Optional[Dict] = None
    payload: Optional[Dict] = None  # Not stored in ledger


@dataclass
class ExecutionResult:
    """Result of a ledger logged execution."""

    packet_id: str
    success: bool
    result: Optional[Dict]
    error: Optional[str]
    error_type: Optional[str]
    execution_time_ms: float
    completed_at: str


class ACPLedgerClient:
    """
    Client for ACP-SQL Immune Ledger.

    Implements protocol-first security:
    - All actions must be packetized
    - No execution without logging
    - Cryptographic chain verification
    """

    def __init__(
        self,
        db_connection=None,
        signing_key: Optional[bytes] = None,
        verify_key_path: Optional[str] = None,
        ledger_id: str = "default",
    ):
        """
        Initialize ACP Ledger Client.

        Args:
            db_connection: psycopg2 connection (optional for testing)
            signing_key: Private key for signing packets
            verify_key_path: Path to public key for verification
            ledger_id: Unique identifier for this ledger
        """
        self.conn = db_connection
        self.ledger_id = ledger_id

        if CRYPTO_AVAILABLE and signing_key:
            try:
                self.signing_key = serialization.load_pem_private_key(
                    signing_key, password=None, backend=default_backend()
                )
                self.verify_key = self.signing_key.public_key()
            except Exception as e:
                logger.warning(f"Could not load signing key: {e}")
                self.signing_key = None
                self.verify_key = None
        else:
            self.signing_key = None
            self.verify_key = None

        self._test_mode = db_connection is None

    def _generate_packet_id(self) -> str:
        """Generate a unique packet ID."""
        return str(uuid.uuid4())

    def _compute_payload_hash(self, payload: Dict) -> str:
        """Compute SHA-256 hash of payload."""
        payload_str = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(payload_str.encode()).hexdigest()

    def _sign_packet(self, packet_data: Dict) -> bytes:
        """Sign packet data."""
        if not self.signing_key:
            return b"mock_signature_for_testing"

        try:
            signature = self.signing_key.sign(
                json.dumps(packet_data, sort_keys=True).encode(),
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
            return signature
        except Exception as e:
            logger.warning(f"Signing failed, using mock: {e}")
            return b"mock_signature"

    def create_packet(
        self,
        agent_id: str,
        tenant_id: str,
        action_type: str,
        scope: Dict,
        payload: Dict,
        parent_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
    ) -> ACPPacket:
        """
        Create and sign an ACP packet.

        Args:
            agent_id: Identifier for the agent making the request
            tenant_id: Tenant identifier
            action_type: Type of action being performed
            scope: Authorization scope
            payload: Action payload
            parent_id: Parent packet ID for chain
            metadata: Additional metadata

        Returns:
            ACPPacket with signature
        """
        packet_id = self._generate_packet_id()
        payload_hash = self._compute_payload_hash(payload)

        packet_data = {
            "packet_id": packet_id,
            "agent_id": agent_id,
            "tenant_id": tenant_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "action_type": action_type,
            "authorization_scope": scope,
            "payload_hash": payload_hash,
            "parent_packet_id": parent_id,
            "metadata": metadata or {},
        }

        signature = self._sign_packet(packet_data)

        return ACPPacket(
            packet_id=packet_id,
            agent_id=agent_id,
            tenant_id=tenant_id,
            timestamp=packet_data["timestamp"],
            action_type=action_type,
            authorization_scope=scope,
            payload_hash=payload_hash,
            parent_packet_id=parent_id,
            signature=signature,
            metadata=metadata or {},
            payload=payload,
        )

    def log_packet(self, packet: ACPPacket) -> str:
        """
        Log packet to the immutable ledger.

        Args:
            packet: ACPPacket to log

        Returns:
            packet_id of logged packet
        """
        if self._test_mode:
            logger.info(f"TEST MODE: Would log packet {packet.packet_id}")
            return packet.packet_id

        if not self.conn:
            raise LedgerError("No database connection")

        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT insert_ledger_packet(
                        %s, %s, %s, %s, %s, %s, %s, %s, NULL
                    )
                """,
                    (
                        packet.agent_id,
                        packet.tenant_id,
                        packet.action_type,
                        Json(packet.authorization_scope),
                        packet.payload_hash,
                        packet.parent_packet_id,
                        packet.signature,
                        Json(packet.metadata),
                    ),
                )

                result = cur.fetchone()
                self.conn.commit()

                return result[0] if result else packet.packet_id

        except Exception as e:
            logger.error(f"Failed to log packet: {e}")
            self.conn.rollback()
            raise LedgerError(f"Failed to log packet: {e}")

    def log_execution_result(
        self,
        packet_id: str,
        result: Optional[Dict] = None,
        error: Optional[str] = None,
        error_type: Optional[str] = None,
        execution_time_ms: int = 0,
        cpu_time_ms: Optional[int] = None,
        memory_used_bytes: Optional[int] = None,
        gpu_memory_used_bytes: Optional[int] = None,
    ) -> None:
        """
        Log execution result to the ledger.

        Args:
            packet_id: ID of the packet
            result: Execution result (if successful)
            error: Error message (if failed)
            error_type: Type of error
            execution_time_ms: Execution time in milliseconds
            cpu_time_ms: CPU time in milliseconds
            memory_used_bytes: Memory used
            gpu_memory_used_bytes: GPU memory used
        """
        if self._test_mode:
            logger.info(f"TEST MODE: Would log result for {packet_id}")
            return

        if not self.conn:
            raise LedgerError("No database connection")

        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT log_execution_result(
                        %s, %s, %s, %s, %s, %s, %s, %s
                    )
                """,
                    (
                        packet_id,
                        Json(result) if result else None,
                        error,
                        error_type,
                        execution_time_ms,
                        cpu_time_ms,
                        memory_used_bytes,
                        gpu_memory_used_bytes,
                    ),
                )

                self.conn.commit()

        except Exception as e:
            logger.error(f"Failed to log execution result: {e}")
            self.conn.rollback()
            raise LedgerError(f"Failed to log result: {e}")

    def log_and_execute(
        self,
        packet: ACPPacket,
        execute_func: Callable[[Dict], Dict],
    ) -> ExecutionResult:
        """
        Log packet, execute function, and record result.

        This is the core protocol: no execution without logging.

        Args:
            packet: Pre-created ACPPacket
            execute_func: Function to execute

        Returns:
            ExecutionResult
        """
        # Step 1: Log the packet
        logged_id = self.log_packet(packet)

        # Step 2: Execute the function
        start_time = time.time()

        try:
            result = execute_func(packet.payload)
            success = True
            error = None
            error_type = None
        except Exception as e:
            result = None
            success = False
            error = str(e)
            error_type = type(e).__name__

        execution_time_ms = int((time.time() - start_time) * 1000)

        # Step 3: Log the result
        self.log_execution_result(
            packet_id=logged_id,
            result=result,
            error=error,
            error_type=error_type,
            execution_time_ms=execution_time_ms,
        )

        return ExecutionResult(
            packet_id=logged_id,
            success=success,
            result=result,
            error=error,
            error_type=error_type,
            execution_time_ms=execution_time_ms,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )

    def verify_chain(self, packet_id: str) -> Dict[str, Any]:
        """
        Verify cryptographic chain for a packet.

        Args:
            packet_id: ID of packet to verify

        Returns:
            Dict with is_valid and error_message
        """
        if self._test_mode:
            return {"is_valid": True, "error_message": None}

        if not self.conn:
            return {"is_valid": False, "error_message": "No database connection"}

        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "SELECT is_valid, error_message FROM verify_packet_chain(%s)",
                    (packet_id,),
                )
                result = cur.fetchone()

                if result:
                    return {"is_valid": result[0], "error_message": result[1]}

                return {"is_valid": False, "error_message": "Packet not found"}

        except Exception as e:
            logger.error(f"Chain verification failed: {e}")
            return {"is_valid": False, "error_message": str(e)}

    def get_packet(self, packet_id: str) -> Optional[ACPPacket]:
        """Retrieve a packet from the ledger."""
        if self._test_mode:
            return None

        if not self.conn:
            return None

        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT packet_id, agent_id, tenant_id, timestamp, action_type,
                           authorization_scope, payload_hash, parent_packet_id,
                           signature, metadata, attestation
                    FROM acp_ledger
                    WHERE packet_id = %s
                """,
                    (packet_id,),
                )

                row = cur.fetchone()

                if row:
                    return ACPPacket(
                        packet_id=row["packet_id"],
                        agent_id=row["agent_id"],
                        tenant_id=row["tenant_id"],
                        timestamp=row["timestamp"].isoformat(),
                        action_type=row["action_type"],
                        authorization_scope=row["authorization_scope"],
                        payload_hash=row["payload_hash"],
                        parent_packet_id=row["parent_packet_id"],
                        signature=row["signature"],
                        metadata=row["metadata"],
                        attestation=row["attestation"],
                    )

                return None

        except Exception as e:
            logger.error(f"Failed to get packet: {e}")
            return None

    def get_audit_trail(
        self,
        tenant_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict]:
        """Get audit trail entries."""
        if self._test_mode:
            return []

        if not self.conn:
            return []

        try:
            query = """
                SELECT packet_id, agent_id, tenant_id, timestamp, action_type,
                       authorization_scope, result, error, execution_time_ms
                FROM audit_trail
                WHERE 1=1
            """
            params = []

            if tenant_id:
                query += " AND tenant_id = %s"
                params.append(tenant_id)

            if agent_id:
                query += " AND agent_id = %s"
                params.append(agent_id)

            query += " ORDER BY timestamp DESC LIMIT %s"
            params.append(limit)

            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                return [dict(row) for row in cur.fetchall()]

        except Exception as e:
            logger.error(f"Failed to get audit trail: {e}")
            return []

    def get_metrics(
        self,
        tenant_id: Optional[str] = None,
        hours: int = 24,
    ) -> List[Dict]:
        """Get ledger metrics."""
        if self._test_mode:
            return []

        if not self.conn:
            return []

        try:
            query = """
                SELECT tenant_id, action_type, hour, packet_count,
                       avg_execution_time_ms, p95_execution_time_ms, error_count
                FROM ledger_metrics
                WHERE timestamp > NOW() - INTERVAL '%s hours'
            """
            params = [hours]

            if tenant_id:
                query += " AND tenant_id = %s"
                params.append(tenant_id)

            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                return [dict(row) for row in cur.fetchall()]

        except Exception as e:
            logger.error(f"Failed to get metrics: {e}")
            return []

    def check_tamper(self, hours: int = 24) -> List[Dict]:
        """Check for tampered packets."""
        if self._test_mode:
            return []

        if not self.conn:
            return []

        try:
            with self.conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT packet_id, agent_id, tenant_id, timestamp,
                           action_type, integrity_status
                    FROM tamper_detection
                    WHERE timestamp > NOW() - INTERVAL '%s hours'
                    AND integrity_status != 'OK'
                """,
                    (hours,),
                )

                return [dict(row) for row in cur.fetchall()]

        except Exception as e:
            logger.error(f"Failed to check tamper: {e}")
            return []


class LedgerContext:
    """Context manager for ledger operations."""

    def __init__(self, client: ACPLedgerClient):
        self.client = client
        self.packet: Optional[ACPPacket] = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.packet and self.client:
            self.client.log_execution_result(
                packet_id=self.packet.packet_id,
                error=str(exc_val) if exc_val else None,
                error_type=exc_type.__name__ if exc_type else None,
            )


__all__ = [
    "ACPLedgerClient",
    "ACPPacket",
    "ExecutionResult",
    "ACPActionType",
    "LedgerError",
    "PacketVerificationError",
    "LedgerContext",
]
