"""
Helper utilities for Nexus Mind.
"""

import torch
import numpy as np
from typing import Any, Dict, List
import json


def tensor_to_list(tensor: torch.Tensor) -> List[float]:
    """Convert tensor to list."""
    return tensor.cpu().numpy().tolist()


def list_to_tensor(data: List[float], device: str = "cpu") -> torch.Tensor:
    """Convert list to tensor."""
    return torch.tensor(data, dtype=torch.float32, device=device)


def dict_to_tensor(
    data: Dict[str, Any], device: str = "cpu"
) -> Dict[str, torch.Tensor]:
    """Convert dict values to tensors."""
    result = {}
    for key, value in data.items():
        if isinstance(value, (list, np.ndarray)):
            result[key] = torch.tensor(value, dtype=torch.float32, device=device)
        elif isinstance(value, torch.Tensor):
            result[key] = value.to(device)
        else:
            result[key] = value
    return result


def serialize_tensor(tensor: torch.Tensor) -> bytes:
    """Serialize tensor to bytes."""
    return tensor.cpu().numpy().tobytes()


def deserialize_tensor(
    data: bytes, shape: tuple, dtype: torch.dtype = torch.float32
) -> torch.Tensor:
    """Deserialize bytes to tensor."""
    return torch.from_numpy(np.frombuffer(data, dtype=dtype)).reshape(shape)


def save_checkpoint(
    model: torch.nn.Module,
    optimizer: torch.optim.Optimizer,
    epoch: int,
    path: str,
    metadata: Dict = None,
):
    """Save model checkpoint."""
    checkpoint = {
        "epoch": epoch,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
    }
    if metadata:
        checkpoint["metadata"] = metadata

    torch.save(checkpoint, path)


def load_checkpoint(
    model: torch.nn.Module, optimizer: torch.optim.Optimizer, path: str
) -> Dict:
    """Load model checkpoint."""
    checkpoint = torch.load(path)
    model.load_state_dict(checkpoint["model_state_dict"])
    optimizer.load_state_dict(checkpoint["optimizer_state_dict"])
    return checkpoint


def format_results(result: Dict) -> str:
    """Format inference results as string."""
    lines = []
    lines.append("=== Nexus Mind Inference Results ===")

    if "confidence" in result:
        lines.append(f"Confidence: {result['confidence']:.4f}")

    if "nade_anomaly" in result:
        lines.append(f"Anomaly Score: {result['nade_anomaly']:.4f}")

    if "nade_is_anomaly" in result:
        lines.append(f"Is Anomaly: {result['nade_is_anomaly']}")

    if "bne_intent" in result and result["bne_intent"] is not None:
        intent_names = [
            "search",
            "purchase",
            "browse",
            "inquire",
            "compare",
            "review",
            "share",
            "complain",
        ]
        intent_id = int(result["bne_intent"])
        intent_name = (
            intent_names[intent_id] if 0 <= intent_id < len(intent_names) else "unknown"
        )
        lines.append(f"Intent: {intent_name} ({intent_id})")

    if "alert_level" in result:
        lines.append(f"Alert Level: {result['alert_level']:.4f}")

    return "\n".join(lines)
