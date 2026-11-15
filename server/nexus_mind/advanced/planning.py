"""
Nexus Mind Planning & Memory Module

Implements task planning, decomposition, episodic memory,
and working memory for context management.

Based on Phase 5 Advanced Features specification.
"""

import uuid
import time
import json
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque
import heapq


class TaskStatus(Enum):
    """Status of a task."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"


@dataclass
class Task:
    """Represents a task in a plan."""

    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    dependencies: Set[str] = field(default_factory=set)
    status: TaskStatus = TaskStatus.PENDING
    priority: int = 0
    result: Any = None
    error: Optional[str] = None
    created_at: float = field(default_factory=lambda: time.time())
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class TaskDecomposer:
    """Decomposes complex goals into tasks."""

    def __init__(self):
        self.decomposition_templates = {
            "investigation": [
                "gather_evidence",
                "analyze_data",
                "form_hypothesis",
                "verify",
            ],
            "analysis": ["collect_data", "process_data", "generate_insights", "report"],
            "verification": [
                "check_prerequisites",
                "validate_inputs",
                "execute_check",
                "report_results",
            ],
            "response": [
                "assess_situation",
                "plan_response",
                "execute_response",
                "evaluate_outcome",
            ],
        }

    def decompose(self, goal: str, goal_type: str = "investigation") -> List[Task]:
        """Decompose a goal into tasks."""
        template = self.decomposition_templates.get(
            goal_type, ["analyze", "execute", "report"]
        )

        tasks = []
        for i, task_name in enumerate(template):
            task = Task(
                name=task_name,
                description=f"{task_name} for goal: {goal}",
                priority=len(template) - i,
                dependencies=set(tasks[-1:]) if tasks else set(),
            )
            tasks.append(task)

        return tasks

    def decompose_with_llm(self, goal: str, context: Dict) -> List[Task]:
        """Decompose using LLM (placeholder)."""
        # In production, use LLM to decompose
        return self.decompose(goal, "investigation")


class TopologicalPlanner:
    """Plans tasks using topological ordering."""

    def __init__(self):
        self.tasks: Dict[str, Task] = {}

    def add_task(self, task: Task):
        """Add a task to the plan."""
        self.tasks[task.task_id] = task

    def get_ready_tasks(self) -> List[Task]:
        """Get tasks that are ready to execute (all dependencies met)."""
        ready = []

        for task in self.tasks.values():
            if task.status != TaskStatus.PENDING:
                continue

            # Check if all dependencies are completed
            deps_met = all(
                self.tasks[dep_id].status == TaskStatus.COMPLETED
                for dep_id in task.dependencies
                if dep_id in self.tasks
            )

            if deps_met:
                ready.append(task)

        # Sort by priority
        ready.sort(key=lambda t: t.priority, reverse=True)

        return ready

    def execute_task(self, task_id: str) -> bool:
        """Mark a task as executing."""
        if task_id not in self.tasks:
            return False

        task = self.tasks[task_id]

        # Check dependencies
        deps_met = all(
            self.tasks[dep_id].status == TaskStatus.COMPLETED
            for dep_id in task.dependencies
            if dep_id in self.tasks
        )

        if not deps_met:
            task.status = TaskStatus.BLOCKED
            return False

        task.status = TaskStatus.RUNNING
        task.started_at = time.time()

        return True

    def complete_task(self, task_id: str, result: Any = None):
        """Mark a task as completed."""
        if task_id not in self.tasks:
            return

        task = self.tasks[task_id]
        task.status = TaskStatus.COMPLETED
        task.completed_at = time.time()
        task.result = result

    def fail_task(self, task_id: str, error: str):
        """Mark a task as failed."""
        if task_id not in self.tasks:
            return

        task = self.tasks[task_id]
        task.status = TaskStatus.FAILED
        task.completed_at = time.time()
        task.error = error

    def is_complete(self) -> bool:
        """Check if all tasks are complete."""
        return all(task.status == TaskStatus.COMPLETED for task in self.tasks.values())

    def get_execution_order(self) -> List[List[Task]]:
        """Get execution order as list of parallel batches."""
        execution_order = []

        while not self.is_complete():
            ready = self.get_ready_tasks()

            if not ready:
                # Check for blocked tasks
                blocked = [
                    t for t in self.tasks.values() if t.status == TaskStatus.BLOCKED
                ]
                if blocked:
                    break
                break

            execution_order.append(ready)

            # Mark as running
            for task in ready:
                self.execute_task(task.task_id)

        return execution_order


class EpisodicMemory:
    """Stores episodic memories of experiences."""

    def __init__(self, max_memories: int = 1000):
        self.max_memories = max_memories
        self.memories: deque = deque(maxlen=max_memories)
        self.memory_index: Dict[str, List[int]] = defaultdict(list)

    def store(
        self, experience: Dict[str, Any], tags: Optional[List[str]] = None
    ) -> str:
        """Store an experience in memory."""
        memory_id = str(uuid.uuid4())

        memory = {
            "id": memory_id,
            "experience": experience,
            "timestamp": time.time(),
            "tags": tags or [],
        }

        self.memories.append(memory)

        # Index by tags
        for tag in tags or []:
            self.memory_index[tag].append(len(self.memories) - 1)

        return memory_id

    def retrieve(
        self,
        query: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[Dict]:
        """Retrieve memories matching query or tags."""
        results = []

        # Search by tags
        if tags:
            for tag in tags:
                if tag in self.memory_index:
                    for idx in self.memory_index[tag]:
                        results.append(self.memories[idx])
        else:
            results = list(self.memories)

        # Sort by timestamp (most recent first)
        results.sort(key=lambda x: x["timestamp"], reverse=True)

        return results[:limit]

    def get_recent(self, limit: int = 10) -> List[Dict]:
        """Get most recent memories."""
        return list(self.memories)[-limit:][::-1]

    def clear(self):
        """Clear all memories."""
        self.memories.clear()
        self.memory_index.clear()


class WorkingMemory:
    """Manages current context and short-term information."""

    def __init__(self):
        self.context: Dict[str, Any] = {}
        self.stack: List[Dict[str, Any]] = []
        self.focus: Optional[str] = None

    def set(self, key: str, value: Any):
        """Set a context value."""
        self.context[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        """Get a context value."""
        return self.context.get(key, default)

    def update(self, updates: Dict[str, Any]):
        """Update multiple context values."""
        self.context.update(updates)

    def push(self, frame: Dict[str, Any]):
        """Push a new context frame."""
        self.stack.append(self.context.copy())
        self.context.update(frame)

    def pop(self) -> Optional[Dict]:
        """Pop and restore previous context."""
        if self.stack:
            self.context = self.stack.pop()
            return self.context
        return None

    def clear(self):
        """Clear all context."""
        self.context.clear()
        self.stack.clear()
        self.focus = None

    def set_focus(self, focus: str):
        """Set current focus."""
        self.focus = focus

    def get_focused(self) -> Dict[str, Any]:
        """Get focused context."""
        if self.focus:
            return self.context.get(self.focus, {})
        return self.context


class MemorySystem:
    """
    Unified memory system combining episodic and working memory.
    """

    def __init__(self, max_episodic: int = 1000):
        self.episodic = EpisodicMemory(max_episodic)
        self.working = WorkingMemory()

    def remember(self, experience: Dict, tags: Optional[List[str]] = None):
        """Store experience in episodic memory."""
        # Also store in working memory
        self.working.set("last_experience", experience)

        # Store in episodic
        return self.episodic.store(experience, tags)

    def recall(
        self,
        query: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 10,
    ) -> List[Dict]:
        """Recall from episodic memory."""
        return self.episodic.retrieve(query, tags, limit)

    def get_context(self) -> Dict[str, Any]:
        """Get current working context."""
        return self.working.context.copy()

    def update_context(self, updates: Dict[str, Any]):
        """Update working context."""
        self.working.update(updates)

    def focus_on(self, focus: str):
        """Focus working memory on specific context."""
        self.working.set_focus(focus)


class PlanningEngine:
    """
    Main planning engine combining task decomposition and memory.
    """

    def __init__(self):
        self.decomposer = TaskDecomposer()
        self.planner = TopologicalPlanner()
        self.memory = MemorySystem()

        self.current_plan_id: Optional[str] = None

    def create_plan(
        self,
        goal: str,
        goal_type: str = "investigation",
        context: Optional[Dict] = None,
    ) -> str:
        """Create a plan for a goal."""
        # Store context in working memory
        if context:
            self.memory.update_context(context)

        # Decompose goal into tasks
        tasks = self.decomposer.decompose(goal, goal_type)

        # Add tasks to planner
        for task in tasks:
            self.planner.add_task(task)

        self.current_plan_id = str(uuid.uuid4())

        # Store plan in episodic memory
        self.memory.remember(
            {
                "type": "plan_created",
                "goal": goal,
                "goal_type": goal_type,
                "task_count": len(tasks),
            },
            tags=["plan", goal_type],
        )

        return self.current_plan_id

    def get_next_tasks(self) -> List[Task]:
        """Get tasks ready to execute."""
        return self.planner.get_ready_tasks()

    def execute_task(self, task_id: str) -> bool:
        """Execute a task."""
        return self.planner.execute_task(task_id)

    def complete_task(self, task_id: str, result: Any = None):
        """Mark task as completed."""
        self.planner.complete_task(task_id, result)

        # Update context with result
        if result:
            self.memory.update_context({f"task_{task_id}_result": result})

        # Store in episodic
        self.memory.remember(
            {"type": "task_completed", "task_id": task_id, "result": str(result)[:100]},
            tags=["task", "completed"],
        )

    def fail_task(self, task_id: str, error: str):
        """Mark task as failed."""
        self.planner.fail_task(task_id, error)

        # Store failure in episodic
        self.memory.remember(
            {"type": "task_failed", "task_id": task_id, "error": error},
            tags=["task", "failed"],
        )

    def get_plan_status(self) -> Dict:
        """Get current plan status."""
        return {
            "plan_id": self.current_plan_id,
            "total_tasks": len(self.planner.tasks),
            "completed": sum(
                1
                for t in self.planner.tasks.values()
                if t.status == TaskStatus.COMPLETED
            ),
            "running": sum(
                1 for t in self.planner.tasks.values() if t.status == TaskStatus.RUNNING
            ),
            "pending": sum(
                1 for t in self.planner.tasks.values() if t.status == TaskStatus.PENDING
            ),
            "failed": sum(
                1 for t in self.planner.tasks.values() if t.status == TaskStatus.FAILED
            ),
            "is_complete": self.planner.is_complete(),
        }

    def get_context(self) -> Dict:
        """Get current context."""
        return self.memory.get_context()


__all__ = [
    "PlanningEngine",
    "TaskDecomposer",
    "TopologicalPlanner",
    "MemorySystem",
    "EpisodicMemory",
    "WorkingMemory",
    "Task",
    "TaskStatus",
]
