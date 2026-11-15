"""
Perception Encoder Integration for Nexus Mind AI

Uses Facebook's Perception Encoder for enhanced image/video understanding.
"""

import torch
from typing import Optional, Union, List
from PIL import Image
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "perception_models"))
sys.path.insert(0, os.path.dirname(__file__))

try:
    from core.vision_encoder import pe as perception_encoder
    from core.vision_encoder import transforms as pe_transforms

    PERCEPTION_AVAILABLE = True
except ImportError:
    PERCEPTION_AVAILABLE = False
    perception_encoder = None
    pe_transforms = None


class PerceptionEncoderWrapper:
    """
    Wraps Facebook's Perception Encoder for use with Nexus Mind.
    Provides image and video feature extraction.
    """

    AVAILABLE_CONFIGS = [
        "PE-Core-G14-448",
        "PE-Core-L14-336",
        "PE-Core-B16-224",
        "PE-Core-S16-384",
        "PE-Core-T16-384",
    ]

    def __init__(
        self,
        config: str = "PE-Core-B16-224",
        pretrained: bool = True,
        device: str = "cpu",
    ):
        """
        Initialize Perception Encoder.

        Args:
            config: Model configuration
            pretrained: Use pretrained weights
            device: Device to run on
        """
        if not PERCEPTION_AVAILABLE:
            raise ImportError(
                "Perception Encoder not available. Install from G:\\perception_models"
            )

        self.config = config
        self.device = device

        print(f"Loading Perception Encoder: {config}")
        self.model = perception_encoder.CLIP.from_config(config, pretrained=pretrained)
        self.model = self.model.to(device)
        self.model.eval()

        self.preprocess = pe_transforms.get_image_transform(self.model.image_size)
        self.tokenizer = pe_transforms.get_text_tokenizer(self.model.context_length)

        print(f"Perception Encoder ready on {device}")

    def encode_image(self, image: Union[Image.Image, str]) -> torch.Tensor:
        """
        Encode an image to feature vector.

        Args:
            image: PIL Image or path to image

        Returns:
            Image features tensor
        """
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")

        img_tensor = self.preprocess(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            image_features, _, _ = self.model(img_tensor, None)

        return image_features

    def encode_text(self, texts: Union[str, List[str]]) -> torch.Tensor:
        """
        Encode text to feature vectors.

        Args:
            texts: Single text or list of texts

        Returns:
            Text features tensor
        """
        if isinstance(texts, str):
            texts = [texts]

        text_tokens = self.tokenizer(texts).to(self.device)

        with torch.no_grad():
            _, text_features, _ = self.model(None, text_tokens)

        return text_features

    def encode_image_text(
        self, image: Union[Image.Image, str], texts: Union[str, List[str]]
    ) -> tuple:
        """
        Encode both image and text with learned alignment.

        Args:
            image: PIL Image or path
            texts: Text descriptions

        Returns:
            Tuple of (image_features, text_features, logit_scale)
        """
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")

        if isinstance(texts, str):
            texts = [texts]

        img_tensor = self.preprocess(image).unsqueeze(0).to(self.device)
        text_tokens = self.tokenizer(texts).to(self.device)

        with (
            torch.no_grad(),
            torch.autocast(self.device, enabled=self.device == "cuda"),
        ):
            image_features, text_features, logit_scale = self.model(
                img_tensor, text_tokens
            )

        return image_features, text_features, logit_scale

    def compute_similarity(
        self, image: Union[Image.Image, str], texts: Union[str, List[str]]
    ) -> torch.Tensor:
        """
        Compute image-text similarity scores.

        Args:
            image: PIL Image or path
            texts: Text descriptions

        Returns:
            Similarity scores
        """
        image_features, text_features, logit_scale = self.encode_image_text(
            image, texts
        )
        similarities = logit_scale * image_features @ text_features.T
        return similarities.softmax(dim=-1)


class NexusMindPerceptionBridge:
    """
    Bridge between Perception Encoder and Nexus Mind cognitive architecture.
    Uses PE features as enhanced sensor input.
    """

    def __init__(self, pe_wrapper: PerceptionEncoderWrapper, nexus_manager):
        """
        Initialize bridge.

        Args:
            pe_wrapper: PerceptionEncoderWrapper instance
            nexus_manager: Nexus Mind CognitiveLoopManager
        """
        self.pe = pe_wrapper
        self.nexus = nexus_manager

    def process_image_with_cognition(
        self, image: Union[Image.Image, str], context: Optional[str] = None
    ) -> dict:
        """
        Process image through both PE and Nexus Mind.

        Args:
            image: PIL Image or path
            context: Optional context text

        Returns:
            Combined results
        """
        image_features = self.pe.encode_image(image)

        descriptions = ["property image", "damage assessment", "aerial view"]
        if context:
            descriptions.insert(0, context)

        similarities = self.pe.compute_similarity(image, descriptions)

        sensor_data = image_features.squeeze(0)
        if sensor_data.dim() == 1:
            sensor_data = sensor_data.unsqueeze(0).unsqueeze(0)
        elif sensor_data.dim() == 2:
            sensor_data = sensor_data.unsqueeze(0)

        nexus_result = self.nexus.step(sensor_data)

        return {
            "perception_features": image_features.cpu(),
            "description_scores": similarities.cpu(),
            "cognitive_result": nexus_result,
            "image_classification": descriptions[similarities.argmax().item()],
        }


def create_perception_enhanced_nexus(device: str = "cpu") -> tuple:
    """
    Create Nexus Mind with Perception Encoder integration.

    Args:
        device: Device to run on

    Returns:
        Tuple of (NexusMindPerceptionBridge, pe_wrapper)
    """
    from nexus_mind.main import build_full_nexus

    nexus_manager = build_full_nexus(device)
    pe_wrapper = PerceptionEncoderWrapper(device=device)
    bridge = NexusMindPerceptionBridge(pe_wrapper, nexus_manager)

    return bridge, pe_wrapper
