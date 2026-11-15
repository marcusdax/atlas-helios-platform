"""
Nexus Mind Few-Shot Learning Module

Implements prototypical networks, N-way K-shot classification,
and dynamic class addition for rapid adaptation.

Based on Phase 5 Advanced Features specification.
"""

import numpy as np
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
import uuid
import random


@dataclass
class FewShotEpisode:
    """Represents a few-shot learning episode."""

    support_set: List[Tuple[np.ndarray, int]] = field(default_factory=list)
    query_set: List[Tuple[np.ndarray, int]] = field(default_factory=list)
    n_way: int = 5
    k_shot: int = 5
    num_query: int = 5


class PrototypicalNetwork:
    """
    Prototypical Networks for Few-Shot Learning.

    Creates class prototypes from support set and classifies
    query samples based on distance to prototypes.
    """

    def __init__(self, embedding_dim: int = 256):
        self.embedding_dim = embedding_dim
        self.class_prototypes: Dict[int, np.ndarray] = {}
        self.class_names: Dict[int, str] = {}
        self.next_class_id = 0

    def compute_prototype(self, support_embeddings: List[np.ndarray]) -> np.ndarray:
        """Compute prototype as mean of support embeddings."""
        if not support_embeddings:
            return np.zeros(self.embedding_dim)

        return np.mean(support_embeddings, axis=0)

    def add_class(self, class_name: str, support_embeddings: List[np.ndarray]):
        """Add a new class with its support set."""
        prototype = self.compute_prototype(support_embeddings)

        # Normalize prototype
        prototype = prototype / (np.linalg.norm(prototype) + 1e-10)

        class_id = self.next_class_id
        self.class_prototypes[class_id] = prototype
        self.class_names[class_id] = class_name
        self.next_class_id += 1

        return class_id

    def classify(self, query_embedding: np.ndarray) -> Tuple[int, str, float]:
        """
        Classify a query embedding.

        Returns:
            (class_id, class_name, confidence)
        """
        if not self.class_prototypes:
            return -1, "unknown", 0.0

        # Normalize query
        query_embedding = query_embedding / (np.linalg.norm(query_embedding) + 1e-10)

        # Compute distances to all prototypes
        distances = {}
        for class_id, prototype in self.class_prototypes.items():
            # Cosine distance = 1 - cosine similarity
            similarity = np.dot(query_embedding, prototype)
            distance = 1.0 - similarity
            distances[class_id] = distance

        # Find nearest prototype
        nearest_class = min(distances, key=distances.get)
        nearest_distance = distances[nearest_class]

        # Convert distance to confidence
        # Using softmax-like transformation
        exp_distances = np.exp(-np.array(list(distances.values())))
        probs = exp_distances / exp_distances.sum()
        confidence = probs[list(distances.keys()).index(nearest_class)]

        return nearest_class, self.class_names[nearest_class], float(confidence)

    def classify_batch(
        self, query_embeddings: List[np.ndarray]
    ) -> List[Tuple[int, str, float]]:
        """Classify multiple query embeddings."""
        return [self.classify(emb) for emb in query_embeddings]

    def get_prototype(self, class_id: int) -> Optional[np.ndarray]:
        """Get prototype for a class."""
        return self.class_prototypes.get(class_id)

    def remove_class(self, class_id: int):
        """Remove a class."""
        if class_id in self.class_prototypes:
            del self.class_prototypes[class_id]
            del self.class_names[class_id]

    def get_num_classes(self) -> int:
        """Get number of registered classes."""
        return len(self.class_prototypes)


class MetricLearner:
    """
    Metric-based few-shot learning with various distance metrics.
    """

    def __init__(self, metric: str = "cosine"):
        self.metric = metric
        self.embeddings: List[np.ndarray] = []
        self.labels: List[int] = []

    def fit(self, embeddings: List[np.ndarray], labels: List[int]):
        """Fit the metric learner with labeled embeddings."""
        self.embeddings = embeddings
        self.labels = labels

    def compute_distance(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Compute distance between two embeddings."""
        if self.metric == "cosine":
            # Cosine distance
            sim = np.dot(emb1, emb2) / (
                np.linalg.norm(emb1) * np.linalg.norm(emb2) + 1e-10
            )
            return 1.0 - sim
        elif self.metric == "euclidean":
            return float(np.linalg.norm(emb1 - emb2))
        elif self.metric == "manhattan":
            return float(np.sum(np.abs(emb1 - emb2)))
        else:
            return 1.0 - np.dot(emb1, emb2)

    def predict(self, query: np.ndarray, k: int = 1) -> List[Tuple[int, float]]:
        """Predict label using k-nearest neighbors."""
        distances = []

        for emb, label in zip(self.embeddings, self.labels):
            dist = self.compute_distance(query, emb)
            distances.append((label, dist))

        # Sort by distance
        distances.sort(key=lambda x: x[1])

        # Get k nearest
        nearest = distances[:k]

        # Vote
        votes = {}
        for label, _ in nearest:
            votes[label] = votes.get(label, 0) + 1

        # Return winner
        winner = max(votes, key=votes.get)
        confidence = votes[winner] / k

        return [(winner, confidence)]


class NWayKShotSampler:
    """Samples N-way K-shot episodes for few-shot learning."""

    def __init__(self, n_way: int = 5, k_shot: int = 5, num_query: int = 5):
        self.n_way = n_way
        self.k_shot = k_shot
        self.num_query = num_query

        self.class_data: Dict[int, List[np.ndarray]] = {}

    def add_class_data(self, class_id: int, embeddings: List[np.ndarray]):
        """Add embedding data for a class."""
        if class_id not in self.class_data:
            self.class_data[class_id] = []
        self.class_data[class_id].extend(embeddings)

    def sample_episode(self) -> FewShotEpisode:
        """Sample a few-shot episode."""
        # Select N classes
        available_classes = list(self.class_data.keys())
        if len(available_classes) < self.n_way:
            raise ValueError(
                f"Not enough classes: {len(available_classes)} < {self.n_way}"
            )

        selected_classes = random.sample(available_classes, self.n_way)

        # Create episode
        episode = FewShotEpisode(n_way=self.n_way, k_shot=self.k_shot)

        for class_id in selected_classes:
            embeddings = self.class_data[class_id]

            if len(embeddings) < self.k_shot + self.num_query:
                continue

            # Sample support and query sets
            sampled = random.sample(embeddings, self.k_shot + self.num_query)

            # Add to episode
            for emb in sampled[: self.k_shot]:
                episode.support_set.append((emb, class_id))

            for emb in sampled[self.k_shot :]:
                episode.query_set.append((emb, class_id))

        return episode


class FewShotClassifier:
    """
    Main few-shot classifier combining prototypical networks
    and metric learning.
    """

    def __init__(self, embedding_dim: int = 256, method: str = "prototypical"):
        self.embedding_dim = embedding_dim
        self.method = method

        if method == "prototypical":
            self.model = PrototypicalNetwork(embedding_dim)
        else:
            self.model = MetricLearner()

        self.sampler = NWayKShotSampler()

    def add_support_set(self, class_name: str, embeddings: List[np.ndarray]) -> int:
        """Add a support set for a class."""
        class_id = self.model.add_class(class_name, embeddings)

        # Also add to sampler
        self.sampler.add_class_data(class_id, embeddings)

        return class_id

    def predict(self, query_embedding: np.ndarray) -> Tuple[str, float]:
        """Predict class for a query embedding."""
        return self.model.classify(query_embedding)

    def predict_batch(
        self, query_embeddings: List[np.ndarray]
    ) -> List[Tuple[str, float]]:
        """Batch prediction."""
        return self.model.classify_batch(query_embeddings)

    def create_episode(self) -> FewShotEpisode:
        """Create a few-shot episode for evaluation."""
        return self.sampler.sample_episode()

    def evaluate_episode(self, episode: FewShotEpisode) -> Dict:
        """Evaluate a few-shot episode."""
        # Compute prototypes from support set
        prototypes = {}
        for emb, label in episode.support_set:
            if label not in prototypes:
                prototypes[label] = []
            prototypes[label].append(emb)

        # Compute prototype for each class
        for label in prototypes:
            prototypes[label] = np.mean(prototypes[label], axis=0)

        # Classify query samples
        correct = 0
        total = len(episode.query_set)

        for query_emb, true_label in episode.query_set:
            # Compute distances to prototypes
            distances = {}
            for label, prototype in prototypes.items():
                dist = 1.0 - np.dot(
                    query_emb / (np.linalg.norm(query_emb) + 1e-10),
                    prototype / (np.linalg.norm(prototype) + 1e-10),
                )
                distances[label] = dist

            # Predict
            predicted = min(distances, key=distances.get)

            if predicted == true_label:
                correct += 1

        accuracy = correct / total if total > 0 else 0.0

        return {
            "accuracy": accuracy,
            "correct": correct,
            "total": total,
            "n_way": episode.n_way,
            "k_shot": episode.k_shot,
        }

    def get_num_classes(self) -> int:
        """Get number of registered classes."""
        return self.model.get_num_classes()

    def get_classes(self) -> List[str]:
        """Get list of registered class names."""
        return list(self.model.class_names.values())


__all__ = [
    "FewShotClassifier",
    "PrototypicalNetwork",
    "MetricLearner",
    "NWayKShotSampler",
    "FewShotEpisode",
]
