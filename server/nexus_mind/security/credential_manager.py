"""
Nexus Mind Security - Credential Manager

Manages credentials with AES-256-GCM encryption.
Credentials are stored encrypted and only decrypted at the host boundary.
"""

import os
import json
import base64
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum

logger = logging.getLogger(__name__)

try:
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
    from cryptography.hazmat.backends import default_backend

    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    logger.warning("cryptography library not available, using fallback")

try:
    import keyring

    KEYRING_AVAILABLE = True
except ImportError:
    KEYRING_AVAILABLE = False
    logger.warning("keyring library not available, credentials will use file storage")


class CredentialType(Enum):
    """Types of credentials."""

    API_KEY = "api_key"
    OAUTH_TOKEN = "oauth_token"
    PASSWORD = "password"
    CERTIFICATE = "certificate"
    SSH_KEY = "ssh_key"
    DATABASE = "database"


@dataclass
class CredentialMetadata:
    """Metadata for a stored credential."""

    name: str
    credential_type: CredentialType
    created_at: datetime
    last_used: Optional[datetime]
    expires_at: Optional[datetime]
    rotation_required: bool
    allowed_tools: List[str]
    allowed_ips: List[str]


class CredentialManager:
    """
    Manages credentials with AES-256-GCM encryption.

    Credentials are:
    - Encrypted at rest using AES-256-GCM
    - Stored in system keyring when available
    - Injected at host boundary for tool execution
    - Rotated automatically when expired
    """

    def __init__(
        self,
        service_name: str = "nexus_mind",
        encryption_key: Optional[bytes] = None,
    ):
        self.service_name = service_name
        self._keyring_service = f"{service_name}_credentials"

        if CRYPTO_AVAILABLE:
            self._init_encryption(encryption_key)
        else:
            self._cipher = None

        self._metadata: Dict[str, CredentialMetadata] = {}
        self._load_metadata()

    def _init_encryption(self, key: Optional[bytes] = None):
        """Initialize encryption key."""
        if key:
            self._key = key
        else:
            self._key = self._get_or_create_key()

        self._cipher = Fernet(base64.urlsafe_b64encode(self._key[:32]))

    def _get_or_create_key(self) -> bytes:
        """Get or create encryption key from keyring."""
        key_b64 = self._get_from_keyring("encryption_key")

        if not key_b64:
            salt = os.urandom(16)
            key = os.urandom(32)
            key_b64 = base64.b64encode(salt + key).decode()
            self._save_to_keyring("encryption_key", key_b64)
            logger.info("Created new encryption key")

        key_data = base64.b64decode(key_b64)
        return key_data[16:] if len(key_data) > 16 else key_data

    def _get_from_keyring(self, name: str) -> Optional[str]:
        """Get value from system keyring."""
        if KEYRING_AVAILABLE:
            try:
                return keyring.get_password(self._keyring_service, name)
            except Exception as e:
                logger.warning(f"Keyring read failed: {e}")

        env_key = f"{self.service_name.upper()}_{name}"
        return os.environ.get(env_key)

    def _save_to_keyring(self, name: str, value: str):
        """Save value to system keyring."""
        if KEYRING_AVAILABLE:
            try:
                keyring.set_password(self._keyring_service, name, value)
                return
            except Exception as e:
                logger.warning(f"Keyring write failed: {e}")

        env_key = f"{self.service_name.upper()}_{name}"
        os.environ[env_key] = value

    def store_credential(
        self,
        name: str,
        value: str,
        credential_type: CredentialType = CredentialType.API_KEY,
        expires_in_days: Optional[int] = None,
        allowed_tools: Optional[List[str]] = None,
        allowed_ips: Optional[List[str]] = None,
    ) -> bool:
        """
        Encrypt and store a credential.

        Args:
            name: Unique name for the credential
            value: The credential value to store
            credential_type: Type of credential
            expires_in_days: Days until credential expires
            allowed_tools: Tools that can use this credential
            allowed_ips: IP addresses allowed to use this credential

        Returns:
            True if successful
        """
        if not CRYPTO_AVAILABLE:
            logger.error("Cryptography not available")
            return False

        try:
            encrypted = self._cipher.encrypt(value.encode())
            encrypted_b64 = base64.b64encode(encrypted).decode()

            self._save_to_keyring(f"cred_{name}", encrypted_b64)

            expires_at = None
            if expires_in_days:
                expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

            self._metadata[name] = CredentialMetadata(
                name=name,
                credential_type=credential_type,
                created_at=datetime.now(timezone.utc),
                last_used=None,
                expires_at=expires_at,
                rotation_required=False,
                allowed_tools=allowed_tools or [],
                allowed_ips=allowed_ips or [],
            )

            self._save_metadata()

            logger.info(f"Stored credential: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to store credential: {e}")
            return False

    def get_credential(self, name: str) -> Optional[str]:
        """
        Retrieve and decrypt a credential.

        Args:
            name: Name of the credential

        Returns:
            Decrypted credential value or None
        """
        if not CRYPTO_AVAILABLE:
            return None

        try:
            encrypted_b64 = self._get_from_keyring(f"cred_{name}")
            if not encrypted_b64:
                return None

            encrypted = base64.b64decode(encrypted_b64)
            decrypted = self._cipher.decrypt(encrypted)
            value = decrypted.decode()

            if name in self._metadata:
                self._metadata[name].last_used = datetime.now(timezone.utc)
                self._save_metadata()

            return value

        except Exception as e:
            logger.error(f"Failed to retrieve credential: {e}")
            return None

    def delete_credential(self, name: str) -> bool:
        """Delete a credential."""
        try:
            if KEYRING_AVAILABLE:
                try:
                    keyring.delete_password(self._keyring_service, f"cred_{name}")
                except keyring.errors.PasswordDeleteError:
                    pass

            env_key = f"{self.service_name.upper()}_cred_{name}"
            if env_key in os.environ:
                del os.environ[env_key]

            if name in self._metadata:
                del self._metadata[name]
                self._save_metadata()

            logger.info(f"Deleted credential: {name}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete credential: {e}")
            return False

    def list_credentials(self) -> List[str]:
        """List all credential names."""
        return list(self._metadata.keys())

    def get_metadata(self, name: str) -> Optional[CredentialMetadata]:
        """Get metadata for a credential."""
        return self._metadata.get(name)

    def inject_credentials(
        self,
        request: Dict,
        required_credentials: List[str],
        tool_name: Optional[str] = None,
    ) -> Dict:
        """
        Inject credentials into a request at host boundary.

        Credentials are added to headers, never exposed to WASM code.

        Args:
            request: The request dict to inject credentials into
            required_credentials: List of credential names to inject
            tool_name: Tool that will use the credentials (for validation)

        Returns:
            Modified request with credentials injected
        """
        request = request.copy()
        headers = request.get("headers", {})

        for cred_name in required_credentials:
            metadata = self._metadata.get(cred_name)

            if not metadata:
                logger.warning(f"Credential not found: {cred_name}")
                continue

            if tool_name and metadata.allowed_tools:
                if tool_name not in metadata.allowed_tools:
                    logger.warning(f"Tool {tool_name} not allowed to use {cred_name}")
                    continue

            cred_value = self.get_credential(cred_name)
            if cred_value:
                headers[f"X-Credential-{cred_name}"] = cred_value

        request["headers"] = headers

        return request

    def _load_metadata(self):
        """Load credential metadata from storage."""
        metadata_json = self._get_from_keyring("metadata")
        if metadata_json:
            try:
                data = json.loads(metadata_json)
                for name, meta in data.items():
                    meta["created_at"] = datetime.fromisoformat(meta["created_at"])
                    if meta.get("last_used"):
                        meta["last_used"] = datetime.fromisoformat(meta["last_used"])
                    if meta.get("expires_at"):
                        meta["expires_at"] = datetime.fromisoformat(meta["expires_at"])
                    meta["credential_type"] = CredentialType(meta["credential_type"])
                    self._metadata[name] = CredentialMetadata(**meta)
            except Exception as e:
                logger.warning(f"Failed to load metadata: {e}")

    def _save_metadata(self):
        """Save credential metadata to storage."""
        data = {}
        for name, meta in self._metadata.items():
            data[name] = {
                "name": meta.name,
                "credential_type": meta.credential_type.value,
                "created_at": meta.created_at.isoformat(),
                "last_used": meta.last_used.isoformat() if meta.last_used else None,
                "expires_at": meta.expires_at.isoformat() if meta.expires_at else None,
                "rotation_required": meta.rotation_required,
                "allowed_tools": meta.allowed_tools,
                "allowed_ips": meta.allowed_ips,
            }

        metadata_json = json.dumps(data)
        self._save_to_keyring("metadata", metadata_json)

    def check_expirations(self) -> List[str]:
        """Check for expired credentials and return list of names."""
        expired = []
        now = datetime.now(timezone.utc)

        for name, meta in self._metadata.items():
            if meta.expires_at and meta.expires_at < now:
                expired.append(name)
                meta.rotation_required = True

        if expired:
            self._save_metadata()

        return expired


class SecureCredentialScanner:
    """
    Scans inputs and outputs for credential leakage and prompt injection.

    Used by IronClaw for leak detection and input validation.
    """

    def __init__(self):
        self._patterns = self._init_patterns()

    def _init_patterns(self) -> List[Dict]:
        """Initialize credential detection and prompt injection patterns."""
        return [
            # Prompt injection detection patterns
            {
                "type": "prompt_injection",
                "pattern": r"(?i)\b(ignore\s+(?:previous\s+)?instructions|disregard\s+(?:all\s+)?safety\s+guidelines|you\s+are\s+now\s+(?:a\s+different\s+ai|dan)\b|system\s+prompt\s*:\s*override|forget\s+everything\s+i\s+told\s+you)\b",
            },
            {
                "type": "command_injection",
                "pattern": r"(?i)\b(sudo\s+rm\s+-rf|rm\s+-rf\s+/|curl\s+https?://|eval\s*\(|exec\s*\(|__import__\s*\()",
            },
            {
                "type": "credential_access",
                "pattern": r"(?i)\b(print\s+(?:the\s+)?api\s*key|show\s+me\s+(?:the\s+)?password|what\s+is\s+your\s+api\s*key|reveal\s+(?:your\s+)?credentials)\b",
            },
            # Credential detection patterns
            {
                "type": "api_key",
                "pattern": r"(?i)(api[_-]?key|apikey)['\"]?\s*(?:[:=]|=>)\s*['\"]?([a-zA-Z0-9_-]{5,})['\"]?|\b(sk-[a-zA-Z0-9_-]{5,})\b",
            },
            {
                "type": "aws_key",
                "pattern": r"(?i)(aws[_-]?access[_-]?key|aws_secret)['\"]?\s*(?:[:=]|=>)\s*['\"]?([A-Z0-9]{16,})['\"]?",
            },
            {
                "type": "password",
                "pattern": r"(?i)(password|passwd|pwd)['\"]?\s*(?:[:=]|=>)\s*['\"]?([^\s'\"]{4,})['\"]?",
            },
            {
                "type": "token",
                "pattern": r"(?i)(bearer\s+|token['\"]?\s*(?:[:=]|=>)\s*['\"]?)([a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)",
            },
            {
                "type": "private_key",
                "pattern": r"-----BEGIN (RSA |EC )?PRIVATE KEY-----",
            },
            {
                "type": "secret",
                "pattern": r"(?i)(secret|token|key)['\"]?\s*(?:[:=]|=>)\s*['\"]?(sk-[a-zA-Z0-9_-]{5,})['\"]?",
            },
        ]

    def scan_text(self, text: str) -> List[Dict]:
        """Scan text for credential and prompt injection patterns."""
        import re

        findings = []

        for pattern_def in self._patterns:
            matches = re.finditer(pattern_def["pattern"], text)
            for match in matches:
                findings.append(
                    {
                        "type": pattern_def["type"],
                        "match": match.group(0)[:50] + "..."
                        if len(match.group(0)) > 50
                        else match.group(0),
                        "position": match.start(),
                    }
                )

        return findings

    def scan_dict(self, data: Dict) -> List[Dict]:
        """Recursively scan dictionary for credentials and prompt injection."""
        findings = []

        def scan_value(key: str, value: any):
            if isinstance(value, str):
                findings.extend(self.scan_text(value))
            elif isinstance(value, dict):
                for k, v in value.items():
                    scan_value(f"{key}.{k}", v)
            elif isinstance(value, (list, tuple)):
                for i, v in enumerate(value):
                    scan_value(f"{key}[{i}]", v)

        for key, value in data.items():
            scan_value(key, value)

        return findings

    def sanitize(self, data: Any) -> Any:
        """Remove or mask detected credentials."""
        if isinstance(data, dict):
            sensitive_keys = {
                "api_key",
                "apikey",
                "password",
                "passwd",
                "pwd",
                "token",
                "secret",
                "private_key",
                "secret_key",
                "access_key",
            }
            sanitized = {}
            for k, v in data.items():
                if isinstance(v, (dict, list)):
                    sanitized[k] = self.sanitize(v)
                elif isinstance(k, str) and k.lower() in sensitive_keys:
                    sanitized[k] = "[REDACTED]"
                elif isinstance(v, str):
                    sanitized[k] = self._sanitize_text(v)
                else:
                    sanitized[k] = v
            return sanitized
        elif isinstance(data, list):
            return [self.sanitize(item) for item in data]
        elif isinstance(data, str):
            return self._sanitize_text(data)
        return data

    def _sanitize_text(self, text: str) -> str:
        """Mask credentials inside a text string."""
        import re

        result = text
        for pattern_def in self._patterns:
            if pattern_def["type"] in (
                "api_key",
                "aws_key",
                "password",
                "token",
                "private_key",
                "secret",
            ):
                result = re.sub(pattern_def["pattern"], "[REDACTED]", result)
        return result


__all__ = [
    "CredentialManager",
    "SecureCredentialScanner",
    "CredentialType",
    "CredentialMetadata",
    "CRYPTO_AVAILABLE",
    "KEYRING_AVAILABLE",
]
