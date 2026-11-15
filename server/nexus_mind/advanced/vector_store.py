"""
Nexus Mind Vector Store Module

Enterprise-grade vector store with semantic search,
embedding generation, and hybrid search capabilities.

Based on Phase 5 Advanced Features specification.
"""

import numpy as np
from typing import List, Dict, Optional, Tuple, Any, Callable
from dataclasses import dataclass, field
import uuid
import json
import time
from collections import defaultdict
import hashlib


# Try to import optional dependencies
SENTENCE_TRANSFORMERS_AVAILABLE = False
FAISS_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer

    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    pass

try:
    import faiss

    FAISS_AVAILABLE = True
except ImportError:
    pass


@dataclass
class VectorEntry:
    """Represents a vector entry in the store."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    vector: np.ndarray = None
    text: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=lambda: time.time())

    def __post_init__(self):
        if self.vector is None:
            self.vector = np.array([])


class EmbeddingGenerator:
    """Generates embeddings for text using sentence transformers."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", device: str = "cpu"):
        self.model_name = model_name
        self.device = device
        self.model = None
        self.dimension = 384

        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.model = SentenceTransformer(model_name, device=device)
                self.dimension = self.model.get_sentence_embedding_dimension()
            except Exception as e:
                print(f"Failed to load sentence transformer: {e}")
                self._create_fallback_generator()
        else:
            self._create_fallback_generator()

    def _create_fallback_generator(self):
        """Create a simple hash-based embedding generator as fallback."""
        self.model = None
        self.dimension = 384

    def encode(self, texts: List[str], batch_size: int = 32) -> np.ndarray:
        """Encode texts to embeddings."""
        if self.model is not None:
            embeddings = self.model.encode(
                texts,
                batch_size=batch_size,
                show_progress_bar=False,
                convert_to_numpy=True,
            )
            return embeddings

        # Fallback: generate deterministic embeddings from text hash
        embeddings = []
        for text in texts:
            # Create a deterministic embedding from text
            hash_input = text.encode("utf-8")
            hash_val = hashlib.sha256(hash_input).digest()

            # Convert hash to normalized float array
            arr = np.frombuffer(hash_val[: self.dimension], dtype=np.uint8)
            arr = arr.astype(np.float32)
            arr = arr / 255.0 * 2.0 - 1.0  # Normalize to [-1, 1]

            # Pad or truncate to required dimension
            if len(arr) < self.dimension:
                arr = np.pad(arr, (0, self.dimension - len(arr)))
            else:
                arr = arr[: self.dimension]

            # Add some variation based on text length
            arr = arr * (1.0 + len(text) * 0.001)
            arr = arr / np.linalg.norm(arr)  # Re-normalize

            embeddings.append(arr)

        return np.array(embeddings)

    def encode_single(self, text: str) -> np.ndarray:
        """Encode a single text."""
        return self.encode([text])[0]


class VectorIndex:
    """Base class for vector indices."""

    def __init__(self, dimension: int):
        self.dimension = dimension
        self.entries: Dict[str, VectorEntry] = {}

    def add(self, entry: VectorEntry):
        raise NotImplementedError

    def search(self, query: np.ndarray, k: int = 5) -> List[Tuple[str, float]]:
        raise NotImplementedError

    def delete(self, entry_id: str):
        raise NotImplementedError


class FlatIndex(VectorIndex):
    """Simple flat (brute-force) vector index."""

    def __init__(self, dimension: int):
        super().__init__(dimension)
        self.vectors: List[np.ndarray] = []
        self.ids: List[str] = []

    def add(self, entry: VectorEntry):
        self.entries[entry.id] = entry
        self.vectors.append(entry.vector)
        self.ids.append(entry.id)

    def search(self, query: np.ndarray, k: int = 5) -> List[Tuple[str, float]]:
        if not self.vectors:
            return []

        vectors = np.array(self.vectors)

        # Compute cosine similarity
        norms = np.linalg.norm(vectors, axis=1) * np.linalg.norm(query)
        similarities = np.dot(vectors, query) / (norms + 1e-10)

        # Get top-k indices
        top_k_idx = np.argsort(similarities)[-k:][::-1]

        return [(self.ids[idx], float(similarities[idx])) for idx in top_k_idx]

    def delete(self, entry_id: str):
        if entry_id not in self.entries:
            return

        idx = self.ids.index(entry_id)
        del self.entries[entry_id]
        del self.vectors[idx]
        del self.ids[idx]


class FAISSIndex(VectorIndex):
    """FAISS-based vector index for efficient similarity search."""

    def __init__(self, dimension: int, index_type: str = "hnsw"):
        super().__init__(dimension)

        if not FAISS_AVAILABLE:
            raise ImportError("faiss-cpu not installed")

        self.index_type = index_type

        if index_type == "hnsw":
            self.index = faiss.IndexHNSWFlat(dimension, 32)
        elif index_type == "ivf":
            quantizer = faiss.IndexFlatL2(dimension)
            self.index = faiss.IndexIVFFlat(quantizer, dimension, 100)
        else:
            self.index = faiss.IndexFlatL2(dimension)

        self.id_to_idx: Dict[str, int] = {}
        self.idx_to_id: Dict[int, str] = {}
        self.next_idx = 0

    def add(self, entry: VectorEntry):
        self.entries[entry.id] = entry

        vec = entry.vector.reshape(1, -1).astype("float32")
        self.index.add(vec)

        self.id_to_idx[entry.id] = self.next_idx
        self.idx_to_id[self.next_idx] = entry.id
        self.next_idx += 1

    def search(self, query: np.ndarray, k: int = 5) -> List[Tuple[str, float]]:
        if self.index.ntotal == 0:
            return []

        query = query.reshape(1, -1).astype("float32")
        distances, indices = self.index.search(query, k)

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx >= 0 and idx in self.idx_to_id:
                # Convert L2 distance to similarity
                similarity = 1.0 / (1.0 + dist)
                results.append((self.idx_to_id[idx], float(similarity)))

        return results

    def delete(self, entry_id: str):
        # FAISS doesn't support direct deletion, mark as removed
        if entry_id in self.entries:
            del self.entries[entry_id]


class VectorStore:
    """
    Main vector store with embedding generation,
    multiple index types, and hybrid search.
    """

    def __init__(
        self, dimension: int = 384, index_type: str = "auto", use_faiss: bool = True
    ):
        self.dimension = dimension
        self.embedding_generator = EmbeddingGenerator()

        # Override dimension if model loaded
        if self.embedding_generator.model is not None:
            self.dimension = self.embedding_generator.dimension

        # Initialize index
        if use_faiss and FAISS_AVAILABLE and index_type != "flat":
            try:
                self.index = FAISSIndex(self.dimension, index_type)
                print(f"Using FAISS {index_type} index")
            except Exception as e:
                print(f"FAISS index failed: {e}, using flat index")
                self.index = FlatIndex(self.dimension)
        else:
            self.index = FlatIndex(self.dimension)

        self.metadata_index: Dict[str, List[str]] = defaultdict(list)

    def add_text(
        self,
        text: str,
        metadata: Optional[Dict] = None,
        generate_embedding: bool = True,
    ) -> str:
        """Add a text entry to the vector store."""
        if generate_embedding:
            vector = self.embedding_generator.encode_single(text)
        else:
            vector = np.zeros(self.dimension, dtype=np.float32)

        entry = VectorEntry(text=text, vector=vector, metadata=metadata or {})

        self.index.add(entry)

        # Index metadata
        for key, value in (metadata or {}).items():
            self.metadata_index[f"{key}:{value}"].append(entry.id)

        return entry.id

    def add_vector(
        self, vector: np.ndarray, text: str = "", metadata: Optional[Dict] = None
    ) -> str:
        """Add a vector entry directly."""
        # Ensure correct dimension
        if len(vector) != self.dimension:
            if len(vector) < self.dimension:
                vector = np.pad(vector, (0, self.dimension - len(vector)))
            else:
                vector = vector[: self.dimension]

        entry = VectorEntry(
            text=text, vector=vector.astype(np.float32), metadata=metadata or {}
        )

        self.index.add(entry)

        # Index metadata
        for key, value in (metadata or {}).items():
            self.metadata_index[f"{key}:{value}"].append(entry.id)

        return entry.id

    def search(
        self,
        query: str,
        k: int = 5,
        filters: Optional[Dict] = None,
        use_hybrid: bool = False,
    ) -> List[Dict]:
        """Search for similar vectors."""
        # Generate query embedding
        query_vector = self.embedding_generator.encode_single(query)

        # Get candidates from vector search
        candidates = self.index.search(query_vector, k=k * 10 if filters else k)

        results = []
        for entry_id, score in candidates:
            entry = self.index.entries.get(entry_id)
            if not entry:
                continue

            # Apply filters
            if filters:
                if not all(entry.metadata.get(k) == v for k, v in filters.items()):
                    continue

            results.append(
                {
                    "id": entry.id,
                    "text": entry.text,
                    "score": score,
                    "metadata": entry.metadata,
                    "created_at": entry.created_at,
                }
            )

            if len(results) >= k:
                break

        return results

    def search_by_vector(
        self, vector: np.ndarray, k: int = 5, filters: Optional[Dict] = None
    ) -> List[Dict]:
        """Search by vector directly."""
        candidates = self.index.search(vector, k=k * 10 if filters else k)

        results = []
        for entry_id, score in candidates:
            entry = self.index.entries.get(entry_id)
            if not entry:
                continue

            if filters:
                if not all(entry.metadata.get(k) == v for k, v in filters.items()):
                    continue

            results.append(
                {
                    "id": entry.id,
                    "text": entry.text,
                    "score": score,
                    "metadata": entry.metadata,
                }
            )

            if len(results) >= k:
                break

        return results

    def delete(self, entry_id: str):
        """Delete an entry by ID."""
        self.index.delete(entry_id)

    def get(self, entry_id: str) -> Optional[Dict]:
        """Get an entry by ID."""
        entry = self.index.entries.get(entry_id)
        if not entry:
            return None

        return {
            "id": entry.id,
            "text": entry.text,
            "vector": entry.vector.tolist(),
            "metadata": entry.metadata,
            "created_at": entry.created_at,
        }

    def count(self) -> int:
        """Get total number of entries."""
        return len(self.index.entries)

    def export(self) -> Dict:
        """Export the vector store."""
        return {
            "dimension": self.dimension,
            "entries": [
                {
                    "id": e.id,
                    "text": e.text,
                    "vector": e.vector.tolist(),
                    "metadata": e.metadata,
                }
                for e in self.index.entries.values()
            ],
        }

    def import_data(self, data: Dict):
        """Import entries into the vector store."""
        for entry_data in data.get("entries", []):
            self.add_vector(
                vector=np.array(entry_data["vector"]),
                text=entry_data.get("text", ""),
                metadata=entry_data.get("metadata", {}),
            )


class HybridSearcher:
    """Combines vector search with graph-based knowledge."""

    def __init__(self, vector_store: VectorStore, knowledge_graph=None):
        self.vector_store = vector_store
        self.knowledge_graph = knowledge_graph

    def search(self, query: str, k: int = 5, boost_entities: bool = True) -> List[Dict]:
        """Hybrid search combining vector and graph results."""
        vector_results = self.vector_store.search(query, k=k * 2)

        if not boost_entities or not self.knowledge_graph:
            return vector_results[:k]

        # Boost scores for entities that are connected to query entities
        boosted_results = []
        for result in vector_results:
            score = result["score"]

            # Check if entity is related to high-confidence entities
            entity_id = result.get("metadata", {}).get("entity_id")
            if entity_id:
                neighbors = self.knowledge_graph.get_neighbors(entity_id)
                for neighbor, rel in neighbors:
                    if neighbor.confidence > 0.8:
                        score *= 1.2  # Boost by 20%

            result["boosted_score"] = min(score, 1.0)
            boosted_results.append(result)

        # Re-sort by boosted score
        boosted_results.sort(key=lambda x: x["boosted_score"], reverse=True)

        return boosted_results[:k]


__all__ = [
    "VectorStore",
    "HybridSearcher",
    "VectorEntry",
    "EmbeddingGenerator",
    "FAISS_AVAILABLE",
    "SENTENCE_TRANSFORMERS_AVAILABLE",
]
