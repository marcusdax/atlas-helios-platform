"""
Atlas Helios Platform Integration for Nexus Mind AI

Bridges the Atlas Helios Platform backend with Nexus Mind cognitive pipeline.
"""

import asyncio
import logging
import json
from typing import Dict, Any, Optional
from dataclasses import dataclass
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

logger = logging.getLogger(__name__)


@dataclass
class HeliosEvent:
    """Event from Atlas Helios Platform."""

    event_type: str
    data: Dict[str, Any]
    source: str = "helios"
    timestamp: float = None

    def __post_init__(self):
        if self.timestamp is None:
            import time

            self.timestamp = time.time()


class AtlasHeliosBridge:
    """
    Bridge between Atlas Helios Platform and Nexus Mind AI.
    Integrates storm intelligence, property analysis, and computer vision.
    """

    def __init__(self, nexus_manager=None):
        self.nexus = nexus_manager
        self.event_handlers = {}
        self.storm_cache = {}
        self.property_cache = {}

    def register_handler(self, event_type: str, handler):
        """Register event handler."""
        self.event_handlers[event_type] = handler

    async def process_storm_event(self, storm_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process storm event through Nexus Mind cognitive pipeline.

        Args:
            storm_data: Storm event data from Atlas Helios

        Returns:
            Enhanced storm analysis with cognitive insights
        """
        event = HeliosEvent(
            event_type="storm_analysis", data=storm_data, source="helios"
        )

        if self.nexus:
            sensor_data = self._storm_to_sensor(storm_data)
            cognitive_result = self.nexus.step(sensor_data)

            return {
                "storm_data": storm_data,
                "cognitive_analysis": cognitive_result,
                "enhanced_risk_score": self._calculate_enhanced_risk(
                    storm_data, cognitive_result
                ),
                "recommendations": self._generate_cognitive_recommendations(
                    storm_data, cognitive_result
                ),
            }

        return {"storm_data": storm_data, "cognitive_analysis": None}

    def _storm_to_sensor(self, storm_data: Dict[str, Any]) -> list:
        """Convert storm data to sensor format for Nexus Mind."""
        return [
            storm_data.get("severity", 0) / 100,
            storm_data.get("affectedProperties", 0) / 1000,
            self._severity_to_value(storm_data.get("type", "")),
            self._alert_to_value(storm_data.get("alertLevel", "")),
        ]

    def _severity_to_value(self, storm_type: str) -> float:
        """Convert storm type to numeric value."""
        mapping = {
            "hail": 0.8,
            "tornado": 1.0,
            "severe_thunderstorm": 0.7,
            "high_winds": 0.6,
        }
        return mapping.get(storm_type.lower(), 0.5)

    def _alert_to_value(self, alert_level: str) -> float:
        """Convert alert level to numeric value."""
        mapping = {"emergency": 1.0, "warning": 0.7, "watch": 0.5, "info": 0.3}
        return mapping.get(alert_level.lower(), 0.3)

    def _calculate_enhanced_risk(
        self, storm_data: Dict[str, Any], cognitive_result: Any
    ) -> float:
        """Calculate risk score combining storm data and cognitive analysis."""
        base_risk = storm_data.get("severity", 0) or 50

        if cognitive_result:
            try:
                cognitive_risk = cognitive_result.get("anomaly_score", 0.5) * 100
                return (base_risk * 0.7) + (cognitive_risk * 0.3)
            except:
                pass

        return base_risk

    def _generate_cognitive_recommendations(
        self, storm_data: Dict[str, Any], cognitive_result: Any
    ) -> list:
        """Generate recommendations based on combined analysis."""
        recommendations = []

        severity = storm_data.get("severity", "")
        if severity in ["severe", "extreme"]:
            recommendations.append(
                {
                    "type": "immediate_action",
                    "priority": "critical",
                    "message": f"Deploy assessment teams for {storm_data.get('regionName', 'affected area')}",
                }
            )

        if cognitive_result:
            try:
                intent = cognitive_result.get("intent", "")
                if intent:
                    recommendations.append(
                        {
                            "type": "cognitive",
                            "priority": "high",
                            "message": f"AI insight: {intent}",
                        }
                    )
            except:
                pass

        return recommendations


class HeliosPropertyAnalyzer:
    """
    Integrates Property Insight with Atlas Helios Platform.
    Combines CV damage detection with cognitive analysis.
    """

    DAMAGE_TYPES = [
        "roof_damage",
        "water_damage",
        "wind_damage",
        "structural",
        "hail_damage",
        "foundation",
    ]

    def __init__(self, perception_encoder=None, nexus_bridge=None):
        self.perception = perception_encoder
        self.nexus = nexus_bridge

    async def analyze_property_helios(
        self, property_data: Dict[str, Any], cv_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Full property analysis combining Helios CV with Nexus Mind.

        Args:
            property_data: Property information
            cv_analysis: Computer vision analysis from Helios

        Returns:
            Combined analysis results
        """
        result = {
            "property": property_data,
            "cv_analysis": cv_analysis,
            "damage_score": cv_analysis.get("severityAssessment", {}).get("score", 0),
            "confidence": cv_analysis.get("confidence", 0),
            "recommendations": cv_analysis.get("recommendations", {}),
        }

        if self.nexus:
            sensor_data = self._cv_to_sensor(cv_analysis)
            cognitive = self.nexus.step(sensor_data)
            result["cognitive_insights"] = cognitive
            result["enhanced_confidence"] = self._calculate_enhanced_confidence(
                cv_analysis, cognitive
            )

        return result

    def _cv_to_sensor(self, cv_analysis: Dict[str, Any]) -> list:
        """Convert CV analysis to sensor format."""
        severity = cv_analysis.get("severityAssessment", {}).get("score", 50) / 100
        confidence = cv_analysis.get("confidence", 0.5)

        damage_detected = len(cv_analysis.get("damageDetection", {}).get("areas", []))

        return [severity, confidence, min(damage_detected / 10, 1), 0.5]

    def _calculate_enhanced_confidence(
        self, cv_analysis: Dict[str, Any], cognitive_result: Any
    ) -> float:
        """Calculate enhanced confidence combining CV and cognitive analysis."""
        cv_confidence = cv_analysis.get("confidence", 0.5)

        if cognitive_result:
            try:
                anomaly = cognitive_result.get("anomaly_score", 0.5)
                cognitive_confidence = min(abs(anomaly - 0.5) * 2 + 0.5, 1.0)
                return (cv_confidence * 0.7) + (cognitive_confidence * 0.3)
            except:
                pass

        return cv_confidence


def create_helios_nexus_integration(nexus_manager=None) -> Dict[str, Any]:
    """
    Create Atlas Helios + Nexus Mind integration.

    Args:
        nexus_manager: Nexus Mind CognitiveLoopManager

    Returns:
        Integration bridge and analyzer
    """
    bridge = AtlasHeliosBridge(nexus_manager)
    analyzer = HeliosPropertyAnalyzer(nexus_bridge=bridge)

    async def handle_storm_event(event_data: Dict[str, Any]) -> Dict[str, Any]:
        return await bridge.process_storm_event(event_data)

    async def handle_property_analysis(
        property_data: Dict[str, Any], cv_analysis: Dict[str, Any]
    ) -> Dict[str, Any]:
        return await analyzer.analyze_property_helios(property_data, cv_analysis)

    return {
        "bridge": bridge,
        "analyzer": analyzer,
        "handle_storm_event": handle_storm_event,
        "handle_property_analysis": handle_property_analysis,
    }


if __name__ == "__main__":
    print("Atlas Helios Platform - Nexus Mind Integration")
    print("=" * 50)
    print("Ready to integrate with:")
    print("  - Storm Intelligence Service")
    print("  - Computer Vision Service")
    print("  - Property Assessment Pipeline")
