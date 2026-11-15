"""
Nexus Mind Knowledge Graph Module

Enterprise-grade knowledge graph with semantic reasoning,
entity relationships, and inference capabilities.

Based on Phase 5 Advanced Features specification.
"""

import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any, Tuple
from enum import Enum
import json
import heapq
from collections import defaultdict, deque
import hashlib


class EntityType(Enum):
    """Types of entities in the knowledge graph."""

    PERSON = "person"
    ORGANIZATION = "organization"
    LOCATION = "location"
    OBJECT = "object"
    EVENT = "event"
    CONCEPT = "concept"
    ASSET = "asset"
    ANOMALY = "anomaly"
    INTENT = "intent"


class RelationshipType(Enum):
    """Types of relationships between entities."""

    KNOWS = "knows"
    WORKS_FOR = "works_for"
    LOCATED_AT = "located_at"
    OWNED_BY = "owned_by"
    RELATED_TO = "related_to"
    CAUSED_BY = "caused_by"
    SIMILAR_TO = "similar_to"
    PART_OF = "part_of"
    VERIFIED_BY = "verified_by"
    FLAGGED_AS = "flagged_as"
    INTERACTED_WITH = "interacted_with"


@dataclass
class Entity:
    """Represents a node in the knowledge graph."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: EntityType = EntityType.CONCEPT
    properties: Dict[str, Any] = field(default_factory=dict)
    embeddings: Optional[List[float]] = None
    confidence: float = 1.0
    created_at: float = field(default_factory=lambda: __import__("time").time())
    updated_at: float = field(default_factory=lambda: __import__("time").time())

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "type": self.type.value,
            "properties": self.properties,
            "confidence": self.confidence,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class Relationship:
    """Represents an edge between entities."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source_id: str = ""
    target_id: str = ""
    type: RelationshipType = RelationshipType.RELATED_TO
    properties: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 1.0
    created_at: float = field(default_factory=lambda: __import__("time").time())

    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "type": self.type.value,
            "properties": self.properties,
            "confidence": self.confidence,
            "created_at": self.created_at,
        }


class InferenceRule:
    """Represents an inference rule for the knowledge graph."""

    def __init__(
        self, name: str, condition: callable, conclusion: str, confidence: float = 1.0
    ):
        self.name = name
        self.condition = condition
        self.conclusion = conclusion
        self.confidence = confidence

    def evaluate(
        self, entities: Dict[str, Entity], relationships: List[Relationship]
    ) -> bool:
        """Evaluate if the rule condition is met."""
        try:
            return self.condition(entities, relationships)
        except:
            return False


class KnowledgeGraph:
    """
    Main knowledge graph class with entity management,
    relationship tracking, and inference capabilities.
    """

    def __init__(self):
        self.entities: Dict[str, Entity] = {}
        self.relationships: Dict[str, Relationship] = {}
        self.entity_index: Dict[EntityType, Set[str]] = defaultdict(set)
        self.inference_rules: List[InferenceRule] = []
        self._initialize_default_rules()

    def _initialize_default_rules(self):
        """Initialize default inference rules."""

        def transitive_closure(entities, relationships):
            return True

        self.add_inference_rule(
            InferenceRule(
                name="transitive_knows",
                condition=transitive_closure,
                conclusion="indirect_knowledge",
                confidence=0.8,
            )
        )

    def add_entity(self, entity: Entity) -> str:
        """Add an entity to the graph."""
        self.entities[entity.id] = entity
        self.entity_index[entity.type].add(entity.id)
        entity.updated_at = __import__("time").time()
        return entity.id

    def get_entity(self, entity_id: str) -> Optional[Entity]:
        """Retrieve an entity by ID."""
        return self.entities.get(entity_id)

    def add_relationship(self, relationship: Relationship) -> str:
        """Add a relationship between entities."""
        if relationship.source_id not in self.entities:
            raise ValueError(f"Source entity {relationship.source_id} not found")
        if relationship.target_id not in self.entities:
            raise ValueError(f"Target entity {relationship.target_id} not found")

        self.relationships[relationship.id] = relationship
        return relationship.id

    def get_neighbors(
        self, entity_id: str, relationship_type: Optional[RelationshipType] = None
    ) -> List[Tuple[Entity, Relationship]]:
        """Get all neighboring entities."""
        neighbors = []

        for rel in self.relationships.values():
            if rel.source_id == entity_id:
                target = self.entities.get(rel.target_id)
                if target and (
                    relationship_type is None or rel.type == relationship_type
                ):
                    neighbors.append((target, rel))
            elif rel.target_id == entity_id:
                source = self.entities.get(rel.source_id)
                if source and (
                    relationship_type is None or rel.type == relationship_type
                ):
                    neighbors.append((source, rel))

        return neighbors

    def find_path(
        self, source_id: str, target_id: str, max_depth: int = 5
    ) -> List[List[str]]:
        """Find all paths between two entities using BFS."""
        if source_id not in self.entities or target_id not in self.entities:
            return []

        paths = []
        queue = deque([(source_id, [source_id])])
        visited = {source_id}

        while queue:
            current, path = queue.popleft()

            if len(path) > max_depth:
                continue

            if current == target_id:
                paths.append(path)
                continue

            for neighbor, _ in self.get_neighbors(current):
                if neighbor.id not in visited:
                    visited.add(neighbor.id)
                    queue.append((neighbor.id, path + [neighbor.id]))

        return paths

    def add_inference_rule(self, rule: InferenceRule):
        """Add an inference rule to the graph."""
        self.inference_rules.append(rule)

    def apply_inferences(self) -> List[Dict]:
        """Apply all inference rules and return new relationships."""
        new_relationships = []

        for rule in self.inference_rules:
            if rule.evaluate(self.entities, list(self.relationships.values())):
                new_relationships.append(
                    {
                        "rule": rule.name,
                        "conclusion": rule.conclusion,
                        "confidence": rule.confidence,
                    }
                )

        return new_relationships

    def get_common_neighbors(self, entity_id: str, other_id: str) -> List[Entity]:
        """Find common neighbors between two entities."""
        neighbors1 = {n.id for n, _ in self.get_neighbors(entity_id)}
        neighbors2 = {n.id for n, _ in self.get_neighbors(other_id)}

        common = neighbors1 & neighbors2
        return [self.entities[nid] for nid in common if nid in self.entities]

    def get_recommendations(self, entity_id: str, limit: int = 5) -> List[Entity]:
        """Get entity recommendations based on common neighbors."""
        if entity_id not in self.entities:
            return []

        recommendations = defaultdict(float)

        for neighbor, _ in self.get_neighbors(entity_id):
            for common_neighbor, _ in self.get_neighbors(neighbor.id):
                if common_neighbor.id != entity_id:
                    recommendations[common_neighbor.id] += 1

        top_ids = heapq.nlargest(limit, recommendations.items(), key=lambda x: x[1])

        return [self.entities[eid] for eid, _ in top_ids if eid in self.entities]

    def query(
        self,
        entity_type: Optional[EntityType] = None,
        properties_filter: Optional[Dict] = None,
    ) -> List[Entity]:
        """Query entities by type and properties."""
        results = []

        if entity_type:
            entity_ids = self.entity_index.get(entity_type, set())
        else:
            entity_ids = self.entities.keys()

        for eid in entity_ids:
            entity = self.entities[eid]

            if properties_filter:
                match = all(
                    entity.properties.get(k) == v for k, v in properties_filter.items()
                )
                if not match:
                    continue

            results.append(entity)

        return results

    def export_json(self) -> str:
        """Export the graph as JSON."""
        return json.dumps(
            {
                "entities": [e.to_dict() for e in self.entities.values()],
                "relationships": [r.to_dict() for r in self.relationships.values()],
            },
            indent=2,
        )

    def import_json(self, json_str: str):
        """Import entities and relationships from JSON."""
        data = json.loads(json_str)

        self.entities.clear()
        self.relationships.clear()

        for e_data in data.get("entities", []):
            entity = Entity(
                id=e_data["id"],
                type=EntityType(e_data["type"]),
                properties=e_data.get("properties", {}),
                confidence=e_data.get("confidence", 1.0),
            )
            self.add_entity(entity)

        for r_data in data.get("relationships", []):
            relationship = Relationship(
                id=r_data["id"],
                source_id=r_data["source_id"],
                target_id=r_data["target_id"],
                type=RelationshipType(r_data["type"]),
                properties=r_data.get("properties", {}),
                confidence=r_data.get("confidence", 1.0),
            )
            self.add_relationship(relationship)

    def get_statistics(self) -> Dict:
        """Get graph statistics."""
        return {
            "total_entities": len(self.entities),
            "total_relationships": len(self.relationships),
            "entities_by_type": {
                etype.value: len(eids) for etype, eids in self.entity_index.items()
            },
            "relationships_by_type": {
                rtype.value: sum(
                    1 for r in self.relationships.values() if r.type == rtype
                )
                for rtype in RelationshipType
            },
        }


class GraphReasoner:
    """Advanced reasoning over the knowledge graph."""

    def __init__(self, graph: KnowledgeGraph):
        self.graph = graph

    def find_clusters(self) -> List[List[str]]:
        """Find connected components (clusters) in the graph."""
        visited = set()
        clusters = []

        def dfs(node_id: str, cluster: List[str]):
            visited.add(node_id)
            cluster.append(node_id)

            for neighbor, _ in self.graph.get_neighbors(node_id):
                if neighbor.id not in visited:
                    dfs(neighbor.id, cluster)

        for entity_id in self.graph.entities:
            if entity_id not in visited:
                cluster = []
                dfs(entity_id, cluster)
                if cluster:
                    clusters.append(cluster)

        return clusters

    def calculate_centrality(self, entity_id: str) -> float:
        """Calculate degree centrality for an entity."""
        neighbors = self.graph.get_neighbors(entity_id)
        return (
            len(neighbors) / (len(self.graph.entities) - 1)
            if len(self.graph.entities) > 1
            else 0
        )

    def find_most_connected(self, limit: int = 10) -> List[Tuple[str, float]]:
        """Find most connected entities."""
        centrality_scores = []

        for entity_id in self.graph.entities:
            score = self.calculate_centrality(entity_id)
            centrality_scores.append((entity_id, score))

        return sorted(centrality_scores, key=lambda x: x[1], reverse=True)[:limit]


__all__ = [
    "KnowledgeGraph",
    "GraphReasoner",
    "Entity",
    "Relationship",
    "EntityType",
    "RelationshipType",
    "InferenceRule",
]
