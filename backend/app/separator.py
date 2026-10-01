"""
Core audio separation engine.
Wraps Music-Source-Separation-Training inference for various model types.
"""

import gc
import logging
import os
import sys
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf
import torch
import yaml

logger = logging.getLogger(__name__)


class _DictAsAttr:
    """Lightweight recursive wrapper that exposes dict keys as attributes.
    Used as a fallback when OmegaConf is not installed, so MSST's
    ``get_model(args)`` can do ``args.training.instruments`` etc."""

    def __init__(self, d: dict):
        self._d = d

    def __getattr__(self, name: str):
        try:
            v = self._d[name]
        except KeyError:
            raise AttributeError(name)
        if isinstance(v, dict):
            return _DictAsAttr(v)
        return v

    def __contains__(self, key):
        return key in self._d

    def __iter__(self):
        return iter(self._d)


# We clone MSST repo or install it; this module adapts its inference code.
# The key insight: we load models via their config + checkpoint and run
# the same inference pipeline that MSST's inference.py uses.

# Supported model type -> module mapping
MODEL_TYPE_MAP = {
    "bs_roformer": "models.bs_roformer",
    "mel_band_roformer": "models.bs_roformer",
    "mdx23c": "models.mdx23c",
    "htdemucs": "models.demucs",
    "segm_models": "models.segm_models",
    "scnet": "models.scnet",
    "bandit": "models.bandit",
    "bandit_v2": "models.bandit_v2",
    "apollo": "models.apollo",
    "bs_mamba2": "models.bs_mamba2",
    "torchseg": "models.torchseg",
    "swin_upernet": "models.swin_upernet",
}


class _ModelConfigLoader(yaml.SafeLoader):
    """SafeLoader extended with support for !!python/tuple, !!python/list,
    and scientific-notation floats (e.g. ``1e-3``) that appear in MSST
    model config files.

    PyYAML's SafeLoader only recognises scientific notation when it
    contains a dot (``1.0e-3``).  Values like ``1e-3`` are left as
    strings, which breaks downstream code that expects floats.
    """
    pass

import re

# Pattern for scientific notation without a decimal point (e.g. 1e-3, 5E+10)
_SCI_RE = re.compile(r'^[-+]?[0-9]+[eE][-+]?[0-9]+$')

_ModelConfigLoader.add_implicit_resolver(
    'tag:yaml.org,2002:float',
    _SCI_RE,
    list('-+0123456789'),
)

_ModelConfigLoader.add_constructor(
    "tag:yaml.org,2002:python/tuple",
    lambda loader, node: tuple(loader.construct_sequence(node)),
)
_ModelConfigLoader.add_constructor(
    "tag:yaml.org,2002:python/list",
    lambda loader, node: loader.construct_sequence(node),
)


def load_config(config_path: str | Path) -> dict:
    """Load YAML config file (supports !!python/tuple from MSST configs)."""
    with open(config_path, "r") as f:
        config = yaml.load(f, Loader=_ModelConfigLoader)
    return config


def get_device(device: Optional[str] = None) -> torch.device:
    """Determine the best available device."""
    if device:
        return torch.device(device)
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


class SeparationEngine:
    """
    Core separation engine that loads models and runs inference.
    Uses Music-Source-Separation-Training model architectures.
    """

    def __init__(
        self,
        msst_path: Optional[str] = None,
        device: Optional[str] = None,
    ):
        self.device = get_device(device)
        self.msst_path = msst_path or os.environ.get("MSST_PATH", "")
        self._loaded_models: dict[str, tuple] = {}  # key -> (model, config)

        # Add MSST to path if available
        if self.msst_path and self.msst_path not in sys.path:
            sys.path.insert(0, self.msst_path)

    def _load_model(
        self,
        model_type: str,
        config_path: str | Path,
        checkpoint_path: str | Path,
    ) -> tuple:
        """
        Load a model from config and checkpoint.
        Returns (model, config_dict).
        """
        config = load_config(config_path)

        logger.info(f"Loading model type={model_type} from {checkpoint_path}")

        model = None

        if model_type in ("bs_roformer", "mel_band_roformer"):
            model = self._load_roformer(model_type, config, checkpoint_path)
        elif model_type == "mdx23c":
            model = self._load_mdx23c(config, checkpoint_path)
        elif model_type == "htdemucs":
            model = self._load_htdemucs(config, checkpoint_path)
        elif model_type == "scnet":
            model = self._load_scnet(config, checkpoint_path)
        else:
            raise ValueError(f"Unsupported model type: {model_type}")

        if model is not None:
            model = model.to(self.device)
            model.eval()

        return model, config

    def _load_roformer(self, model_type: str, config: dict, checkpoint_path: str | Path):
        """Load BS-Roformer or MelBand-Roformer model."""
        try:
            from models.bs_roformer import BSRoformer, MelBandRoformer
        except ImportError:
            # Fallback: try to import from the bundled models
            from .models_fallback import create_roformer_model
            return create_roformer_model(model_type, config, checkpoint_path, self.device)

        model_config = config.get("model", config)

        if model_type == "mel_band_roformer":
            model = MelBandRoformer(**model_config)
        else:
            model = BSRoformer(**model_config)

        state_dict = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        if "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        model.load_state_dict(state_dict, strict=False)
        return model

    def _load_mdx23c(self, config: dict, checkpoint_path: str | Path):
        """Load MDX23C model."""
        try:
            from models.mdx23c_tfc_tdf_v3 import TFC_TDF_net
        except ImportError:
            from .models_fallback import create_mdx23c_model
            return create_mdx23c_model(config, checkpoint_path, self.device)

        model_config = config.get("model", config)
        model = TFC_TDF_net(model_config)

        state_dict = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        if "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        model.load_state_dict(state_dict, strict=False)
        return model

    def _load_htdemucs(self, config: dict, checkpoint_path: str | Path):
        """Load HTDemucs model."""
        try:
            from models.demucs4ht import get_model as get_demucs
        except ImportError:
            from .models_fallback import create_htdemucs_model
            return create_htdemucs_model(config, checkpoint_path, self.device)

        # get_model() expects an OmegaConf-style object with attribute access
        # (e.g. args.training.instruments). Convert the plain dict.
        try:
            from omegaconf import OmegaConf
            args = OmegaConf.create(config)
        except ImportError:
            args = _DictAsAttr(config)

        model = get_demucs(args)
        state_dict = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        if "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        model.load_state_dict(state_dict, strict=False)
        return model

    def _load_scnet(self, config: dict, checkpoint_path: str | Path):
        """Load SCNet model."""
        try:
            from models.scnet import SCNet
        except ImportError:
            from .models_fallback import create_scnet_model
            return create_scnet_model(config, checkpoint_path, self.device)

        model_config = config.get("model", config)
        model = SCNet(**model_config)

        state_dict = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        if "state_dict" in state_dict:
            state_dict = state_dict["state_dict"]
        model.load_state_dict(state_dict, strict=False)
        return model

    def load_model(self, model_key: str, config_path: str, checkpoint_path: str, model_type: str):
        """Load and cache a model."""
        if model_key in self._loaded_models:
            logger.info(f"Model {model_key} already loaded")
            return

        model, config = self._load_model(model_type, config_path, checkpoint_path)
        self._loaded_models[model_key] = (model, config)
        logger.info(f"Model {model_key} loaded successfully")

    def unload_model(self, model_key: str):
        """Unload a model to free memory."""
        if model_key in self._loaded_models:
            del self._loaded_models[model_key]
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            logger.info(f"Model {model_key} unloaded")

    def unload_all(self):
        """Unload all models."""
        self._loaded_models.clear()
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @torch.no_grad()
    def separate(
        self,
        model_key: str,
        audio_path: str | Path,
        output_dir: str | Path,
        overlap: float = 0.25,
        chunk_size: int = 485100,
        output_format: str = "wav_16",
        progress_callback = None,
        low_vram: bool = False,
    ) -> dict[str, Path]:
        """
        Separate an audio file using a loaded model.

        Args:
            model_key: Key of the loaded model
            audio_path: Path to input audio file
            output_dir: Directory to save separated stems
            overlap: Overlap between chunks (0.0-0.5)
            chunk_size: Number of samples per chunk
            output_format: Audio format (wav_16, wav_24, wav_float, flac)
            progress_callback: Optional callable(progress_pct, message)
            low_vram: Whether to minimize GPU memory consumption

        Returns:
            Dict mapping stem name -> output file path
        """
        if model_key not in self._loaded_models:
            raise RuntimeError(f"Model {model_key} is not loaded")

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        model, config = self._loaded_models[model_key]
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Load audio
        audio, sr = self._load_audio(audio_path, config)

        if low_vram and chunk_size > 352800:
            chunk_size = 352800

        # Run separation
        stems = self._run_inference(
            model, config, audio, sr, overlap, chunk_size, progress_callback, low_vram
        )

        # Save stems
        input_name = Path(audio_path).stem
        output_paths = {}

        ext = ".flac" if output_format == "flac" else ".wav"
        subtype_map = {
            "wav_16": "PCM_16",
            "wav_24": "PCM_24",
            "wav_float": "FLOAT",
        }

        for stem_name, stem_audio in stems.items():
            # Clip / gentle normalization to prevent harsh clipping distortion
            max_val = np.max(np.abs(stem_audio))
            if max_val > 1.0:
                stem_audio = stem_audio / max_val * 0.99
            elif output_format in ("wav_16", "wav_24") and max_val > 0.999:
                stem_audio = np.clip(stem_audio, -1.0, 1.0)

            output_path = output_dir / f"{input_name}_{stem_name}{ext}"
            if output_format == "flac":
                sf.write(str(output_path), stem_audio.T, sr, format="FLAC")
            else:
                subtype = subtype_map.get(output_format, "PCM_16")
                sf.write(str(output_path), stem_audio.T, sr, subtype=subtype)

            output_paths[stem_name] = output_path
            logger.info(f"Saved {stem_name} ({output_format}) -> {output_path}")

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return output_paths

    def _load_audio(self, audio_path: str | Path, config: dict) -> tuple[np.ndarray, int]:
        """Load and preprocess audio."""
        import librosa

        target_sr = config.get("audio", {}).get("sample_rate", 44100)

        audio, sr = librosa.load(str(audio_path), sr=target_sr, mono=False)

        # Ensure stereo
        if audio.ndim == 1:
            audio = np.stack([audio, audio])

        return audio, target_sr

    def _run_inference(
        self,
        model,
        config: dict,
        audio: np.ndarray,
        sr: int,
        overlap: float,
        chunk_size: int,
        progress_callback = None,
        low_vram: bool = False,
    ) -> dict[str, np.ndarray]:
        """
        Run model inference with chunked processing and overlap-add windowing.
        Returns dict of stem_name -> audio array.
        """
        # Convert to tensor
        mix = torch.tensor(audio, dtype=torch.float32).unsqueeze(0).to(self.device)

        # Get stem names from config
        training_config = config.get("training", {})
        target_instrument = training_config.get("target_instrument", None)
        instruments = training_config.get("instruments", ["vocals", "other"])

        n_samples = mix.shape[-1]
        stems_output = {}

        if chunk_size <= 0 or n_samples <= chunk_size:
            # Process entire audio at once
            with torch.amp.autocast(device_type=str(self.device), enabled=self.device.type == "cuda"):
                result = model(mix)
            stems_output = self._extract_stems(result, mix, instruments, target_instrument)
            if progress_callback:
                progress_callback(90, "Finalizing stems...")
        else:
            # Chunked processing with overlap-add windowing
            step = int(chunk_size * (1 - overlap))
            accumulated = {}
            weight_sum = np.zeros(n_samples, dtype=np.float32)

            # Build a Hann window for smooth overlap-add blending
            window = np.hanning(chunk_size).astype(np.float32)
            total_chunks = len(range(0, n_samples, step))

            for chunk_idx, start in enumerate(range(0, n_samples, step)):
                end = min(start + chunk_size, n_samples)
                chunk_len = end - start
                chunk = mix[:, :, start:end]

                # Pad if needed
                if chunk.shape[-1] < chunk_size:
                    pad_size = chunk_size - chunk.shape[-1]
                    chunk = torch.nn.functional.pad(chunk, (0, pad_size))

                try:
                    with torch.amp.autocast(device_type=str(self.device), enabled=self.device.type == "cuda"):
                        result = model(chunk)
                except (torch.cuda.OutOfMemoryError, RuntimeError) as e:
                    if "out of memory" in str(e).lower() and self.device.type == "cuda":
                        logger.warning("CUDA OOM in chunk! Freeing cache and retrying on CPU...")
                        gc.collect()
                        torch.cuda.empty_cache()
                        model_cpu = model.to("cpu")
                        chunk_cpu = chunk.to("cpu")
                        result = model_cpu(chunk_cpu)
                        model.to(self.device)
                    else:
                        raise

                chunk_stems = self._extract_stems(result, chunk, instruments, target_instrument)

                for name, stem_audio in chunk_stems.items():
                    if name not in accumulated:
                        accumulated[name] = np.zeros((2, n_samples), dtype=np.float32)

                    # Clamp to actual unpadded length and model output
                    write_len = min(chunk_len, stem_audio.shape[-1], n_samples - start)
                    win = window[:write_len]

                    accumulated[name][:, start : start + write_len] += (
                        stem_audio[:, :write_len] * win[np.newaxis, :]
                    )

                # Accumulate window weights
                write_len_w = min(chunk_len, n_samples - start)
                weight_sum[start : start + write_len_w] += window[:write_len_w]

                if low_vram and self.device.type == "cuda":
                    torch.cuda.empty_cache()

                if progress_callback:
                    pct = 30 + int((chunk_idx + 1) / total_chunks * 60)
                    progress_callback(pct, f"Separating audio: chunk {chunk_idx + 1}/{total_chunks}...")

            # Normalize by accumulated window weights to complete overlap-add
            weight_sum = np.maximum(weight_sum, 1e-8)
            for name in accumulated:
                accumulated[name] /= weight_sum[np.newaxis, :]

            stems_output = accumulated

        return stems_output

    @staticmethod
    def _match_length(a: np.ndarray, target_len: int) -> np.ndarray:
        """Pad or trim array along the last axis to match target_len."""
        if a.shape[-1] == target_len:
            return a
        if a.shape[-1] > target_len:
            return a[..., :target_len]
        pad_width = [(0, 0)] * (a.ndim - 1) + [(0, target_len - a.shape[-1])]
        return np.pad(a, pad_width)

    def _extract_stems(
        self,
        model_output,
        mix: torch.Tensor,
        instruments: list[str],
        target_instrument: Optional[str],
    ) -> dict[str, np.ndarray]:
        """Extract individual stems from model output.

        All returned stems are guaranteed to be 2-D ``(channels, samples)``
        with the same sample count as ``mix``, even when the model produces a
        slightly different length (common with STFT-based architectures).
        """
        stems: dict[str, np.ndarray] = {}
        mix_np = mix.cpu().numpy()
        # Strip batch dimension(s) to get (channels, samples)
        while mix_np.ndim > 2:
            mix_np = mix_np[0]
        mix_len = mix_np.shape[-1]

        if isinstance(model_output, torch.Tensor):
            output_np = model_output.cpu().numpy()
            # Strip batch / extra leading dimensions so we work with
            # either (channels, samples) or (stems, channels, samples).
            while output_np.ndim > 3 and output_np.shape[0] == 1:
                output_np = output_np[0]

            output_np = self._match_length(output_np, mix_len)

            if target_instrument:
                # Model outputs single target stem – shape (channels, samples)
                # or (1, channels, samples); squeeze to 2-D.
                stem = output_np
                while stem.ndim > 2:
                    stem = stem[0]
                stems[target_instrument] = stem
                # Compute residual
                other_name = [i for i in instruments if i != target_instrument]
                if other_name:
                    stems[other_name[0]] = mix_np - stem
            elif output_np.ndim == 3:
                # Shape: (stems, channels, samples)
                for i, name in enumerate(instruments):
                    if i < output_np.shape[0]:
                        stems[name] = output_np[i]
            else:
                # Shape: (channels, samples)
                stems[instruments[0]] = output_np
                if len(instruments) > 1:
                    stems[instruments[1]] = mix_np - output_np

        elif isinstance(model_output, (list, tuple)):
            for i, (name, tensor) in enumerate(zip(instruments, model_output)):
                arr = tensor.cpu().numpy() if isinstance(tensor, torch.Tensor) else tensor
                while arr.ndim > 2:
                    arr = arr[0]
                stems[name] = self._match_length(arr, mix_len)

        elif isinstance(model_output, dict):
            for name, tensor in model_output.items():
                arr = tensor.cpu().numpy() if isinstance(tensor, torch.Tensor) else tensor
                while arr.ndim > 2:
                    arr = arr[0]
                stems[name] = self._match_length(arr, mix_len)

        return stems

    def get_loaded_models(self) -> list[str]:
        """Return list of currently loaded model keys."""
        return list(self._loaded_models.keys())
