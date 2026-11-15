"""
Nexus Mind Security Module - Authority Boundary Ledger

Implements ring-based authority hierarchy, mechanical tool filtering,
and role-based access control.

Based on Phase 5 Security Enhancements specification.
"""

import uuid
import time
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict


class RingLevel(Enum):
    """Ring levels for authority."""

    CONSTITUTIONAL = 0  # Immutable: never_exfiltrate, always_audit
    ORGANIZATIONAL = 1  # Enterprise: 508(c)(1)(A), data_sovereignty
    SESSION = 2  # Request-specific limits
    APPLICATION = 3  # App-level permissions


@dataclass
class AuthorityRule:
    """Represents an authority rule."""

    rule_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    ring: RingLevel = RingLevel.SESSION
    allowed_actions: Set[str] = field(default_factory=set)
    denied_actions: Set[str] = field(default_factory=set)
    conditions: Dict[str, Any] = field(default_factory=dict)
    priority: int = 0


@dataclass
class Role:
    """Represents a user role."""

    role_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    ring_level: RingLevel = RingLevel.SESSION
    permissions: Set[str] = field(default_factory=set)
    parent_role: Optional[str] = None


@dataclass
class Session:
    """Represents a user session."""

    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    role: Optional[Role] = None
    permissions: Set[str] = field(default_factory=set)
    created_at: float = field(default_factory=lambda: time.time())
    expires_at: Optional[float] = None
    context: Dict[str, Any] = field(default_factory=dict)


class AuthorityBoundaryLedger:
    """
    Ring-based authority hierarchy system.

    Implements:
    - Ring 0 (Constitutional): Immutable rules
    - Ring 1 (Organizational): Enterprise policies
    - Ring 2 (Session): Request-specific limits
    """

    def __init__(self):
        self.rules: Dict[str, AuthorityRule] = {}
        self.roles: Dict[str, Role] = {}
        self.sessions: Dict[str, Session] = {}

        # Initialize default constitutional rules
        self._init_constitutional_rules()

    def _init_constitutional_rules(self):
        """Initialize immutable constitutional rules."""

        # Rule 1: Never exfiltrate data
        never_exfiltrate = AuthorityRule(
            name="never_exfiltrate_data",
            description="Never allow data exfiltration outside authorized channels",
            ring=RingLevel.CONSTITUTIONAL,
            denied_actions={"exfiltrate", "write_external", "send_unencrypted"},
            priority=1000,
        )
        self.add_rule(never_exfiltrate)

        # Rule 2: Always audit access
        always_audit = AuthorityRule(
            name="always_audit_access",
            description="All access must be logged",
            ring=RingLevel.CONSTITUTIONAL,
            allowed_actions={"audit"},
            priority=999,
        )
        self.add_rule(always_audit)

        # Rule 3: Require consent for learning
        require_consent = AuthorityRule(
            name="require_consent_for_learning",
            description="AI learning requires user consent",
            ring=RingLevel.CONSTITUTIONAL,
            denied_actions={"learn_from_data"},
            conditions={"requires_consent": True},
            priority=998,
        )
        self.add_rule(require_consent)

    def add_rule(self, rule: AuthorityRule):
        """Add an authority rule."""
        self.rules[rule.rule_id] = rule

    def add_role(self, role: Role):
        """Add a role."""
        self.roles[role.role_id] = role

    def create_session(self, user_id: str, role_id: str, duration: float = 3600) -> str:
        """Create a new session."""
        role = self.roles.get(role_id)

        if not role:
            raise ValueError(f"Role not found: {role_id}")

        session = Session(
            user_id=user_id,
            role=role,
            permissions=role.permissions.copy(),
            expires_at=time.time() + duration,
        )

        self.sessions[session.session_id] = session
        return session.session_id

    def authorize_action(
        self, session_id: str, action: str, context: Optional[Dict] = None
    ) -> tuple[bool, Optional[str]]:
        """Authorize an action for a session."""

        session = self.sessions.get(session_id)

        if not session:
            return False, "Invalid session"

        # Check expiration
        if session.expires_at and time.time() > session.expires_at:
            return False, "Session expired"

        # Get applicable rules
        applicable_rules = self._get_applicable_rules(session)

        # Check constitutional rules first (Ring 0)
        for rule in applicable_rules:
            if rule.ring == RingLevel.CONSTITUTIONAL:
                # Check denied actions
                if action in rule.denied_actions:
                    return False, f"Constitutionally denied: {rule.name}"

                # Check allowed actions
                if rule.allowed_actions and action not in rule.allowed_actions:
                    return False, f"Not in allowed actions: {rule.name}"

        # Check organizational rules (Ring 1)
        for rule in applicable_rules:
            if rule.ring == RingLevel.ORGANIZATIONAL:
                if action in rule.denied_actions:
                    return False, f"Organizationally denied: {rule.name}"

        # Check session rules (Ring 2)
        for rule in applicable_rules:
            if rule.ring == RingLevel.SESSION:
                # Check conditions
                if rule.conditions:
                    context = context or {}
                    for key, value in rule.conditions.items():
                        if context.get(key) != value:
                            continue

                        if action in rule.denied_actions:
                            return False, f"Session denied: {rule.name}"

                # Check role permissions
                if session.role and action not in session.permissions:
                    # Check if role has permission
                    if action not in session.role.permissions:
                        return False, f"Role permission denied: {action}"

        return True, None

    def _get_applicable_rules(self, session: Session) -> List[AuthorityRule]:
        """Get rules applicable to a session."""
        applicable = []

        for rule in self.rules.values():
            if rule.ring.value <= (
                session.role.ring_level.value if session.role else 3
            ):
                applicable.append(rule)

        # Sort by priority (highest first)
        applicable.sort(key=lambda r: r.priority, reverse=True)

        return applicable

    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """Get session information."""
        session = self.sessions.get(session_id)

        if not session:
            return None

        return {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "role": session.role.name if session.role else None,
            "created_at": session.created_at,
            "expires_at": session.expires_at,
            "active": session.expires_at is None or time.time() < session.expires_at,
        }

    def revoke_session(self, session_id: str) -> bool:
        """Revoke a session."""
        if session_id in self.sessions:
            del self.sessions[session_id]
            return True
        return False


class MechanicalToolFilter:
    """
    Mechanical tool filtering - removes disallowed tools
    before model execution to prevent hallucinations.
    """

    def __init__(self, abl: AuthorityBoundaryLedger):
        self.abl = abl
        self.tool_registry: Dict[str, Set[str]] = defaultdict(
            set
        )  # role -> allowed tools

    def register_tool_for_role(self, role_id: str, tool_name: str):
        """Register a tool for a role."""
        self.tool_registry[role_id].add(tool_name)

    def filter_tools(
        self, session_id: str, requested_tools: List[str], action: str = "execute"
    ) -> List[str]:
        """Filter tools based on authority."""

        # Get session
        session = self.abl.sessions.get(session_id)

        if not session:
            return []  # No tools allowed

        # Authorize action
        authorized, _ = self.abl.authorize_action(session_id, action)

        if not authorized:
            return []  # No tools allowed

        # Filter tools
        allowed_tools = []

        for tool in requested_tools:
            # Check role-based tools
            if session.role:
                role_tools = self.tool_registry.get(session.role.role_id, set())

                if tool in role_tools:
                    allowed_tools.append(tool)
                    continue

            # Check session permissions
            if tool in session.permissions:
                allowed_tools.append(tool)

        return allowed_tools

    def get_available_tools(self, session_id: str) -> List[str]:
        """Get available tools for a session."""

        session = self.abl.sessions.get(session_id)

        if not session:
            return []

        if session.role:
            return list(self.tool_registry.get(session.role.role_id, set()))

        return list(session.permissions)


class DifferentialPrivacy:
    """
    Implements differential privacy for federated learning.
    """

    def __init__(
        self, epsilon: float = 1.0, delta: float = 1e-5, max_grad_norm: float = 1.0
    ):
        self.epsilon = epsilon
        self.delta = delta
        self.max_grad_norm = max_grad_norm
        self.noise_multiplier = 1.0

    def add_noise(self, gradient: Any) -> Any:
        """Add calibrated Gaussian noise to gradient."""
        import numpy as np

        if hasattr(gradient, "shape"):
            # Add noise
            noise = np.random.normal(
                0, self.noise_multiplier * self.max_grad_norm, gradient.shape
            )

            if hasattr(gradient, "numpy"):
                return gradient + noise
            else:
                return gradient + noise

        return gradient

    def clip_gradient(self, gradient: Any) -> Any:
        """Clip gradient to max norm."""
        import numpy as np

        if hasattr(gradient, "shape"):
            grad_norm = np.linalg.norm(gradient)

            if grad_norm > self.max_grad_norm:
                scale = self.max_grad_norm / grad_norm
                gradient = gradient * scale

        return gradient

    def compute_privacy_budget(self, steps: int) -> Dict:
        """Compute privacy budget spent."""
        # Simplified budget calculation
        sigma = self.noise_multiplier
        epsilon_spent = sigma * (2 * steps) ** 0.5

        return {
            "epsilon_spent": epsilon_spent,
            "delta": self.delta,
            "steps": steps,
            "budget_remaining": max(0, self.epsilon - epsilon_spent),
        }


class SecurityManager:
    """
    Main security manager coordinating all security components.
    """

    def __init__(self):
        self.abl = AuthorityBoundaryLedger()
        self.tool_filter = MechanicalToolFilter(self.abl)
        self.dp = DifferentialPrivacy()

    def initialize_default_roles(self):
        """Initialize default roles."""

        # Admin role
        admin = Role(
            name="admin",
            description="Full administrative access",
            ring_level=RingLevel.CONSTITUTIONAL,
            permissions={"*"},
        )
        self.abl.add_role(admin)

        # Analyst role
        analyst = Role(
            name="analyst",
            description="Data analysis access",
            ring_level=RingLevel.ORGANIZATIONAL,
            permissions={"read", "analyze", "query", "audit"},
        )
        self.abl.add_role(analyst)

        # User role
        user = Role(
            name="user",
            description="Standard user access",
            ring_level=RingLevel.SESSION,
            permissions={"read", "query"},
        )
        self.abl.add_role(user)

        # Register tools for roles
        self.tool_filter.register_tool_for_role(admin.role_id, "execute")
        self.tool_filter.register_tool_for_role(admin.role_id, "write")
        self.tool_filter.register_tool_for_role(admin.role_id, "delete")
        self.tool_filter.register_tool_for_role(analyst.role_id, "read")
        self.tool_filter.register_tool_for_role(analyst.role_id, "analyze")
        self.tool_filter.register_tool_for_role(user.role_id, "read")

    def create_user_session(self, user_id: str, role_name: str) -> str:
        """Create a new user session."""
        # Find role
        role = None
        for r in self.abl.roles.values():
            if r.name == role_name:
                role = r
                break

        if not role:
            raise ValueError(f"Role not found: {role_name}")

        return self.abl.create_session(user_id, role.role_id)


__all__ = [
    "SecurityManager",
    "AuthorityBoundaryLedger",
    "MechanicalToolFilter",
    "DifferentialPrivacy",
    "RingLevel",
    "AuthorityRule",
    "Role",
    "Session",
]
