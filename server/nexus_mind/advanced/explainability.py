"""
Nexus Mind Explainability Module

Implements SHAP-like feature attribution, decision explanations,
and interpretability features.

Based on Phase 5 Advanced Features specification.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple, Any
import random
from dataclasses import dataclass
import time


@dataclass
class FeatureImportance:
    """Represents feature importance scores."""
    feature_name: str
    importance: float
    direction: str = "positive"  # positive, negative, neutral


@dataclass
class DecisionExplanation:
    """Explanation for a model decision."""
    decision_id: str
    prediction: Any
    confidence: float
    feature_importances: List[FeatureImportance]
    reasoning: str
    timestamp: float


class SHAPAttributor:
    """
    SHAP-like feature attribution using sampling.
    """
    
    def __init__(self, num_samples: int = 100):
        self.num_samples = num_samples
    
    def compute_shap_values(
        self,
        model: Any,
        input_features: Dict[str, float],
        background_features: Optional[Dict[str, float]] = None
    ) -> Dict[str, float]:
        """Compute SHAP-like values for features."""
        
        # Get baseline prediction (with background features)
        if background_features is None:
            background_features = {k: 0.0 for k in input_features.keys()}
        
        baseline_input = np.array([background_features[k] for k in sorted(input_features.keys())])
        
        # Get baseline prediction
        baseline_pred = self._predict(model, baseline_input)
        
        shap_values = {}
        
        # Compute SHAP values for each feature
        for feature_name in input_features.keys():
            feature_values = []
            
            for _ in range(self.num_samples):
                # Randomly include/exclude this feature
                random_features = {}
                
                for k, v in input_features.items():
                    if k == feature_name:
                        random_features[k] = v
                    elif random.random() > 0.5:
                        random_features[k] = v
                    else:
                        random_features[k] = background_features.get(k, 0.0)
                
                # Get prediction with random features
                random_input = np.array([random_features[k] for k in sorted(input_features.keys())])
                pred = self._predict(model, random_input)
                
                feature_values.append(pred)
            
            # Compute SHAP value
            mean_pred = np.mean(feature_values)
            shap_values[feature_name] = mean_pred - baseline_pred
        
        return shap_values
    
    def _predict(self, model, features: np.ndarray) -> float:
        """Make prediction (placeholder)."""
        # This would use the actual model
        # Simple placeholder prediction
        return float(np.mean(features))


class FeatureAttributor:
    """Provides feature importance using various methods."""
    
    def __init__(self):
        self.method = "permutation"
    
    def compute_importance(
        self,
        model: Any,
        input_features: Dict[str, float],
        target_value: float = 1.0
    ) -> List[FeatureImportance]:
        """Compute feature importance using permutation method."""
        
        # Get baseline prediction
        baseline_features = np.array(list(input_features.values()))
        baseline_pred = self._predict(model, baseline_features)
        
        importances = []
        
        # Permute each feature
        for feature_name, feature_value in input_features.items():
            # Create permuted features
            permuted_features = baseline_features.copy()
            
            # Add noise
            noise = np.random.normal(0, 0.1, len(permuted_features))
            permuted_features += noise
            
            # Get new prediction
            new_pred = self._predict(model, permuted_features)
            
            # Compute importance
            importance = abs(new_pred - baseline_pred)
            
            direction = "positive" if new_pred > baseline_pred else "negative"
            
            importances.append(FeatureImportance(
                feature_name=feature_name,
                importance=importance,
                direction=direction
            ))
        
        # Sort by importance
        importances.sort(key=lambda x: x.importance, reverse=True)
        
        return importances
    
    def _predict(self, model, features: np.ndarray) -> float:
        """Make prediction (placeholder)."""
        return float(np.mean(features))


class DecisionExplainer:
    """Generates human-readable explanations for decisions."""
    
    def __init__(self):
        self.shap_attributor = SHAPAttributor()
        self.feature_attributor = FeatureAttributor()
    
    def explain(
        self,
        model: Any,
        input_features: Dict[str, float],
        prediction: Any,
        confidence: float,
        decision_type: str = "classification"
    ) -> DecisionExplanation:
        """Generate explanation for a decision."""
        
        # Compute feature importances
        importances = self.feature_attributor.compute_importance(
            model, input_features
        )
        
        # Generate reasoning
        reasoning = self._generate_reasoning(
            prediction, confidence, importances
        )
        
        return DecisionExplanation(
            decision_id=str(time.time()),
            prediction=prediction,
            confidence=confidence,
            feature_importances=importances,
            reasoning=reasoning
        )
    
    def _generate_reasoning(
        self,
        prediction: Any,
        confidence: float,
        importances: List[FeatureImportance]
    ) -> str:
        """Generate human-readable reasoning."""
        
        top_features = importances[:3]
        
        if confidence > 0.8:
            confidence_desc = "high confidence"
        elif confidence > 0.5:
            confidence_desc = "moderate confidence"
        else:
            confidence_desc = "low confidence"
        
        feature_descriptions = []
        for f in top_features:
            if f.direction == "positive":
                feature_descriptions.append(f"increased {f.feature_name}")
            else:
                feature_descriptions.append(f"decreased {f.feature_name}")
        
        reasoning = (
            f"The model predicted '{prediction}' with {confidence_desc}. "
            f"This prediction is primarily influenced by: "
        )
        
        if feature_descriptions:
            reasoning += ", ".join(feature_descriptions) + "."
        else:
            reasoning += "no specific features stood out."
        
        return reasoning
    
    def explain_anomaly(
        self,
        anomaly_score: float,
        feature_contributions: Dict[str, float]
    ) -> Dict:
        """Explain why something was flagged as anomalous."""
        
        # Sort contributions
        sorted_contributions = sorted(
            feature_contributions.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )
        
        return {
            "anomaly_score": anomaly_score,
            "is_anomaly": anomaly_score > 0.5,
            "top_contributors": [
                {"feature": k, "contribution": v}
                for k, v in sorted_contributions[:5]
            ],
            "explanation": self._explain_anomaly(anomaly_score, sorted_contributions)
        }
    
    def _explain_anomaly(
        self,
        score: float,
        contributions: List[Tuple[str, float]]
    ) -> str:
        """Generate explanation for anomaly."""
        
        if score < 0.3:
            return "This is likely normal behavior with no significant deviations."
        elif score < 0.6:
            return "Some unusual patterns detected, but not strongly anomalous."
        else:
            top_contribs = contributions[:3]
            factors = ", ".join([f"{k} (deviation: {v:.2f})" for k, v in top_contribs])
            return f"This was flagged as highly anomalous due to: {factors}"


class InterpretableOutput:
    """Generates interpretable outputs for various scenarios."""
    
    @staticmethod
    def explain_intent_prediction(
        predicted_intent: str,
        intent_probs: Dict[str, float],
        behavioral_features: Dict[str, float]
    ) -> Dict:
        """Explain intent prediction."""
        
        # Sort probabilities
        sorted_probs = sorted(
            intent_probs.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        return {
            "predicted_intent": predicted_intent,
            "confidence": intent_probs.get(predicted_intent, 0.0),
            "top_intents": [
                {"intent": k, "probability": v}
                for k, v in sorted_probs[:3]
            ],
            "key_signals": [
                {"feature": k, "value": v}
                for k, v in list(behavioral_features.items())[:5]
            ],
            "explanation": f"Intent '{predicted_intent}' was predicted based on behavioral patterns."
        }
    
    @staticmethod
    def explain_spatial_analysis(
        detected_objects: List[Dict],
        scene_context: str,
        confidence: float
    ) -> Dict:
        """Explain spatial analysis results."""
        
        return {
            "scene_type": scene_context,
            "confidence": confidence,
            "detected_objects": detected_objects,
            "explanation": f"Analysis identified {len(detected_objects)} objects in a {scene_context} setting."
        }


class ExplainabilityEngine:
    """
    Main explainability engine coordinating all explanation methods.
    """
    
    def __init__(self):
        self.explainer = DecisionExplainer()
        self.interpretable = InterpretableOutput()
    
    def explain_decision(
        self Any,
        features,
        model:: Dict[str, float],
        prediction: Any,
        confidence: float
    ) -> DecisionExplanation:
        """Explain a general decision."""
        return self.explainer.explain(model, features, prediction, confidence)
    
    def explain_intent(
        self,
        predicted_intent: str,
        intent_probs: Dict[str, float],
        behavioral_features: Dict[str, float]
    ) -> Dict:
        """Explain intent prediction."""
        return self.interpretable.explain_intent_prediction(
            predicted_intent, intent_probs, behavioral_features
        )
    
    def explain_anomaly(
        self,
        anomaly_score: float,
        feature_contributions: Dict[str, float]
    ) -> Dict:
        """Explain anomaly detection."""
        return self.explainer.explain_anomaly(anomaly_score, feature_contributions)
    
    def explain_spatial(
        self,
        detected_objects: List[Dict],
        scene_context: str,
        confidence: float
    ) -> Dict:
        """Explain spatial analysis."""
        return self.interpretable.explain_spatial_analysis(
            detected_objects, scene_context, confidence
        )


__all__ = [
    "ExplainabilityEngine",
    "DecisionExplainer",
    "SHAPAttributor",
    "FeatureAttributor",
    "InterpretableOutput",
    "FeatureImportance",
    "DecisionExplanation"
]
