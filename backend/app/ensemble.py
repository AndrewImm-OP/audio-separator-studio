"""
Ensemble engine for combining results from multiple separation models.
Supports multiple blending strategies in both waveform and spectral domains.
"""

import logging
from enum import Enum
from pathlib import Path
from typing import Optional

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)


class EnsembleMethod(str, Enum):
    """Available ensemble methods."""
    AVG_WAVE = "avg_wave"
    MEDIAN_WAVE = "median_wave"
    MIN_WAVE = "min_wave"
    MAX_WAVE = "max_wave"
    AVG_FFT = "avg_fft"
    MEDIAN_FFT = "median_fft"
    MIN_FFT = "min_fft"
    MAX_FFT = "max_fft"


# STFT parameters for spectral domain methods
STFT_N_FFT = 4096
STFT_HOP_LENGTH = 1024


def _stft(audio: np.ndarray) -> np.ndarray:
    """Compute STFT for each channel."""
    from scipy.signal import stft as scipy_stft
    result = []
    for ch in range(audio.shape[0]):
        _, _, Zxx = scipy_stft(audio[ch], nperseg=STFT_N_FFT, noverlap=STFT_N_FFT - STFT_HOP_LENGTH)
        result.append(Zxx)
    return np.array(result)


def _istft(spectrogram: np.ndarray, length: int) -> np.ndarray:
    """Compute inverse STFT for each channel."""
    from scipy.signal import istft as scipy_istft
    result = []
    for ch in range(spectrogram.shape[0]):
        _, audio = scipy_istft(spectrogram[ch], nperseg=STFT_N_FFT, noverlap=STFT_N_FFT - STFT_HOP_LENGTH)
        result.append(audio[:length])
    return np.array(result)


def ensemble_waveforms(
    waveforms: list[np.ndarray],
    method: EnsembleMethod = EnsembleMethod.AVG_WAVE,
    weights: Optional[list[float]] = None,
) -> np.ndarray:
    """
    Ensemble multiple waveforms using the specified method.

    Args:
        waveforms: List of audio arrays, each shape (channels, samples)
        method: Ensemble method to use
        weights: Optional weights for each waveform (only used with avg methods)

    Returns:
        Ensembled audio array (channels, samples)
    """
    if not waveforms:
        raise ValueError("No waveforms to ensemble")

    if len(waveforms) == 1:
        return waveforms[0]

    # Ensure all waveforms have the same length
    max_length = max(w.shape[-1] for w in waveforms)
    padded = []
    for w in waveforms:
        if w.shape[-1] < max_length:
            pad_width = max_length - w.shape[-1]
            w = np.pad(w, ((0, 0), (0, pad_width)))
        padded.append(w)

    stack = np.stack(padded, axis=0)  # (n_models, channels, samples)

    if method == EnsembleMethod.AVG_WAVE:
        if weights:
            weights_arr = np.array(weights, dtype=np.float32)
            weights_arr = weights_arr / weights_arr.sum()
            result = np.average(stack, axis=0, weights=weights_arr)
        else:
            result = np.mean(stack, axis=0)

    elif method == EnsembleMethod.MEDIAN_WAVE:
        result = np.median(stack, axis=0)

    elif method == EnsembleMethod.MIN_WAVE:
        # For each sample, pick the value with minimum absolute magnitude
        abs_stack = np.abs(stack)
        min_indices = np.argmin(abs_stack, axis=0)
        result = np.take_along_axis(stack, min_indices[np.newaxis], axis=0)[0]

    elif method == EnsembleMethod.MAX_WAVE:
        # For each sample, pick the value with maximum absolute magnitude
        abs_stack = np.abs(stack)
        max_indices = np.argmax(abs_stack, axis=0)
        result = np.take_along_axis(stack, max_indices[np.newaxis], axis=0)[0]

    elif method in (
        EnsembleMethod.AVG_FFT,
        EnsembleMethod.MEDIAN_FFT,
        EnsembleMethod.MIN_FFT,
        EnsembleMethod.MAX_FFT,
    ):
        result = _ensemble_spectral(padded, method, weights, max_length)

    else:
        raise ValueError(f"Unknown ensemble method: {method}")

    return result.astype(np.float32)


def _ensemble_spectral(
    waveforms: list[np.ndarray],
    method: EnsembleMethod,
    weights: Optional[list[float]],
    original_length: int,
) -> np.ndarray:
    """Ensemble in spectral domain using STFT."""
    # Compute STFT for all waveforms
    spectrograms = [_stft(w) for w in waveforms]

    # Get magnitude and phase
    magnitudes = [np.abs(s) for s in spectrograms]
    phases = [np.angle(s) for s in spectrograms]

    mag_stack = np.stack(magnitudes, axis=0)  # (n_models, channels, freq, time)

    if method == EnsembleMethod.AVG_FFT:
        if weights:
            weights_arr = np.array(weights, dtype=np.float32)
            weights_arr = weights_arr / weights_arr.sum()
            avg_magnitude = np.average(mag_stack, axis=0, weights=weights_arr)
        else:
            avg_magnitude = np.mean(mag_stack, axis=0)
        # Use phase from the source with highest avg magnitude
        avg_mags = [m.mean() for m in magnitudes]
        best_phase_idx = np.argmax(avg_mags)
        result_spec = avg_magnitude * np.exp(1j * phases[best_phase_idx])

    elif method == EnsembleMethod.MEDIAN_FFT:
        median_magnitude = np.median(mag_stack, axis=0)
        avg_mags = [m.mean() for m in magnitudes]
        best_phase_idx = np.argmax(avg_mags)
        result_spec = median_magnitude * np.exp(1j * phases[best_phase_idx])

    elif method == EnsembleMethod.MIN_FFT:
        min_indices = np.argmin(mag_stack, axis=0)
        min_magnitude = np.take_along_axis(mag_stack, min_indices[np.newaxis], axis=0)[0]
        # Use phase from corresponding source
        phase_stack = np.stack(phases, axis=0)
        selected_phase = np.take_along_axis(phase_stack, min_indices[np.newaxis], axis=0)[0]
        result_spec = min_magnitude * np.exp(1j * selected_phase)

    elif method == EnsembleMethod.MAX_FFT:
        max_indices = np.argmax(mag_stack, axis=0)
        max_magnitude = np.take_along_axis(mag_stack, max_indices[np.newaxis], axis=0)[0]
        phase_stack = np.stack(phases, axis=0)
        selected_phase = np.take_along_axis(phase_stack, max_indices[np.newaxis], axis=0)[0]
        result_spec = max_magnitude * np.exp(1j * selected_phase)

    else:
        raise ValueError(f"Unknown spectral ensemble method: {method}")

    # Inverse STFT
    return _istft(result_spec, original_length)


class EnsemblePipeline:
    """
    High-level pipeline for running ensemble separation.
    Orchestrates multiple model runs and combines results.
    """

    def __init__(self, separator, model_manager):
        """
        Args:
            separator: SeparationEngine instance
            model_manager: ModelManager instance
        """
        self.separator = separator
        self.model_manager = model_manager

    def run_ensemble(
        self,
        audio_path: str | Path,
        model_keys: list[str],
        output_dir: str | Path,
        method: EnsembleMethod = EnsembleMethod.AVG_WAVE,
        weights: Optional[list[float]] = None,
        progress_callback=None,
    ) -> dict[str, Path]:
        """
        Run ensemble separation pipeline.

        1. Run each model on the input audio
        2. Collect stem results from all models
        3. Ensemble matching stems together
        4. Save final results

        Args:
            audio_path: Input audio file
            model_keys: List of model keys to use
            output_dir: Output directory for results
            method: Ensemble method
            weights: Weights for each model
            progress_callback: Optional callback(step, total, message)

        Returns:
            Dict mapping stem name -> output file path
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        all_stems: dict[str, list[np.ndarray]] = {}
        sr = 44100
        total_steps = len(model_keys) + 1  # +1 for ensemble step

        for i, model_key in enumerate(model_keys):
            if progress_callback:
                progress_callback(i, total_steps, f"Processing with {model_key}...")

            # Ensure model is downloaded
            if not self.model_manager.is_model_downloaded(model_key):
                self.model_manager.download_model(model_key)

            # Get model paths
            config_path, checkpoint_path = self.model_manager.get_local_paths(model_key)
            if not config_path or not checkpoint_path:
                logger.error(f"Model {model_key} files not found")
                continue

            # Get model info
            from .model_registry import get_model
            model_info = get_model(model_key)
            if not model_info:
                continue

            # Load model if not loaded
            if model_key not in self.separator.get_loaded_models():
                self.separator.load_model(
                    model_key,
                    str(config_path),
                    str(checkpoint_path),
                    model_info.model_type,
                )

            # Create temp dir for this model's output
            model_output_dir = output_dir / f"_temp_{model_key}"
            model_output_dir.mkdir(exist_ok=True)

            # Run separation
            stem_paths = self.separator.separate(
                model_key, audio_path, model_output_dir
            )

            # Collect stems with corresponding model weight
            model_weight = weights[i] if (weights and i < len(weights)) else 1.0
            for stem_name, stem_path in stem_paths.items():
                audio_data, sample_rate = sf.read(str(stem_path))
                sr = sample_rate
                if audio_data.ndim == 1:
                    audio_data = np.stack([audio_data, audio_data])
                elif audio_data.ndim == 2:
                    audio_data = audio_data.T  # (samples, channels) -> (channels, samples)

                if stem_name not in all_stems:
                    all_stems[stem_name] = []
                all_stems[stem_name].append((audio_data, model_weight))

            # Unload model to save GPU VRAM
            self.separator.unload_model(model_key)

        if progress_callback:
            progress_callback(len(model_keys), total_steps, "Ensembling results...")

        # Ensemble each stem
        input_name = Path(audio_path).stem
        final_outputs = {}

        for stem_name, stem_items in all_stems.items():
            stem_waveforms = [item[0] for item in stem_items]
            stem_weights = [item[1] for item in stem_items] if weights else None

            if len(stem_waveforms) == 1:
                ensembled = stem_waveforms[0]
            else:
                ensembled = ensemble_waveforms(stem_waveforms, method, stem_weights)

            # Prevent digital clipping with gentle peak normalization if needed
            max_val = np.max(np.abs(ensembled))
            if max_val > 0.999:
                ensembled = ensembled / max_val * 0.99
                logger.info(f"Normalized {stem_name} peak from {max_val:.3f} to 0.99")

            output_path = output_dir / f"{input_name}_{stem_name}_ensemble.wav"
            sf.write(str(output_path), ensembled.T, sr, subtype="FLOAT")
            final_outputs[stem_name] = output_path
            logger.info(f"Ensemble result: {stem_name} -> {output_path}")

        # Cleanup temp dirs
        import shutil
        for model_key in model_keys:
            temp_dir = output_dir / f"_temp_{model_key}"
            if temp_dir.exists():
                shutil.rmtree(temp_dir)

        if progress_callback:
            progress_callback(total_steps, total_steps, "Done!")

        return final_outputs
