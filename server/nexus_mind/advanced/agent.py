"""
Nexus Mind Agent Framework Module

Implements autonomous agents with tool registry, action planning,
execution engine, and error handling capabilities.

Based on Phase 5 Advanced Features specification.
"""

import uuid
import time
import json
import asyncio
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import logging


logger = logging.getLogger(__name__)


class AgentStatus(Enum):
    """Status of an agent."""

    IDLE = "idle"
    THINKING = "thinking"
    ACTING = "acting"
    WAITING = "waiting"
    ERROR = "error"
    COMPLETED = "completed"


class ToolType(Enum):
    """Types of tools available to agents."""

    HTTP = "http_request"
    SEARCH = "search"
    CALCULATE = "calculate"
    TRANSFORM = "transform"
    QUERY = "query"
    EXECUTE = "execute"
    CUSTOM = "custom"


@dataclass
class Tool:
    """Represents a tool that an agent can use."""

    name: str
    description: str
    tool_type: ToolType
    parameters: Dict[str, Any] = field(default_factory=dict)
    handler: Optional[Callable] = None
    requires_auth: bool = False
    rate_limit: int = 100  # per minute

    def execute(self, params: Dict[str, Any], context: Dict[str, Any]) -> Any:
        """Execute the tool."""
        if self.handler:
            return self.handler(params, context)
        return {"error": "No handler defined"}


@dataclass
class ToolResult:
    """Result of tool execution."""

    tool_name: str
    success: bool
    result: Any = None
    error: Optional[str] = None
    execution_time: float = 0.0
    timestamp: float = field(default_factory=lambda: time.time())


@dataclass
class AgentAction:
    """Represents an action to be taken by an agent."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tool_name: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)
    depends_on: List[str] = field(default_factory=list)
    status: AgentStatus = AgentStatus.IDLE
    result: Optional[ToolResult] = None
    created_at: float = field(default_factory=lambda: time.time())


@dataclass
class AgentPlan:
    """Represents a plan of actions for an agent."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    goal: str = ""
    actions: List[AgentAction] = field(default_factory=list)
    status: AgentStatus = AgentStatus.IDLE
    created_at: float = field(default_factory=lambda: time.time())
    completed_at: Optional[float] = None


@dataclass
class AgentState:
    """Current state of an agent."""

    agent_id: str
    status: AgentStatus = AgentStatus.IDLE
    current_plan: Optional[AgentPlan] = None
    memory: Dict[str, Any] = field(default_factory=dict)
    context: Dict[str, Any] = field(default_factory=dict)
    history: List[Dict] = field(default_factory=list)


class ToolRegistry:
    """
    Registry for managing available tools.
    """

    def __init__(self):
        self.tools: Dict[str, Tool] = {}
        self._register_default_tools()

    def _register_default_tools(self):
        """Register default built-in tools."""

        def http_handler(params: Dict, context: Dict) -> Dict:
            # Simple HTTP handler placeholder
            return {
                "method": params.get("method", "GET"),
                "url": params.get("url", ""),
                "status": "simulated",
            }

        def search_handler(params: Dict, context: Dict) -> Dict:
            # Simple search handler placeholder
            return {"query": params.get("query", ""), "results": []}

        def calculate_handler(params: Dict, context: Dict) -> Any:
            # Simple calculation
            expr = params.get("expression", "0")
            try:
                return {"result": eval(expr, {"__builtins__": {}}, {})}
            except:
                return {"error": "Invalid expression"}

        def transform_handler(params: Dict, context: Dict) -> Any:
            # Data transformation
            data = params.get("data", {})
            operation = params.get("operation", "identity")

            if operation == "identity":
                return data
            elif operation == "uppercase":
                return {k: str(v).upper() for k, v in data.items()}
            elif operation == "lowercase":
                return {k: str(v).lower() for k, v in data.items()}

            return data

        # Register default tools
        self.register(
            Tool(
                name="http_request",
                description="Make HTTP requests",
                tool_type=ToolType.HTTP,
                handler=http_handler,
                requires_auth=True,
            )
        )

        self.register(
            Tool(
                name="search",
                description="Search for information",
                tool_type=ToolType.SEARCH,
                handler=search_handler,
            )
        )

        self.register(
            Tool(
                name="calculate",
                description="Perform calculations",
                tool_type=ToolType.CALCULATE,
                handler=calculate_handler,
            )
        )

        self.register(
            Tool(
                name="transform",
                description="Transform data",
                tool_type=ToolType.TRANSFORM,
                handler=transform_handler,
            )
        )

    def register(self, tool: Tool):
        """Register a new tool."""
        self.tools[tool.name] = tool
        logger.info(f"Registered tool: {tool.name}")

    def unregister(self, tool_name: str):
        """Unregister a tool."""
        if tool_name in self.tools:
            del self.tools[tool_name]

    def get(self, tool_name: str) -> Optional[Tool]:
        """Get a tool by name."""
        return self.tools.get(tool_name)

    def list_tools(self) -> List[Dict]:
        """List all available tools."""
        return [
            {
                "name": t.name,
                "description": t.description,
                "type": t.tool_type.value,
                "requires_auth": t.requires_auth,
            }
            for t in self.tools.values()
        ]

    def search(self, query: str) -> List[Tool]:
        """Search tools by name or description."""
        query = query.lower()
        return [
            t
            for t in self.tools.values()
            if query in t.name.lower() or query in t.description.lower()
        ]


class ActionPlanner:
    """
    Plans actions to achieve goals.
    """

    def __init__(self, tool_registry: ToolRegistry):
        self.tool_registry = tool_registry

    def create_plan(self, goal: str, context: Dict[str, Any]) -> AgentPlan:
        """Create a plan to achieve a goal."""
        plan = AgentPlan(goal=goal)

        # Simple planning: decompose goal into actions
        # In production, this would use LLM-based planning

        if "search" in goal.lower() or "find" in goal.lower():
            action = AgentAction(
                tool_name="search", parameters={"query": context.get("query", goal)}
            )
            plan.actions.append(action)

        elif "calculate" in goal.lower() or "compute" in goal.lower():
            action = AgentAction(
                tool_name="calculate",
                parameters={"expression": context.get("expression", "0")},
            )
            plan.actions.append(action)

        elif "transform" in goal.lower() or "convert" in goal.lower():
            action = AgentAction(
                tool_name="transform",
                parameters={
                    "data": context.get("data", {}),
                    "operation": context.get("operation", "identity"),
                },
            )
            plan.actions.append(action)

        else:
            # Generic HTTP request
            action = AgentAction(
                tool_name="http_request", parameters=context.get("http", {})
            )
            plan.actions.append(action)

        return plan

    def decompose_complex_goal(
        self, goal: str, available_tools: List[str]
    ) -> List[AgentAction]:
        """Decompose a complex goal into action sequence."""
        actions = []

        # Parse goal and create action sequence
        # This is a simplified version

        action = AgentAction(
            tool_name=available_tools[0] if available_tools else "search",
            parameters={"goal": goal},
        )
        actions.append(action)

        return actions


class ExecutionEngine:
    """
    Executes agent actions with error handling and retries.
    """

    def __init__(self, tool_registry: ToolRegistry):
        self.tool_registry = tool_registry
        self.max_retries = 3
        self.retry_delay = 1.0

    async def execute_action(
        self, action: AgentAction, context: Dict[str, Any]
    ) -> ToolResult:
        """Execute a single action with retry logic."""
        tool = self.tool_registry.get(action.tool_name)

        if not tool:
            return ToolResult(
                tool_name=action.tool_name,
                success=False,
                error=f"Tool not found: {action.tool_name}",
            )

        # Execute with retries
        last_error = None
        for attempt in range(self.max_retries):
            try:
                start_time = time.time()

                result = tool.execute(action.parameters, context)

                execution_time = time.time() - start_time

                return ToolResult(
                    tool_name=action.tool_name,
                    success=True,
                    result=result,
                    execution_time=execution_time,
                )

            except Exception as e:
                last_error = str(e)
                logger.warning(f"Tool execution failed (attempt {attempt + 1}): {e}")

                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delay * (attempt + 1))

        return ToolResult(
            tool_name=action.tool_name,
            success=False,
            error=last_error,
            execution_time=0.0,
        )

    async def execute_plan(self, plan: AgentPlan, context: Dict[str, Any]) -> AgentPlan:
        """Execute a complete plan."""
        # Execute actions in order
        for action in plan.actions:
            action.status = AgentStatus.ACTING

            result = await self.execute_action(action, context)
            action.result = result

            if not result.success:
                action.status = AgentStatus.ERROR
                plan.status = AgentStatus.ERROR
                break

            action.status = AgentStatus.COMPLETED

        # Check if all completed
        if all(a.status == AgentStatus.COMPLETED for a in plan.actions):
            plan.status = AgentStatus.COMPLETED
            plan.completed_at = time.time()

        return plan


class NexusAgent:
    """
    Main agent class with planning, execution, and memory.
    """

    def __init__(self, agent_id: str, name: str, description: str = ""):
        self.agent_id = agent_id
        self.name = name
        self.description = description

        self.tool_registry = ToolRegistry()
        self.planner = ActionPlanner(self.tool_registry)
        self.executor = ExecutionEngine(self.tool_registry)

        self.state = AgentState(agent_id=agent_id)

        self.llm_enabled = False

    async def think(self, goal: str, context: Dict[str, Any]) -> AgentPlan:
        """Plan how to achieve a goal."""
        self.state.status = AgentStatus.THINKING

        plan = self.planner.create_plan(goal, context)
        self.state.current_plan = plan

        self.state.status = AgentStatus.IDLE

        return plan

    async def act(self, goal: str, context: Dict[str, Any]) -> AgentPlan:
        """Think and act to achieve a goal."""
        # First plan
        plan = await self.think(goal, context)

        # Then execute
        self.state.status = AgentStatus.ACTING
        plan = await self.executor.execute_plan(plan, context)

        # Update state
        self.state.current_plan = plan
        self.state.history.append(
            {
                "goal": goal,
                "plan_id": plan.id,
                "status": plan.status.value,
                "timestamp": time.time(),
            }
        )

        if plan.status == AgentStatus.COMPLETED:
            self.state.status = AgentStatus.COMPLETED
        elif plan.status == AgentStatus.ERROR:
            self.state.status = AgentStatus.ERROR
        else:
            self.state.status = AgentStatus.IDLE

        return plan

    def register_tool(self, tool: Tool):
        """Register a custom tool."""
        self.tool_registry.register(tool)

    def get_state(self) -> AgentState:
        """Get current agent state."""
        return self.state

    def get_history(self, limit: int = 10) -> List[Dict]:
        """Get agent history."""
        return self.state.history[-limit:]

    def clear_memory(self):
        """Clear agent memory."""
        self.state.memory.clear()


class MultiAgentCoordinator:
    """
    Coordinates multiple agents working together.
    """

    def __init__(self):
        self.agents: Dict[str, NexusAgent] = {}

    def register_agent(self, agent: NexusAgent):
        """Register an agent."""
        self.agents[agent.agent_id] = agent

    def get_agent(self, agent_id: str) -> Optional[NexusAgent]:
        """Get an agent by ID."""
        return self.agents.get(agent_id)

    async def broadcast(
        self, message: Dict[str, Any], exclude: Optional[List[str]] = None
    ):
        """Broadcast a message to all agents."""
        exclude = exclude or []

        for agent_id, agent in self.agents.items():
            if agent_id not in exclude:
                agent.state.context.update(message)


__all__ = [
    "NexusAgent",
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
]
