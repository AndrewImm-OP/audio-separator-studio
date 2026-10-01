"""
Model download and management system.
Handles downloading configs/checkpoints from URLs and caching them locally.
"""

import os
import asyncio
import logging
from pathlib import Path
from typing import Optional, Callable

import requests
from huggingface_hub import hf_hub_download
from tqdm import tqdm

from .model_registry import ModelInfo, get_all_models, get_model

logger = logging.getLogger(__name__)

DEFAULT_MODELS_DIR = Path.home() / ".cache" / "audio-separator" / "models"


class ModelManager:
    """Manages downloading, caching and loading of separation models."""

    def __init__(self, models_dir: Optional[Path] = None):
        self.models_dir = models_dir or DEFAULT_MODELS_DIR
        self.models_dir.mkdir(parents=True, exist_ok=True)
        self._download_progress: dict[str, float] = {}

    def get_model_dir(self, model_key: str) -> Path:
        """Get the local directory for a specific model."""
        path = self.models_dir / model_key
        path.mkdir(parents=True, exist_ok=True)
        return path

    def is_model_downloaded(self, model_key: str) -> bool:
        """Check if a model's files are already downloaded."""
        model_dir = self.get_model_dir(model_key)
        config_exists = any(model_dir.glob("*.yaml")) or any(model_dir.glob("*.yml"))
        checkpoint_exists = (
            any(model_dir.glob("*.ckpt"))
            or any(model_dir.glob("*.th"))
            or any(model_dir.glob("*.bin"))
            or any(model_dir.glob("*.pth"))
        )
        return config_exists and checkpoint_exists

    def get_local_paths(self, model_key: str) -> tuple[Optional[Path], Optional[Path]]:
        """Return (config_path, checkpoint_path) for a downloaded model."""
        model_dir = self.get_model_dir(model_key)

        config_path = None
        for ext in ["*.yaml", "*.yml"]:
            files = list(model_dir.glob(ext))
            if files:
                config_path = files[0]
                break

        checkpoint_path = None
        for ext in ["*.ckpt", "*.th", "*.bin", "*.pth"]:
            files = list(model_dir.glob(ext))
            if files:
                checkpoint_path = files[0]
                break

        return config_path, checkpoint_path

    def _download_file(
        self,
        url: str,
        dest: Path,
        progress_callback: Optional[Callable[[float], None]] = None,
    ) -> Path:
        """Download a file from URL with progress tracking."""
        logger.info(f"Downloading {url} -> {dest}")

        if "huggingface.co" in url and "/resolve/" in url:
            # Use huggingface_hub for HF downloads (handles auth, retries)
            parts = url.split("huggingface.co/")[1]
            # Extract repo_id and filename
            if "/resolve/" in parts:
                repo_part, file_part = parts.split("/resolve/main/", 1)
                try:
                    downloaded = hf_hub_download(
                        repo_id=repo_part,
                        filename=file_part,
                        local_dir=dest.parent,
                        local_dir_use_symlinks=False,
                    )
                    # Move to expected location if needed
                    downloaded_path = Path(downloaded)
                    if downloaded_path != dest:
                        downloaded_path.rename(dest)
                    if progress_callback:
                        progress_callback(1.0)
                    return dest
                except Exception as e:
                    logger.warning(f"HF hub download failed, falling back to requests: {e}")

        # Standard HTTP download with progress
        response = requests.get(url, stream=True, allow_redirects=True, timeout=30)
        response.raise_for_status()

        total_size = int(response.headers.get("content-length", 0))
        downloaded = 0

        with open(dest, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192 * 16):
                f.write(chunk)
                downloaded += len(chunk)
                if total_size > 0 and progress_callback:
                    progress_callback(downloaded / total_size)

        if progress_callback:
            progress_callback(1.0)

        return dest

    def download_model(
        self,
        model_key: str,
        progress_callback: Optional[Callable[[str, float], None]] = None,
    ) -> tuple[Path, Path]:
        """
        Download a model's config and checkpoint.
        Returns (config_path, checkpoint_path).
        """
        model_info = get_model(model_key)
        if model_info is None:
            raise ValueError(f"Unknown model: {model_key}")

        model_dir = self.get_model_dir(model_key)

        # Check if already downloaded
        if self.is_model_downloaded(model_key):
            config_path, checkpoint_path = self.get_local_paths(model_key)
            if config_path and checkpoint_path:
                logger.info(f"Model {model_key} already downloaded")
                return config_path, checkpoint_path

        # Download config
        config_filename = model_info.config_url.split("/")[-1]
        if not config_filename.endswith((".yaml", ".yml")):
            config_filename = f"{model_key}_config.yaml"
        config_path = model_dir / config_filename

        if not config_path.exists():
            def config_progress(p: float):
                if progress_callback:
                    progress_callback("config", p)

            self._download_file(model_info.config_url, config_path, config_progress)

        # Download checkpoint
        checkpoint_filename = model_info.checkpoint_url.split("/")[-1]
        checkpoint_path = model_dir / checkpoint_filename

        if not checkpoint_path.exists():
            def checkpoint_progress(p: float):
                if progress_callback:
                    progress_callback("checkpoint", p)

            self._download_file(
                model_info.checkpoint_url, checkpoint_path, checkpoint_progress
            )

        logger.info(f"Model {model_key} downloaded to {model_dir}")
        return config_path, checkpoint_path

    async def download_model_async(
        self,
        model_key: str,
        progress_callback: Optional[Callable[[str, float], None]] = None,
    ) -> tuple[Path, Path]:
        """Async wrapper for model download."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self.download_model, model_key, progress_callback
        )

    def get_downloaded_models(self) -> list[str]:
        """Return list of model keys that are already downloaded."""
        return [
            key for key in get_all_models().keys() if self.is_model_downloaded(key)
        ]

    def get_download_status(self) -> dict[str, dict]:
        """Get download status for all models."""
        all_models = get_all_models()
        status = {}
        for key, info in all_models.items():
            is_downloaded = self.is_model_downloaded(key)
            config_path, checkpoint_path = self.get_local_paths(key) if is_downloaded else (None, None)
            status[key] = {
                "key": key,
                "name": info.name,
                "model_type": info.model_type,
                "stems": info.stems,
                "is_downloaded": is_downloaded,
                "config_path": str(config_path) if config_path else None,
                "checkpoint_path": str(checkpoint_path) if checkpoint_path else None,
                "size_mb": info.size_mb,
                "sdr_metrics": info.sdr_metrics,
                "description": info.description,
            }
        return status

    def delete_model(self, model_key: str) -> bool:
        """Delete a downloaded model."""
        import shutil
        model_dir = self.get_model_dir(model_key)
        if model_dir.exists():
            shutil.rmtree(model_dir)
            logger.info(f"Deleted model {model_key}")
            return True
        return False
