"""
Nexus Mind Advanced Package

Exports all advanced modules including:
- Knowledge Graph
- Vector Store
- Audio Engine
- Few-Shot Learning
- Agent Framework
- Video Temporal Engine
- Planning & Memory
- A/B Testing
- Explainability
"""

# Knowledge Graph
from nexus_mind.advanced.knowledge_graph import (
    KnowledgeGraph,
    GraphReasoner,
    Entity,
    Relationship,
    EntityType,
    RelationshipType,
    InferenceRule,
)

# Vector Store
from nexus_mind.advanced.vector_store import (
    VectorStore,
    HybridSearcher,
    VectorEntry,
    EmbeddingGenerator,
    FAISS_AVAILABLE,
    SENTENCE_TRANSFORMERS_AVAILABLE,
)

# Audio Engine
from nexus_mind.advanced.audio_engine import (
    AudioEngine,
    AudioPreprocessor,
    FeatureExtractor,
    SoundClassifier,
    SpeakerIdentifier,
    EmotionDetector,
    AudioConfig,
    AudioFrame,
    LIBROSA_AVAILABLE,
    WHISPER_AVAILABLE,
)

# Few-Shot Learning
from nexus_mind.advanced.few_shot import (
    FewShotClassifier,
    PrototypicalNetwork,
    MetricLearner,
    NWayKShotSampler,
    FewShotEpisode,
)

# Agent Framework
from nexus_mind.advanced.agent import (
    NexusAgent,
    ToolRegistry,
    ActionPlanner,
    ExecutionEngine,
    MultiAgentCoordinator,
    Tool,
    ToolResult,
    AgentAction,
    AgentPlan,
    AgentState,
    AgentStatus,
    ToolType,
)

# Video Temporal Engine
from nexus_mind.advanced.video_engine import (
    VideoTemporalEngine,
    FrameExtractor,
    TemporalEncoder,
    SlowFastEncoder,
    ActionRecognizer,
    ActivityDetector,
    VideoFrame,
    VideoClip,
)

# Planning & Memory
from nexus_mind.advanced.planning import (
    PlanningEngine,
    TaskDecomposer,
    TopologicalPlanner,
    MemorySystem,
    EpisodicMemory,
    WorkingMemory,
    Task,
    TaskStatus,
)

# A/B Testing
from nexus_mind.advanced.experiments import (
    ExperimentRunner,
    Experiment,
    Variant,
    Assignment,
    Metric,
    ExperimentStatus,
)

# Explainability
from nexus_mind.advanced.explainability import (
    ExplainabilityEngine,
    DecisionExplainer,
    SHAPAttributor,
    FeatureAttributor,
    InterpretableOutput,
    FeatureImportance,
    DecisionExplanation,
)


__all__ = [
    # Core
    "KnowledgeGraph",
    "GraphReasoner",
    "VectorStore",
    "HybridSearcher",
    "AudioEngine",
    "FewShotClassifier",
    "NexusAgent",
    "VideoTemporalEngine",
    "PlanningEngine",
    "ExperimentRunner",
    "ExplainabilityEngine",
    # Knowledge Graph
    "Entity",
    "Relationship",
    "EntityType",
    "RelationshipType",
    "InferenceRule",
    # Vector Store
    "VectorEntry",
    "EmbeddingGenerator",
    "FAISS_AVAILABLE",
    "SENTENCE_TRANSFORMERS_AVAILABLE",
    # Audio
    "AudioPreprocessor",
    "FeatureExtractor",
    "SoundClassifier",
    "SpeakerIdentifier",
    "EmotionDetector",
    "AudioConfig",
    "AudioFrame",
    "LIBROSA_AVAILABLE",
    "WHISPER_AVAILABLE",
    # Few-Shot
    "PrototypicalNetwork",
    "MetricLearner",
    "NWayKShotSampler",
    "FewShotEpisode",
    # Agent
    "ToolRegistry",
    "ActionPlanner",
    "ExecutionEngine",
    "MultiAgentCoordinator",
    "Tool",
    "ToolResult",
    "AgentAction",
    "AgentPlan",
    "AgentState",
    "AgentStatus",
    "ToolType",
    # Video
    "FrameExtractor",
    "TemporalEncoder",
    "SlowFastEncoder",
    "ActionRecognizer",
    "ActivityDetector",
    "VideoFrame",
    "VideoClip",
    # Planning
    "TaskDecomposer",
    "TopologicalPlanner",
    "MemorySystem",
    "EpisodicMemory",
    "WorkingMemory",
    "Task",
    "TaskStatus",
    # Experiments
    "Experiment",
    "Variant",
    "Assignment",
    "Metric",
    "ExperimentStatus",
    # Explainability
    "DecisionExplainer",
    "SHAPAttributor",
    "FeatureAttributor",
    "InterpretableOutput",
    "FeatureImportance",
    "DecisionExplanation",
]
