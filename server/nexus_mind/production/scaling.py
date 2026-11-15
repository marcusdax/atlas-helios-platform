"""
Horizontal Scaling and Distributed Processing

Provides distributed node management and load balancing.
"""

import asyncio
import aiohttp
from typing import Dict, List, Optional, Any
import logging
import hashlib

logger = logging.getLogger(__name__)


class NodeRegistry:
    """
    Registry for managing distributed nodes.
    """

    def __init__(self):
        """Initialize Node Registry."""
        self.nodes: Dict[str, Dict[str, Any]] = {}
        logger.info("NodeRegistry initialized")

    def register(
        self, node_id: str, address: str, port: int, metadata: Optional[Dict] = None
    ):
        """
        Register a node.

        Args:
            node_id: Unique node identifier
            address: Node address
            port: Node port
            metadata: Additional metadata
        """
        self.nodes[node_id] = {
            "address": address,
            "port": port,
            "metadata": metadata or {},
            "status": "active",
            "registered_at": asyncio.get_event_loop().time(),
        }
        logger.info(f"Node registered: {node_id} at {address}:{port}")

    def unregister(self, node_id: str):
        """Unregister a node."""
        if node_id in self.nodes:
            del self.nodes[node_id]
            logger.info(f"Node unregistered: {node_id}")

    def get_active(self) -> List[Dict[str, Any]]:
        """Get list of active nodes."""
        return [
            {**node, "node_id": node_id}
            for node_id, node in self.nodes.items()
            if node["status"] == "active"
        ]

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get node by ID."""
        return self.nodes.get(node_id)

    def update_status(self, node_id: str, status: str):
        """Update node status."""
        if node_id in self.nodes:
            self.nodes[node_id]["status"] = status


class LoadBalancer:
    """
    Load balancer for distributing requests across nodes.
    """

    def __init__(self, strategy: str = "round_robin"):
        """
        Initialize Load Balancer.

        Args:
            strategy: Balancing strategy ('round_robin', 'least_connections', 'weighted', 'hash')
        """
        self.strategy = strategy
        self.index = 0
        self.connection_counts: Dict[str, int] = {}
        self.weights: Dict[str, int] = {}

        logger.info(f"LoadBalancer initialized with strategy: {strategy}")

    def select_node(
        self, nodes: List[Dict[str, Any]], request_key: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Select a node based on strategy.

        Args:
            nodes: List of available nodes
            request_key: Optional key for hash-based routing

        Returns:
            Selected node or None
        """
        if not nodes:
            return None

        if self.strategy == "round_robin":
            return self._round_robin(nodes)
        elif self.strategy == "least_connections":
            return self._least_connections(nodes)
        elif self.strategy == "weighted":
            return self._weighted(nodes)
        elif self.strategy == "hash":
            return self._hash(nodes, request_key)
        else:
            return nodes[0]

    def _round_robin(self, nodes: List[Dict]) -> Dict:
        """Round-robin selection."""
        node = nodes[self.index % len(nodes)]
        self.index += 1
        return node

    def _least_connections(self, nodes: List[Dict]) -> Dict:
        """Least connections selection."""
        # Initialize connection counts for new nodes
        for node in nodes:
            node_id = f"{node['address']}:{node['port']}"
            if node_id not in self.connection_counts:
                self.connection_counts[node_id] = 0

        # Find node with least connections
        min_connections = float("inf")
        selected = nodes[0]

        for node in nodes:
            node_id = f"{node['address']}:{node['port']}"
            connections = self.connection_counts.get(node_id, 0)
            if connections < min_connections:
                min_connections = connections
                selected = node

        return selected

    def _weighted(self, nodes: List[Dict]) -> Dict:
        """Weighted selection."""
        weights = [n.get("metadata", {}).get("weight", 1) for n in nodes]
        total_weight = sum(weights)

        import random

        r = random.uniform(0, total_weight)

        cumulative = 0
        for i, weight in enumerate(weights):
            cumulative += weight
            if r <= cumulative:
                return nodes[i]

        return nodes[0]

    def _hash(self, nodes: List[Dict], key: Optional[str]) -> Dict:
        """Hash-based consistent routing."""
        if not key:
            return nodes[0]

        hash_value = int(hashlib.md5(key.encode()).hexdigest(), 16)
        index = hash_value % len(nodes)

        return nodes[index]

    def record_connection(self, node: Dict):
        """Record a new connection to a node."""
        node_id = f"{node['address']}:{node['port']}"
        self.connection_counts[node_id] = self.connection_counts.get(node_id, 0) + 1

    def release_connection(self, node: Dict):
        """Release a connection from a node."""
        node_id = f"{node['address']}:{node['port']}"
        if node_id in self.connection_counts:
            self.connection_counts[node_id] = max(
                0, self.connection_counts[node_id] - 1
            )


class DistributedNexusMind:
    """
    Distributed Nexus Mind node for horizontal scaling.
    """

    def __init__(self, node_id: str, address: str, port: int, local_engine: Any = None):
        """
        Initialize Distributed Node.

        Args:
            node_id: Unique node identifier
            address: Node address
            port: Node port
            local_engine: Local inference engine
        """
        self.node_id = node_id
        self.address = address
        self.port = port
        self.local_engine = local_engine
        self.runner = None
        self.app = None

        logger.info(f"DistributedNexusMind initialized: {node_id}")

    async def start(self):
        """Start the distributed node."""
        self.app = aiohttp.web.Application()
        self.app.router.add_post("/infer", self.handle_infer)
        self.app.router.add_get("/health", self.handle_health)
        self.app.router.add_get("/stats", self.handle_stats)

        self.runner = aiohttp.web.AppRunner(self.app)
        await self.runner.setup()

        site = aiohttp.web.TCPSite(self.runner, self.address, self.port)
        await site.start()

        logger.info(f"Distributed node started at {self.address}:{self.port}")

    async def stop(self):
        """Stop the distributed node."""
        if self.runner:
            await self.runner.cleanup()
            logger.info(f"Distributed node stopped: {self.node_id}")

    async def handle_infer(self, request: aiohttp.web.Request) -> aiohttp.web.Response:
        """Handle inference request."""
        try:
            data = await request.json()
            result = await self.process_locally(data)
            return aiohttp.web.json_response(result)
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return aiohttp.web.json_response({"error": str(e)}, status=500)

    async def handle_health(self, request: aiohttp.web.Request) -> aiohttp.web.Response:
        """Handle health check."""
        return aiohttp.web.json_response({"node_id": self.node_id, "status": "healthy"})

    async def handle_stats(self, request: aiohttp.web.Request) -> aiohttp.web.Response:
        """Handle stats request."""
        return aiohttp.web.json_response({"node_id": self.node_id, "status": "active"})

    async def process_locally(self, payload: Dict) -> Dict:
        """
        Process inference locally.

        Args:
            payload: Request payload

        Returns:
            Inference result
        """
        if self.local_engine is None:
            return {"fused": [0.0] * 512}

        # Process with local engine
        # This would call the actual cognitive manager
        return {"result": "processed", "node_id": self.node_id}


class DistributedCluster:
    """
    Manages a cluster of distributed Nexus Mind nodes.
    """

    def __init__(self):
        self.registry = NodeRegistry()
        self.load_balancer = LoadBalancer(strategy="round_robin")
        logger.info("DistributedCluster initialized")

    def add_node(self, node: DistributedNexusMind):
        """Add a node to the cluster."""
        self.registry.register(node.node_id, node.address, node.port)

    async def infer(self, payload: Dict, strategy: str = "round_robin") -> Dict:
        """
        Run inference across the cluster.

        Args:
            payload: Inference payload
            strategy: Load balancing strategy

        Returns:
            Inference result
        """
        nodes = self.registry.get_active()

        if not nodes:
            return {"error": "No active nodes"}

        node = self.load_balancer.select_node(nodes)

        if node is None:
            return {"error": "No node selected"}

        # Forward request to node
        url = f"http://{node['address']}:{node['port']}/infer"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as resp:
                    result = await resp.json()
                    return result
        except Exception as e:
            logger.error(f"Cluster inference error: {e}")
            return {"error": str(e)}
