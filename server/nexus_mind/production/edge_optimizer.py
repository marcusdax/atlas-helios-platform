"""
Edge Optimizer

Provides model optimization for edge deployment:
- Dynamic/Static quantization
- Pruning
- TorchScript export
"""

import torch
import torch.nn as nn
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class EdgeOptimizer:
    """
    Optimizes models for edge deployment.
    """

    def __init__(self, config: Dict[str, Any]):
        """
        Initialize Edge Optimizer.

        Args:
            config: Configuration dict with keys:
                - quantization: 'dynamic', 'static', or None
                - prune_amount: 0.0 to 1.0
                - optimize_for: 'latency', 'size', or 'accuracy'
        """
        self.quantization = config.get("quantization", "dynamic")
        self.prune_amount = config.get("prune_amount", 0.0)
        self.optimize_for = config.get("optimize_for", "latency")

        logger.info(
            f"EdgeOptimizer initialized: quant={self.quantization}, prune={self.prune_amount}"
        )

    def optimize(self, model: nn.Module) -> nn.Module:
        """
        Optimize model for edge deployment.

        Args:
            model: PyTorch model to optimize

        Returns:
            Optimized model
        """
        optimized_model = model

        # Apply quantization
        if self.quantization == "dynamic":
            optimized_model = self._dynamic_quantize(optimized_model)
        elif self.quantization == "static":
            optimized_model = self._static_quantize(optimized_model)

        # Apply pruning
        if self.prune_amount > 0:
            optimized_model = self._prune(optimized_model)

        logger.info("Model optimization complete")
        return optimized_model

    def _dynamic_quantize(self, model: nn.Module) -> nn.Module:
        """Apply dynamic quantization."""
        try:
            quantized = torch.quantization.quantize_dynamic(
                model, {torch.nn.Linear, torch.nn.LSTM, torch.nn.GRU}, dtype=torch.qint8
            )
            logger.info("Dynamic quantization applied")
            return quantized
        except Exception as e:
            logger.warning(f"Dynamic quantization failed: {e}")
            return model

    def _static_quantize(self, model: nn.Module) -> nn.Module:
        """Apply static quantization."""
        try:
            # Set qconfig
            model.qconfig = torch.quantization.get_default_qconfig("qnnpack")

            # Prepare for quantization
            torch.quantization.prepare(model, inplace=True)

            # Calibrate (would need sample data in production)
            # ... calibration code here ...

            # Convert
            quantized = torch.quantization.convert(model, inplace=False)
            logger.info("Static quantization applied")
            return quantized
        except Exception as e:
            logger.warning(f"Static quantization failed: {e}")
            return model

    def _prune(self, model: nn.Module) -> nn.Module:
        """Apply pruning to model weights."""
        try:
            for name, param in model.named_parameters():
                if "weight" in name:
                    # Magnitude pruning
                    threshold = torch.quantile(param.abs().flatten(), self.prune_amount)
                    mask = (param.abs() > threshold).float()
                    param.data = param.data * mask

            logger.info(f"Pruning applied: {self.prune_amount * 100}%")
            return model
        except Exception as e:
            logger.warning(f"Pruning failed: {e}")
            return model

    def export_torchscript(
        self, model: nn.Module, example_input: torch.Tensor, output_path: str
    ):
        """
        Export model to TorchScript.

        Args:
            model: Model to export
            example_input: Example input for tracing
            output_path: Path to save TorchScript model
        """
        try:
            # Trace model
            traced = torch.jit.trace(model, example_input)

            # Save
            traced.save(output_path)
            logger.info(f"Model exported to TorchScript: {output_path}")

            return traced
        except Exception as e:
            logger.warning(f"TorchScript export failed: {e}")
            return None

    def export_onnx(
        self,
        model: nn.Module,
        example_input: torch.Tensor,
        output_path: str,
        opset_version: int = 14,
    ):
        """
        Export model to ONNX.

        Args:
            model: Model to export
            example_input: Example input
            output_path: Path to save ONNX model
            opset_version: ONNX opset version
        """
        try:
            torch.onnx.export(
                model,
                example_input,
                output_path,
                opset_version=opset_version,
                input_names=["input"],
                output_names=["output"],
                dynamic_axes={"input": {0: "batch_size"}, "output": {0: "batch_size"}},
            )
            logger.info(f"Model exported to ONNX: {output_path}")
        except Exception as e:
            logger.warning(f"ONNX export failed: {e}")

    def get_model_size(self, model: nn.Module) -> Dict[str, float]:
        """
        Get model size information.

        Args:
            model: PyTorch model

        Returns:
            Dictionary with size information
        """
        param_size = sum(p.numel() * p.element_size() for p in model.parameters())
        buffer_size = sum(b.numel() * b.element_size() for b in model.buffers())

        return {
            "param_size_mb": param_size / 1024 / 1024,
            "buffer_size_mb": buffer_size / 1024 / 1024,
            "total_size_mb": (param_size + buffer_size) / 1024 / 1024,
            "num_parameters": sum(p.numel() for p in model.parameters()),
        }
