"""
Nexus Mind Core AI - Main Entry Point

This module provides a simple interface to build and run the full Nexus Mind pipeline.
"""

import torch
import argparse
import logging
from typing import Optional

from nexus_mind.core.nade import NADEEngine
from nexus_mind.core.gie import GIEEngine
from nexus_mind.core.bne import BNEEngine
from nexus_mind.core.fusion import KimiDeltaAttention
from nexus_mind.cognitive.manager import CognitiveLoopManager
from nexus_mind.production.edge_optimizer import EdgeOptimizer
from nexus_mind.production.monitoring import NexusMonitor
from nexus_mind.utils.helpers import format_results

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def build_full_nexus(device: str = "cpu") -> CognitiveLoopManager:
    """
    Build the full Nexus Mind pipeline.

    Args:
        device: Device to run on ('cpu' or 'cuda')

    Returns:
        CognitiveLoopManager instance
    """
    logger.info("Building Nexus Mind pipeline...")

    # Create engines
    nade = NADEEngine().to(device)
    gie = GIEEngine().to(device)
    bne = BNEEngine().to(device)
    fusion = KimiDeltaAttention().to(device)

    # Create manager
    manager = CognitiveLoopManager(nade, gie, bne, fusion, device=device)

    logger.info("Nexus Mind pipeline ready")

    return manager


def optimize_for_edge(manager: CognitiveLoopManager) -> CognitiveLoopManager:
    """
    Optimize Nexus Mind for edge deployment.

    Args:
        manager: CognitiveLoopManager instance

    Returns:
        Optimized manager
    """
    logger.info("Optimizing for edge deployment...")

    optimizer = EdgeOptimizer(
        {"quantization": "dynamic", "prune_amount": 0.3, "optimize_for": "latency"}
    )

    # Optimize each engine
    manager.nade = optimizer.optimize(manager.nade)
    manager.gie = optimizer.optimize(manager.gie)
    manager.bne = optimizer.optimize(manager.bne)
    manager.fusion = optimizer.optimize(manager.fusion)

    logger.info("Edge optimization complete")

    return manager


def run_inference(
    manager: CognitiveLoopManager,
    sensor_data: Optional[torch.Tensor] = None,
    geo_data: Optional[torch.Tensor] = None,
    behavior_data: Optional[torch.Tensor] = None,
) -> dict:
    """
    Run inference through Nexus Mind.

    Args:
        manager: CognitiveLoopManager instance
        sensor_data: Sensor data tensor
        geo_data: Geospatial data tensor
        behavior_data: Behavioral data tensor

    Returns:
        Inference results
    """
    if sensor_data is None:
        # Generate sample data
        sensor_data = torch.randn(4, 10, 64)

    result = manager.step(sensor_data, geo_data, behavior_data)

    return result


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Nexus Mind Core AI")
    parser.add_argument("--device", type=str, default="cpu", help="Device to run on")
    parser.add_argument(
        "--optimize-edge", action="store_true", help="Optimize for edge"
    )
    parser.add_argument("--batch-size", type=int, default=4, help="Batch size")

    args = parser.parse_args()

    # Build pipeline
    manager = build_full_nexus(args.device)

    # Optionally optimize
    if args.optimize_edge:
        manager = optimize_for_edge(manager)

    # Run inference
    logger.info(f"Running inference with batch size {args.batch_size}...")

    sensor = torch.randn(args.batch_size, 10, 64)
    geo = torch.randn(args.batch_size, 3, 224, 224)
    behavior = torch.randn(args.batch_size, 100, 64)

    result = run_inference(manager, sensor, geo, behavior)

    # Print results
    print("\n" + format_results(result) + "\n")

    # Get stats
    stats = manager.get_state()
    print(f"Cognitive State:")
    print(f"  Alert Level: {stats['alert_level']:.4f}")
    print(f"  History Length: {stats['history_length']}")


if __name__ == "__main__":
    main()
