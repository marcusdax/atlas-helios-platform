"""
Nexus Mind Phase 2 - KrakenD Zero-Trust Gateway Configuration

Complete KrakenD configuration for Nexus Mind sovereign AI gateway.
Includes JWT validation, rate limiting, bot detection, and CORS.
"""

import os
from typing import Dict, List, Optional, Any


class KrakenDConfig:
    """KrakenD gateway configuration builder."""

    def __init__(self, name: str = "Nexus-Sovereign-Gateway"):
        self.config = {
            "version": 3,
            "name": name,
            "port": int(os.environ.get("KRAKEND_PORT", "8443")),
            "cache_ttl": "3600s",
            "timeout": "3000ms",
            "endpoints": [],
            "extra_config": {
                "telemetry/logging": {
                    "level": "INFO",
                    "prefix": "[KRAKEND]",
                    "stdout": True,
                },
                "telemetry/metrics": {
                    "collection_time": "30s",
                    "listen_address": "0.0.0.0:9090",
                    "exporters": ["prometheus"],
                },
            },
        }

    def set_tls(
        self, min_version: str = "1.3", cert_path: str = None, key_path: str = None
    ):
        """Configure TLS settings."""
        tls_config = {
            "min_version": min_version,
            "ciphers": [
                "TLS_AES_256_GCM_SHA384",
                "TLS_CHACHA20_POLY1305_SHA256",
                "TLS_AES_128_GCM_SHA256",
            ],
        }

        if cert_path and key_path:
            tls_config["public_key_file"] = cert_path
            tls_config["private_key_file"] = key_path

        self.config["tls"] = tls_config
        return self

    def add_endpoint(
        self,
        endpoint: str,
        method: str,
        backend_host: str,
        backend_path: str,
        jwks_url: str = None,
        issuer: str = None,
        audience: str = None,
        max_rate: int = 1000,
        capacity: int = 100,
        require_auth: bool = True,
    ) -> "KrakenDConfig":
        """Add an endpoint with security configuration."""

        backend = {
            "host": [backend_host],
            "url_pattern": backend_path,
            "disable_host_sanitize": True,
        }

        extra_config = {}

        if require_auth and jwks_url:
            extra_config["validation/jwt"] = {
                "alg": "RS256",
                "jwk_url": jwks_url,
                "issuer": issuer,
                "audience": audience,
                "cache": True,
                "cache_duration": "3600s",
                "propagate_claims": ["sub", "tenant_id", "role"],
            }

        extra_config["qos/ratelimit"] = {
            "max_rate": max_rate,
            "capacity": capacity,
            "strategy": "ip",
        }

        endpoint_config = {
            "endpoint": endpoint,
            "method": method,
            "output_encoding": "no-op",
            "input_headers": ["X-Tenant-ID", "X-Request-ID", "Authorization"],
            "backend": [backend],
            "extra_config": extra_config,
        }

        self.config["endpoints"].append(endpoint_config)
        return self

    def add_security_middleware(
        self,
        bot_detection: bool = True,
        cors_origins: List[str] = None,
    ) -> "KrakenDConfig":
        """Add security middleware configuration."""

        security = {}

        if bot_detection:
            security["security/bot-detector"] = {
                "allow": ["pingdom", "googlebot", "bingbot"],
                "deny": [
                    "^python-requests",
                    "^curl",
                    "^go-http-client",
                    "scrapy",
                    "^wget",
                ],
            }

        if cors_origins:
            security["security/cors"] = {
                "allow_origins": cors_origins,
                "allow_methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": [
                    "Authorization",
                    "Content-Type",
                    "X-Tenant-ID",
                    "X-Request-ID",
                ],
                "expose_headers": ["X-Request-ID", "X-RateLimit-Remaining"],
                "max_age": "86400s",
                "allow_credentials": True,
            }

        for endpoint in self.config["endpoints"]:
            endpoint["extra_config"].update(security)

        return self

    def add_rate_limiting(
        self,
        strategy: str = "ip",
        max_rate: int = 1000,
        capacity: int = 100,
        redis_host: str = None,
    ) -> "KrakenDConfig":
        """Add rate limiting configuration."""

        rate_limit_config = {
            "max_rate": max_rate,
            "capacity": capacity,
            "strategy": strategy,
        }

        if redis_host:
            rate_limit_config["store"] = "redis"
            rate_limit_config["redis"] = {"host": redis_host, "port": 6379}

        for endpoint in self.config["endpoints"]:
            endpoint["extra_config"]["qos/ratelimit"] = rate_limit_config

        return self

    def add_circuit_breaker(
        self,
        enabled: bool = True,
        interval: str = "10s",
        timeout: str = "300s",
        max_errors: int = 5,
    ) -> "KrakenDConfig":
        """Add circuit breaker configuration."""

        cb_config = {
            "enabled": enabled,
            "interval": interval,
            "timeout": timeout,
            "max_errors": max_errors,
        }

        for endpoint in self.config["endpoints"]:
            for backend in endpoint.get("backend", []):
                backend["extra_config"] = backend.get("extra_config", {})
                backend["extra_config"]["qos/circuit-breaker"] = cb_config

        return self

    def to_dict(self) -> Dict:
        """Return configuration as dictionary."""
        return self.config

    def to_json(self, indent: int = 2) -> str:
        """Return configuration as JSON string."""
        import json

        return json.dumps(self.config, indent=indent)

    def save(self, path: str):
        """Save configuration to file."""
        with open(path, "w") as f:
            f.write(self.to_json())


def create_nexus_gateway_config() -> KrakenDConfig:
    """Create the complete Nexus Mind gateway configuration."""

    config = KrakenDConfig("Nexus-Sovereign-Gateway")

    # Configure TLS
    config.set_tls(
        min_version="1.3",
        cert_path=os.environ.get("TLS_CERT_PATH", "/etc/krakend/tls/server.crt"),
        key_path=os.environ.get("TLS_KEY_PATH", "/etc/krakend/tls/server.key"),
    )

    # Add endpoints
    jwks_url = os.environ.get(
        "JWKS_URL", "https://iam.nexus-core.local/.well-known/jwks.json"
    )
    issuer = os.environ.get("JWT_ISSUER", "https://iam.nexus-core.local")
    audience = os.environ.get("JWT_AUDIENCE", "nexus-governance")

    # NADE endpoint
    config.add_endpoint(
        endpoint="/v1/nade",
        method="POST",
        backend_host=os.environ.get("NADE_HOST", "http://nade-service:8081"),
        backend_path="/internal/inference",
        jwks_url=jwks_url,
        issuer=issuer,
        audience=audience,
        max_rate=1000,
    )

    # GIE endpoint
    config.add_endpoint(
        endpoint="/v1/gie",
        method="POST",
        backend_host=os.environ.get("GIE_HOST", "http://gie-service:8082"),
        backend_path="/internal/analyze",
        jwks_url=jwks_url,
        issuer=issuer,
        audience=audience,
        max_rate=500,
    )

    # BNE endpoint
    config.add_endpoint(
        endpoint="/v1/bne",
        method="POST",
        backend_host=os.environ.get("BNE_HOST", "http://bne-service:8083"),
        backend_path="/internal/predict",
        jwks_url=jwks_url,
        issuer=issuer,
        audience=audience,
        max_rate=1000,
    )

    # Fusion endpoint
    config.add_endpoint(
        endpoint="/v1/fusion",
        method="POST",
        backend_host=os.environ.get("FUSION_HOST", "http://fusion-service:8084"),
        backend_path="/internal/fuse",
        jwks_url=jwks_url,
        issuer=issuer,
        audience=audience,
        max_rate=500,
    )

    # Health endpoint (no auth required)
    config.add_endpoint(
        endpoint="/health",
        method="GET",
        backend_host=os.environ.get("HEALTH_HOST", "http://nade-service:8081"),
        backend_path="/health",
        require_auth=False,
        max_rate=10000,
    )

    # Security middleware
    config.add_security_middleware(
        bot_detection=True,
        cors_origins=[
            "https://apps.nexus-eco.local",
            "https://shadow-corps.nexus-eco.local",
        ],
    )

    # Rate limiting with Redis
    config.add_rate_limiting(
        strategy="ip",
        max_rate=1000,
        capacity=100,
        redis_host=os.environ.get("REDIS_HOST", "redis.nexus-core.local"),
    )

    # Circuit breaker
    config.add_circuit_breaker(
        enabled=True, interval="10s", timeout="60s", max_errors=5
    )

    return config


if __name__ == "__main__":
    config = create_nexus_gateway_config()
    config.save("/etc/krakend/krakend.json")
    print("Configuration saved to /etc/krakend/krakend.json")


__all__ = [
    "KrakenDConfig",
    "create_nexus_gateway_config",
]
