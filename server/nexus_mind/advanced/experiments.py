"""
Nexus Mind A/B Testing & Experiments Module

Implements experiment management, variant assignment,
and statistical analysis for A/B testing.

Based on Phase 5 Advanced Features specification.
"""

import uuid
import hashlib
import random
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import math


class ExperimentStatus(Enum):
    """Status of an experiment."""

    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"


@dataclass
class Variant:
    """Represents a variant in an experiment."""

    variant_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    weight: float = 1.0  # Traffic weight
    config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Experiment:
    """Represents an A/B test experiment."""

    experiment_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    status: ExperimentStatus = ExperimentStatus.DRAFT
    variants: List[Variant] = field(default_factory=list)
    metrics: Dict[str, Any] = field(default_factory=dict)
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    created_at: float = field(default_factory=lambda: time.time())


@dataclass
class Assignment:
    """Represents a user assignment to a variant."""

    assignment_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    experiment_id: str = ""
    user_id: str = ""
    variant_id: str = ""
    timestamp: float = field(default_factory=lambda: time.time())


@dataclass
class Metric:
    """Represents a metric in an experiment."""

    metric_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    metric_type: str = "counter"  # counter, gauge, histogram
    values: List[float] = field(default_factory=list)


class VariantAssigner:
    """Assigns users to variants using deterministic hashing."""

    def __init__(self, hash_key: str = "default"):
        self.hash_key = hash_key

    def assign(self, user_id: str, experiment: Experiment) -> Optional[Variant]:
        """Assign a user to a variant deterministically."""
        if not experiment.variants:
            return None

        # Create deterministic hash from user_id and experiment_id
        hash_input = f"{self.hash_key}:{experiment.experiment_id}:{user_id}"
        hash_value = int(hashlib.md5(hash_input.encode()).hexdigest(), 16)

        # Normalize to [0, 1]
        normalized = (hash_value % 10000) / 10000.0

        # Calculate cumulative weights
        total_weight = sum(v.weight for v in experiment.variants)

        # Find variant
        cumulative = 0.0
        for variant in experiment.variants:
            cumulative += variant.weight / total_weight
            if normalized <= cumulative:
                return variant

        # Fallback to last variant
        return experiment.variants[-1]


class ExperimentRunner:
    """Manages and runs A/B experiments."""

    def __init__(self):
        self.experiments: Dict[str, Experiment] = {}
        self.assignments: List[Assignment] = []
        self.user_assignments: Dict[
            str, Dict[str, str]
        ] = {}  # user_id -> {exp_id: variant_id}
        self.assigner = VariantAssigner()

        self.metrics: Dict[str, Metric] = {}

    def create_experiment(
        self, name: str, description: str = "", variants: Optional[List[Dict]] = None
    ) -> str:
        """Create a new experiment."""
        experiment = Experiment(name=name, description=description)

        # Add default variants if not provided
        if not variants:
            variants = [
                {"name": "control", "weight": 1.0},
                {"name": "treatment", "weight": 1.0},
            ]

        for v in variants:
            experiment.variants.append(
                Variant(
                    name=v.get("name", ""),
                    description=v.get("description", ""),
                    weight=v.get("weight", 1.0),
                    config=v.get("config", {}),
                )
            )

        self.experiments[experiment.experiment_id] = experiment

        return experiment.experiment_id

    def start_experiment(self, experiment_id: str) -> bool:
        """Start an experiment."""
        if experiment_id not in self.experiments:
            return False

        experiment = self.experiments[experiment_id]
        experiment.status = ExperimentStatus.RUNNING
        experiment.start_time = time.time()

        return True

    def pause_experiment(self, experiment_id: str) -> bool:
        """Pause an experiment."""
        if experiment_id not in self.experiments:
            return False

        self.experiments[experiment_id].status = ExperimentStatus.PAUSED
        return True

    def assign_user(self, experiment_id: str, user_id: str) -> Optional[str]:
        """Assign a user to a variant in an experiment."""
        if experiment_id not in self.experiments:
            return None

        experiment = self.experiments[experiment_id]

        if experiment.status != ExperimentStatus.RUNNING:
            return None

        # Check if user already assigned
        if user_id in self.user_assignments:
            if experiment_id in self.user_assignments[user_id]:
                return self.user_assignments[user_id][experiment_id]

        # Assign user
        variant = self.assigner.assign(user_id, experiment)

        if variant:
            # Record assignment
            assignment = Assignment(
                experiment_id=experiment_id,
                user_id=user_id,
                variant_id=variant.variant_id,
            )
            self.assignments.append(assignment)

            # Update user assignments
            if user_id not in self.user_assignments:
                self.user_assignments[user_id] = {}
            self.user_assignments[user_id][experiment_id] = variant.variant_id

            return variant.variant_id

        return None

    def record_metric(
        self, user_id: str, experiment_id: str, metric_name: str, value: float
    ):
        """Record a metric value for a user in an experiment."""
        # Get variant for user
        variant_id = self.user_assignments.get(user_id, {}).get(experiment_id)

        if not variant_id:
            return

        # Store metric
        metric_key = f"{experiment_id}:{variant_id}:{metric_name}"

        if metric_key not in self.metrics:
            self.metrics[metric_key] = Metric(name=metric_name)

        self.metrics[metric_key].values.append(value)

    def get_variant_for_user(self, experiment_id: str, user_id: str) -> Optional[str]:
        """Get the variant assigned to a user."""
        return self.user_assignments.get(user_id, {}).get(experiment_id)

    def get_results(self, experiment_id: str) -> Dict:
        """Get experiment results with statistics."""
        if experiment_id not in self.experiments:
            return {}

        experiment = self.experiments[experiment_id]

        results = {
            "experiment_id": experiment_id,
            "name": experiment.name,
            "status": experiment.status.value,
            "variants": [],
        }

        # Calculate statistics for each variant
        for variant in experiment.variants:
            variant_key = f"{experiment_id}:{variant.variant_id}"

            # Get metrics for this variant
            metric_stats = {}

            for metric_key, metric in self.metrics.items():
                if metric_key.startswith(variant_key):
                    metric_name = metric_key.split(":")[-1]
                    values = metric.values

                    if values:
                        metric_stats[metric_name] = {
                            "count": len(values),
                            "sum": sum(values),
                            "mean": sum(values) / len(values),
                            "min": min(values),
                            "max": max(values),
                            "values": values,
                        }

            # Count users
            user_count = sum(
                1
                for a in self.assignments
                if a.experiment_id == experiment_id
                and a.variant_id == variant.variant_id
            )

            results["variants"].append(
                {
                    "variant_id": variant.variant_id,
                    "name": variant.name,
                    "users": user_count,
                    "metrics": metric_stats,
                }
            )

        return results

    def calculate_significance(self, experiment_id: str, metric_name: str) -> Dict:
        """Calculate statistical significance between variants."""
        results = self.get_results(experiment_id)

        if not results.get("variants"):
            return {}

        # Get control and treatment
        control = None
        treatment = None

        for v in results["variants"]:
            if v["name"] == "control":
                control = v
            elif v["name"] == "treatment":
                treatment = v

        if not control or not treatment:
            return {}

        # Get metric values
        control_values = (
            control.get("metrics", {}).get(metric_name, {}).get("values", [])
        )
        treatment_values = (
            treatment.get("metrics", {}).get(metric_name, {}).get("values", [])
        )

        if not control_values or not treatment_values:
            return {}

        # Calculate means
        control_mean = sum(control_values) / len(control_values)
        treatment_mean = sum(treatment_values) / len(treatment_values)

        # Calculate standard errors
        control_se = self._standard_error(control_values)
        treatment_se = self._standard_error(treatment_values)

        # Calculate z-score
        se_diff = math.sqrt(control_se**2 + treatment_se**2)

        if se_diff == 0:
            return {}

        z_score = (treatment_mean - control_mean) / se_diff

        # Calculate p-value (approximate)
        p_value = self._p_value_from_z(z_score)

        # Calculate relative improvement
        if control_mean != 0:
            relative_improvement = (
                (treatment_mean - control_mean) / control_mean
            ) * 100
        else:
            relative_improvement = 0

        return {
            "control_mean": control_mean,
            "treatment_mean": treatment_mean,
            "relative_improvement": relative_improvement,
            "z_score": z_score,
            "p_value": p_value,
            "significant": p_value < 0.05,
        }

    def _standard_error(self, values: List[float]) -> float:
        """Calculate standard error."""
        if len(values) < 2:
            return 0.0

        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)

        return math.sqrt(variance / len(values))

    def _p_value_from_z(self, z: float) -> float:
        """Calculate approximate p-value from z-score."""
        # Approximation using normal distribution
        return 2 * (1 - self._normal_cdf(abs(z)))

    def _normal_cdf(self, x: float) -> float:
        """Approximate normal CDF."""
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    def determine_winner(self, experiment_id: str, metric_name: str) -> Optional[Dict]:
        """Determine the winning variant."""
        significance = self.calculate_significance(experiment_id, metric_name)

        if not significance:
            return None

        if significance.get("significant"):
            return {
                "winner": "treatment"
                if significance["relative_improvement"] > 0
                else "control",
                "confidence": (1 - significance["p_value"]) * 100,
                "improvement": significance["relative_improvement"],
            }

        return None


__all__ = [
    "ExperimentRunner",
    "Experiment",
    "Variant",
    "Assignment",
    "Metric",
    "ExperimentStatus",
]
