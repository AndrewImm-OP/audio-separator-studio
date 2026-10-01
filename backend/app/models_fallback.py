"""
Fallback model creation when MSST repository is not in the path.
Uses direct PyTorch model construction from known architectures.

This module provides standalone model loading that doesn't depend on
having the full MSST repo cloned. It installs the required packages
(like bs_roformer from lucidrains) and loads models directly.
"""

import logging
import torch
import yaml
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def _install_package(package_name: str):
    """Install a Python package if not available."""
    try:
        __import__(package_name.replace("-", "_"))
    except ImportError:
        import subprocess
        import sys
        logger.info(f"Installing {package_name}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package_name, "-q"])


def create_roformer_model(
    model_type: str,
    config: dict,
    checkpoint_path: str | Path,
    device: torch.device,
):
    """
    Create BS-Roformer or MelBand-Roformer using lucidrains' bs_roformer package.
    """
    _install_package("bs-roformer")

    from bs_roformer import BSRoformer, MelBandRoformer

    model_config = config.get("model", {})

    # Map config keys to constructor params
    if model_type == "mel_band_roformer":
        model = MelBandRoformer(
            dim=model_config.get("dim", 384),
            depth=model_config.get("depth", 12),
            stereo=model_config.get("stereo", True),
            time_transformer_depth=model_config.get("time_transformer_depth", 1),
            freq_transformer_depth=model_config.get("freq_transformer_depth", 1),
            num_stems=model_config.get("num_stems", 1),
            num_bands=model_config.get("num_bands", 60),
            dim_head=model_config.get("dim_head", 64),
            heads=model_config.get("heads", 8),
            attn_dropout=model_config.get("attn_dropout", 0.0),
            ff_dropout=model_config.get("ff_dropout", 0.0),
            stft_n_fft=model_config.get("stft_n_fft", 2048),
            stft_hop_length=model_config.get("stft_hop_length", 512),
        )
    else:
        model = BSRoformer(
            dim=model_config.get("dim", 384),
            depth=model_config.get("depth", 12),
            stereo=model_config.get("stereo", True),
            time_transformer_depth=model_config.get("time_transformer_depth", 1),
            freq_transformer_depth=model_config.get("freq_transformer_depth", 1),
            num_stems=model_config.get("num_stems", 1),
            dim_head=model_config.get("dim_head", 64),
            heads=model_config.get("heads", 8),
            attn_dropout=model_config.get("attn_dropout", 0.0),
            ff_dropout=model_config.get("ff_dropout", 0.0),
            stft_n_fft=model_config.get("stft_n_fft", 2048),
            stft_hop_length=model_config.get("stft_hop_length", 512),
        )

    # Load checkpoint
    state_dict = torch.load(str(checkpoint_path), map_location="cpu", weights_only=False)
    if "state_dict" in state_dict:
        state_dict = state_dict["state_dict"]

    # Handle potential key mismatches
    try:
        model.load_state_dict(state_dict, strict=False)
    except RuntimeError as e:
        logger.warning(f"Partial weight loading: {e}")
        # Try to load what we can
        model_state = model.state_dict()
        loaded = 0
        for key, value in state_dict.items():
            if key in model_state and model_state[key].shape == value.shape:
                model_state[key] = value
                loaded += 1
        model.load_state_dict(model_state)
        logger.info(f"Loaded {loaded}/{len(state_dict)} weights")

    return model


def create_mdx23c_model(config: dict, checkpoint_path: str | Path, device: torch.device):
    """
    Create MDX23C model.
    MDX23C uses TFC-TDF architecture which is part of MSST.
    For standalone usage, we need the MSST repo.
    """
    logger.warning("MDX23C requires MSST repository. Set MSST_PATH environment variable.")
    raise ImportError(
        "MDX23C model requires the Music-Source-Separation-Training repository. "
        "Clone it and set MSST_PATH=/path/to/repo"
    )


def create_htdemucs_model(config: dict, checkpoint_path: str | Path, device: torch.device):
    """
    Create HTDemucs model using the demucs package.
    """
    _install_package("demucs")

    from demucs.pretrained import get_model as demucs_get_model
    from demucs.apply import apply_model

    # For HTDemucs, we can use the demucs package directly
    # The checkpoint files from Facebook are compatible
    logger.warning(
        "HTDemucs standalone loading uses demucs package. "
        "For MSST-trained checkpoints, set MSST_PATH."
    )
    raise ImportError(
        "HTDemucs model requires either the demucs package or MSST repository. "
        "Install demucs: pip install demucs"
    )


def create_scnet_model(config: dict, checkpoint_path: str | Path, device: torch.device):
    """
    Create SCNet model.
    SCNet is part of MSST repository.
    """
    logger.warning("SCNet requires MSST repository. Set MSST_PATH environment variable.")
    raise ImportError(
        "SCNet model requires the Music-Source-Separation-Training repository. "
        "Clone it and set MSST_PATH=/path/to/repo"
    )
