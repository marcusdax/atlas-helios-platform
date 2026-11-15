"""
Shared Perception Encoder Module

Facebook's Perception Encoder integrated for multiple AI systems.
Install: Clone https://github.com/facebookresearch/perception_models to G:\\perception_models
"""

import torch
from typing import Optional, Union, List, Dict, Tuple
from PIL import Image
import sys
import os

PERCEPTION_PATH = r"G:\perception_models"


class PerceptionEncoder:
    """
    Unified interface for Facebook's Perception Encoder.
    Supports image, video, and audio-visual understanding.
    """

    VISION_CONFIGS = [
        "PE-Core-G14-448",
        "PE-Core-L14-336",
        "PE-Core-B16-224",
        "PE-Core-S16-384",
        "PE-Core-T16-384",
    ]

    SPATIAL_CONFIGS = [
        "PE-Spatial-G14-448",
        "PE-Spatial-L14-448",
        "PE-Spatial-B16-512",
        "PE-Spatial-S16-512",
        "PE-Spatial-T16-512",
    ]

    AUDIO_VISUAL_CONFIGS = [
        "pe-av-small",
        "pe-av-base",
        "pe-av-large",
    ]

    def __init__(
        self,
        config: str = "PE-Core-B16-224",
        device: str = "cpu",
        pretrained: bool = True,
    ):
        self.config = config
        self.device = device
        self._model = None
        self._preprocess = None
        self._tokenizer = None
        self._pretrained = pretrained

        if config in self.VISION_CONFIGS:
            self._type = "vision"
        elif config in self.SPATIAL_CONFIGS:
            self._type = "spatial"
        elif config in self.AUDIO_VISUAL_CONFIGS:
            self._type = "audio_visual"
        else:
            self._type = "vision"

    @property
    def model(self):
        if self._model is None:
            self._load_model()
        return self._model

    def _load_model(self):
        sys.path.insert(0, PERCEPTION_PATH)

        if self._type in ("vision", "spatial"):
            from core.vision_encoder import pe as perception_encoder
            from core.vision_encoder import transforms as pe_transforms

            self._model = perception_encoder.CLIP.from_config(
                self.config, pretrained=self._pretrained
            )
            self._model = self._model.to(self.device)
            self._model.eval()

            self._preprocess = pe_transforms.get_image_transform(self._model.image_size)
            self._tokenizer = pe_transforms.get_text_tokenizer(
                self._model.context_length
            )

    def encode_image(self, image: Union[Image.Image, str]) -> torch.Tensor:
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")

        img_tensor = self._preprocess(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            features, _, _ = self.model(img_tensor, None)

        return features.squeeze()

    def encode_text(self, texts: Union[str, List[str]]) -> torch.Tensor:
        if isinstance(texts, str):
            texts = [texts]

        tokens = self._tokenizer(texts).to(self.device)

        with torch.no_grad():
            _, features, _ = self.model(None, tokens)

        return features

    def image_text_similarity(
        self, image: Union[Image.Image, str], texts: Union[str, List[str]]
    ) -> Tuple[torch.Tensor, torch.Tensor, float]:
        if isinstance(image, str):
            image = Image.open(image).convert("RGB")

        if isinstance(texts, str):
            texts = [texts]

        img_tensor = self._preprocess(image).unsqueeze(0).to(self.device)
        text_tokens = self._tokenizer(texts).to(self.device)

        with torch.no_grad():
            img_feats, text_feats, logit_scale = self.model(img_tensor, text_tokens)

        return img_feats.squeeze(), text_feats, logit_scale.item()

    def classify(
        self, image: Union[Image.Image, str], labels: List[str]
    ) -> Dict[str, float]:
        img_feats, text_feats, logit_scale = self.image_text_similarity(image, labels)

        similarities = logit_scale * (img_feats @ text_feats.T)
        probs = similarities.softmax(dim=-1).cpu()

        return {label: prob.item() for label, prob in zip(labels, probs)}

    def zero_shot_classify(
        self, image: Union[Image.Image, str], labels: List[str]
    ) -> str:
        scores = self.classify(image, labels)
        return max(scores, key=lambda k: scores[k])


class PerceptionBridge:
    """Bridge for integrating Perception Encoder with external AI systems."""

    def __init__(self, encoder: PerceptionEncoder):
        self.encoder = encoder

    def to_sensor_format(
        self, features: torch.Tensor, target_dim: int = 64
    ) -> torch.Tensor:
        current_dim = features.shape[-1]

        if current_dim > target_dim:
            return features[..., :target_dim]
        elif current_dim < target_dim:
            padding = torch.zeros(
                *features.shape[:-1], target_dim - current_dim, device=features.device
            )
            return torch.cat([features, padding], dim=-1)

        return features

    def extract_multi_scale(
        self, image: Union[Image.Image, str], scales: List[int] = [1, 2, 4]
    ) -> Dict[int, torch.Tensor]:
        if isinstance(image, str):
            pil_image = Image.open(image).convert("RGB")
        else:
            pil_image = image

        results = {}
        for scale in scales:
            if scale != 1:
                scaled = pil_image.resize(
                    (pil_image.width * scale, pil_image.height * scale), Image.LANCZOS
                )
            else:
                scaled = pil_image

            results[scale] = self.encoder.encode_image(scaled)

        return results


def create_perception_encoder(
    config: str = "PE-Core-B16-224", device: str = "cpu"
) -> PerceptionEncoder:
    """Factory function to create Perception Encoder."""
    return PerceptionEncoder(config=config, device=device)


def list_available_configs() -> Dict[str, List[str]]:
    """List all available model configurations."""
    return {
        "vision": PerceptionEncoder.VISION_CONFIGS,
        "spatial": PerceptionEncoder.SPATIAL_CONFIGS,
        "audio_visual": PerceptionEncoder.AUDIO_VISUAL_CONFIGS,
    }


if __name__ == "__main__":
    print("Perception Encoder - Facebook Research")
    print("=" * 50)
    print("Available configs:")
    for category, configs in list_available_configs().items():
        print(f"\n{category.upper()}:")
        for cfg in configs:
            print(f"  - {cfg}")
