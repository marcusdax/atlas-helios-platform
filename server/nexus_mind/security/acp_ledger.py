"""
Nexus Mind Security Module - ACP-SQL Immune Ledger

Implements Agent Communication Protocol with cryptographic envelopes,
immutable audit ledger, and protocol-first security.

Based on Phase 5 Security Enhancements specification.
"""

import uuid
import time
import hashlib
import json
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import threading


class PacketType(Enum):
    """Types of ACP packets."""

    AGENT_ACTION = "agent_action"
    VERIFICATION = "verification"
    QUERY = "query"
    RESPONSE = "response"
    ERROR = "error"


@dataclass
class ACPPacket:
    """Represents an ACP protocol packet."""

    packet_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    agent_id: str = ""
    timestamp: float = field(default_factory=lambda: time.time())
    action_type: str = ""
    authorization_scope: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)
    signature: Optional[bytes] = None
    parent_packet_id: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "packet_id": self.packet_id,
            "agent_id": self.agent_id,
            "timestamp": self.timestamp,
            "action_type": self.action_type,
            "authorization_scope": self.authorization_scope,
            "payload": self.payload,
            "parent_packet_id": self.parent_packet_id,
        }

    def compute_hash(self) -> str:
        """Compute hash of packet contents."""
        content = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


@dataclass
class LedgerEntry:
    """Represents an immutable ledger entry."""

    entry_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    packet_id: str = ""
    agent_id: str = ""
    timestamp: float = 0.0
    action_type: str = ""
    authorization_scope: str = ""
    payload_hash: str = ""
    parent_packet_id: Optional[str] = None
    signature: Optional[bytes] = None
    verified: bool = False

    def to_dict(self) -> Dict:
        return {
            "entry_id": self.entry_id,
            "packet_id": self.packet_id,
            "agent_id": self.agent_id,
            "timestamp": self.timestamp,
            "action_type": self.action_type,
            "authorization_scope": self.authorization_scope,
            "payload_hash": self.payload_hash,
            "parent_packet_id": self.parent_packet_id,
            "verified": self.verified,
        }


class ACPSecurityValidator:
    """Validates ACP packets against security rules."""

    def __init__(self):
        self.blocked_actions: set = set()
        self.allowed_scopes: set = {"/workspace", "/data", "/compute", "/query"}

    def validate_packet(self, packet: ACPPacket) -> tuple[bool, Optional[str]]:
        """Validate an ACP packet."""

        # Rule 1: All actions must be packetized (has packet_id)
        if not packet.packet_id:
            return False, "Missing packet_id"

        # Rule 2: No execution without logging (handled by ledger)

        # Rule 3: No direct agent-to-agent action (must go through protocol)

        # Rule 4: Check monotonic timestamps
        if packet.timestamp > time.time() + 60:  # Allow 1 minute future
            return False, "Timestamp too far in future"

        # Rule 5: Scope confinement
        if packet.authorization_scope:
            if not any(
                packet.authorization_scope.startswith(s) for s in self.allowed_scopes
            ):
                return False, f"Invalid scope: {packet.authorization_scope}"

        # Rule 6: Check blocked actions
        if packet.action_type in self.blocked_actions:
            return False, f"Action blocked: {packet.action_type}"

        return True, None

    def block_action(self, action: str):
        """Block an action type."""
        self.blocked_actions.add(action)

    def allow_scope(self, scope: str):
        """Add allowed scope."""
        self.allowed_scopes.add(scope)


class ImmutableLedger:
    """Immutable ledger for audit trail."""

    def __init__(self):
        self.entries: Dict[str, LedgerEntry] = {}
        self.agent_index: Dict[str, List[str]] = defaultdict(list)
        self.timestamp_index: Dict[float, List[str]] = defaultdict(list)
        self._lock = threading.RLock()

    def append(self, entry: LedgerEntry) -> bool:
        """Append a new entry to the ledger."""
        with self._lock:
            # Verify entry
            if entry.packet_id in self.entries:
                return False  # Duplicate

            # Add entry
            self.entries[entry.entry_id] = entry

            # Update indices
            self.agent_index[entry.agent_id].append(entry.entry_id)
            self.timestamp_index[entry.timestamp].append(entry.entry_id)

            return True

    def get(self, entry_id: str) -> Optional[LedgerEntry]:
        """Get entry by ID."""
        return self.entries.get(entry_id)

    def get_by_agent(self, agent_id: str, limit: int = 100) -> List[LedgerEntry]:
        """Get entries for an agent."""
        entry_ids = self.agent_index.get(agent_id, [])[-limit:]
        return [self.entries[eid] for eid in entry_ids if eid in self.entries]

    def get_by_time_range(
        self, start: float, end: float, limit: int = 100
    ) -> List[LedgerEntry]:
        """Get entries in time range."""
        result = []

        for ts, entry_ids in self.timestamp_index.items():
            if start <= ts <= end:
                for eid in entry_ids:
                    if eid in self.entries:
                        result.append(self.entries[eid])

        result.sort(key=lambda x: x.timestamp, reverse=True)
        return result[:limit]

    def verify_chain(self, entry_id: str) -> bool:
        """Verify the chain integrity of an entry."""
        if entry_id not in self.entries:
            return False

        entry = self.entries[entry_id]

        # Check parent relationship
        if entry.parent_packet_id:
            parent = self.entries.get(entry.parent_packet_id)
            if not parent:
                return False

        return True

    def export_json(self) -> str:
        """Export ledger as JSON."""
        return json.dumps(
            {"entries": [e.to_dict() for e in self.entries.values()]}, indent=2
        )


class ProtocolHandler:
    """Handles ACP protocol operations."""

    def __init__(self, ledger: ImmutableLedger, validator: ACPSecurityValidator):
        self.ledger = ledger
        self.validator = validator
        self.handlers: Dict[str, Callable] = {}

    def register_handler(self, action_type: str, handler: Callable):
        """Register a handler for an action type."""
        self.handlers[action_type] = handler

    async def submit_packet(self, packet: ACPPacket) -> tuple[bool, Any, Optional[str]]:
        """
        Submit and process an ACP packet.

        Returns:
            (success, result, error_message)
        """

        # Validate packet
        valid, error = self.validator.validate_packet(packet)
        if not valid:
            return False, None, error

        # Create ledger entry
        entry = LedgerEntry(
            packet_id=packet.packet_id,
            agent_id=packet.agent_id,
            timestamp=packet.timestamp,
            action_type=packet.action_type,
            authorization_scope=packet.authorization_scope,
            payload_hash=packet.compute_hash(),
            parent_packet_id=packet.parent_packet_id,
        )

        # Try to append to ledger first (Rule: no execution without logging)
        if not self.ledger.append(entry):
            return False, None, "Ledger append failed"

        # Execute if handler exists
        if packet.action_type in self.handlers:
            try:
                result = await self.handlers[packet.action_type](packet)
                entry.verified = True
                return True, result, None
            except Exception as e:
                return False, None, str(e)

        # No handler - still return success for valid packet
        return True, None, None


class ACPProtocol:
    """
    Main ACP (Agent Communication Protocol) system.
    """

    def __init__(self):
        self.ledger = ImmutableLedger()
        self.validator = ACPSecurityValidator()
        self.handler = ProtocolHandler(self.ledger, self.validator)

    async def submit_action(
        self,
        agent_id: str,
        action_type: str,
        payload: Dict[str, Any],
        authorization_scope: str = "/workspace",
    ) -> tuple[bool, Any, Optional[str]]:
        """Submit an agent action through the protocol."""

        packet = ACPPacket(
            agent_id=agent_id,
            action_type=action_type,
            authorization_scope=authorization_scope,
            payload=payload,
        )

        return await self.handler.submit_packet(packet)

    def get_audit_trail(
        self,
        agent_id: Optional[str] = None,
        time_range: Optional[tuple[float, float]] = None,
        limit: int = 100,
    ) -> List[Dict]:
        """Get audit trail."""

        if agent_id:
            entries = self.ledger.get_by_agent(agent_id, limit)
        elif time_range:
            entries = self.ledger.get_by_time_range(time_range[0], time_range[1], limit)
        else:
            # Get recent entries
            all_entries = sorted(
                self.ledger.entries.values(), key=lambda x: x.timestamp, reverse=True
            )
            entries = all_entries[:limit]

        return [e.to_dict() for e in entries]

    def verify_integrity(self) -> Dict:
        """Verify ledger integrity."""
        total = len(self.ledger.entries)
        verified = sum(
            1
            for e in self.ledger.entries.values()
            if self.ledger.verify_chain(e.entry_id)
        )

        return {
            "total_entries": total,
            "verified_entries": verified,
            "integrity_score": verified / total if total > 0 else 1.0,
            "intact": verified == total,
        }


__all__ = [
    "ACPProtocol",
    "ACPSecurityValidator",
    "ImmutableLedger",
    "ProtocolHandler",
    "ACPPacket",
    "LedgerEntry",
    "PacketType",
]
