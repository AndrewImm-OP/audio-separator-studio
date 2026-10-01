"""
Registry of supported audio separation models with their configs and download URLs.
Based on ZFTurbo/Music-Source-Separation-Training pretrained models.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ModelInfo:
    """Metadata for a separation model."""
    key: str
    name: str
    model_type: str
    stems: list[str]
    config_url: str
    checkpoint_url: str
    sdr_metrics: dict[str, float] = field(default_factory=dict)
    description: str = ""
    size_mb: int = 0
    is_downloaded: bool = False
    local_config_path: Optional[str] = None
    local_checkpoint_path: Optional[str] = None


# ─── Best vocal separation models ────────────────────────────────────────────

VOCAL_MODELS: dict[str, ModelInfo] = {
    "bs_roformer_viperx": ModelInfo(
        key="bs_roformer_viperx",
        name="BS-Roformer (ViperX)",
        model_type="bs_roformer",
        stems=["vocals", "other"],
        config_url="https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/configs/viperx/model_bs_roformer_ep_317_sdr_12.9755.yaml",
        checkpoint_url="https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/model_bs_roformer_ep_317_sdr_12.9755.ckpt",
        sdr_metrics={"vocals": 10.87},
        description="Top BS-Roformer vocal model by ViperX. SDR 12.97 on MUSDB, 10.87 on Multisong.",
        size_mb=735,
    ),
    "mel_band_roformer_kj": ModelInfo(
        key="mel_band_roformer_kj",
        name="MelBand-Roformer (KimberleyJensen)",
        model_type="mel_band_roformer",
        stems=["vocals", "other"],
        config_url="https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/configs/KimberleyJensen/config_vocals_mel_band_roformer_kj.yaml",
        checkpoint_url="https://huggingface.co/KimberleyJSN/melbandroformer/resolve/main/MelBandRoformer.ckpt",
        sdr_metrics={"vocals": 10.98},
        description="Best MelBand-Roformer vocal model. SDR 10.98 on Multisong.",
        size_mb=600,
    ),
    "mel_band_roformer_viperx": ModelInfo(
        key="mel_band_roformer_viperx",
        name="MelBand-Roformer (ViperX)",
        model_type="mel_band_roformer",
        stems=["vocals", "other"],
        config_url="https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/configs/viperx/model_mel_band_roformer_ep_3005_sdr_11.4360.yaml",
        checkpoint_url="https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/model_mel_band_roformer_ep_3005_sdr_11.4360.ckpt",
        sdr_metrics={"vocals": 9.67},
        description="MelBand-Roformer vocal model by ViperX. Solid performer.",
        size_mb=500,
    ),
    "mdx23c_vocals": ModelInfo(
        key="mdx23c_vocals",
        name="MDX23C Vocals",
        model_type="mdx23c",
        stems=["vocals", "other"],
        config_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v1.0.0/config_vocals_mdx23c.yaml",
        checkpoint_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v1.0.0/model_vocals_mdx23c_sdr_10.17.ckpt",
        sdr_metrics={"vocals": 10.17},
        description="MDX23C vocal separation. Good balance of speed and quality.",
        size_mb=250,
    ),
    "bs_polarformer": ModelInfo(
        key="bs_polarformer",
        name="BS-PolarFormer",
        model_type="bs_roformer",  # uses same architecture family
        stems=["vocals", "other"],
        config_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v1.0.20/model_bs_polarformer_float16.yaml",
        checkpoint_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v1.0.20/model_bs_polarformer_float16.ckpt",
        sdr_metrics={"vocals": 11.00},
        description="BS-PolarFormer vocal model. SDR 11.00 on Multisong.",
        size_mb=400,
    ),
    "bs_roformer_karaoke": ModelInfo(
        key="bs_roformer_karaoke",
        name="BS-Roformer Karaoke (Lead & Backing)",
        model_type="bs_roformer",
        stems=["lead_vocals", "backing_vocals"],
        config_url="https://huggingface.co/becruily/bs-roformer-karaoke/raw/main/config_karaoke_frazer_becruily.yaml",
        checkpoint_url="https://huggingface.co/becruily/bs-roformer-karaoke/resolve/main/bs_roformer_karaoke_frazer_becruily.ckpt",
        sdr_metrics={"lead_vocals": 11.20},
        description="Top SOTA модель для разделения Лид-вокала (Lead) и Бэк-вокала (Backing/Harmonies).",
        size_mb=204,
    ),
    "mel_band_roformer_karaoke": ModelInfo(
        key="mel_band_roformer_karaoke",
        name="MelBand-Roformer Karaoke (Lead & Backing)",
        model_type="mel_band_roformer",
        stems=["lead_vocals", "backing_vocals"],
        config_url="https://huggingface.co/becruily/mel-band-roformer-karaoke/raw/main/config_karaoke_becruily.yaml",
        checkpoint_url="https://huggingface.co/becruily/mel-band-roformer-karaoke/resolve/main/mel_band_roformer_karaoke_becruily.ckpt",
        sdr_metrics={"lead_vocals": 10.95},
        description="MelBand-Roformer модель для глубокого извлечения бэков и эхо.",
        size_mb=600,
    ),
}

# ─── Multi-stem models ────────────────────────────────────────────────────────

MULTISTEM_MODELS: dict[str, ModelInfo] = {
    "htdemucs4": ModelInfo(
        key="htdemucs4",
        name="HTDemucs4 (4 stems)",
        model_type="htdemucs",
        stems=["bass", "drums", "vocals", "other"],
        config_url="https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/configs/config_musdb18_htdemucs.yaml",
        checkpoint_url="https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/955717e8-8726e21a.th",
        sdr_metrics={"bass": 11.76, "drums": 10.88, "vocals": 8.24, "other": 5.74},
        description="Facebook's HTDemucs4. Fast 4-stem separation.",
        size_mb=320,
    ),
    "htdemucs4_6stems": ModelInfo(
        key="htdemucs4_6stems",
        name="HTDemucs4 (6 stems)",
        model_type="htdemucs",
        stems=["bass", "drums", "vocals", "other", "piano", "guitar"],
        config_url="https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/configs/config_htdemucs_6stems.yaml",
        checkpoint_url="https://dl.fbaipublicfiles.com/demucs/hybrid_transformer/5c90dfd2-34c22ccb.th",
        sdr_metrics={"bass": 11.22, "drums": 10.22, "vocals": 8.05},
        description="6-stem separation: bass, drums, vocals, other, piano, guitar.",
        size_mb=350,
    ),
    "scnet_xl_ihf": ModelInfo(
        key="scnet_xl_ihf",
        name="SCNet XL IHF (4 stems)",
        model_type="scnet",
        stems=["bass", "drums", "vocals", "other"],
        config_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v1.0.15/config_musdb18_scnet_xl_more_wide_v5.yaml",
        checkpoint_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v1.0.15/model_scnet_ep_36_sdr_10.0891.ckpt",
        sdr_metrics={"bass": 11.94, "drums": 11.58, "vocals": 9.68, "other": 6.48},
        description="Best SCNet model. MUSDB SDR avg: 10.08. Great multi-stem option.",
        size_mb=450,
    ),
    "bs_roformer_4stems": ModelInfo(
        key="bs_roformer_4stems",
        name="BS-Roformer (4 stems, MUSDB18)",
        model_type="bs_roformer",
        stems=["bass", "drums", "vocals", "other"],
        config_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v1.0.12/config_bs_roformer_384_8_2_485100.yaml",
        checkpoint_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v1.0.12/model_bs_roformer_ep_17_sdr_9.6568.ckpt",
        sdr_metrics={"bass": 11.08, "drums": 11.29, "vocals": 9.19, "other": 5.96},
        description="BS-Roformer 4-stem model. High quality multi-stem separation.",
        size_mb=500,
    ),
}

# ─── Specialized models ──────────────────────────────────────────────────────

SPECIALIZED_MODELS: dict[str, ModelInfo] = {
    "bs_roformer_other": ModelInfo(
        key="bs_roformer_other",
        name="BS-Roformer Other (ViperX)",
        model_type="bs_roformer",
        stems=["other", "vocals"],
        config_url="https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/configs/viperx/model_bs_roformer_ep_937_sdr_10.5309.yaml",
        checkpoint_url="https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/model_bs_roformer_ep_937_sdr_10.5309.ckpt",
        sdr_metrics={"other": 6.85},
        description="BS-Roformer specialized for 'other' stem extraction.",
        size_mb=500,
    ),
    "mel_band_roformer_denoise": ModelInfo(
        key="mel_band_roformer_denoise",
        name="MelBand-Roformer Denoise",
        model_type="mel_band_roformer",
        stems=["clean", "noise"],
        config_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v.1.0.7/model_mel_band_roformer_denoise.yaml",
        checkpoint_url="https://github.com/ZFTurbo/Music-Source-Separation-Training/releases/download/v.1.0.7/denoise_mel_band_roformer_aufr33_sdr_27.9959.ckpt",
        sdr_metrics={"denoise": 27.99},
        description="Denoising model by aufr33. SDR 27.99.",
        size_mb=400,
    ),
    "dereverb_mel_band_roformer": ModelInfo(
        key="dereverb_mel_band_roformer",
        name="MelBand-Roformer DeReverb",
        model_type="mel_band_roformer",
        stems=["dry", "reverb"],
        config_url="https://huggingface.co/anvuew/dereverb_mel_band_roformer/resolve/main/dereverb_mel_band_roformer_anvuew.yaml",
        checkpoint_url="https://huggingface.co/anvuew/dereverb_mel_band_roformer/resolve/main/dereverb_mel_band_roformer_anvuew_sdr_19.1729.ckpt",
        sdr_metrics={"dereverb": 19.17},
        description="De-reverb model by anvuew. SDR 19.17.",
        size_mb=400,
    ),
    "apollo_mp3_restore": ModelInfo(
        key="apollo_mp3_restore",
        name="Apollo MP3 Restoration",
        model_type="apollo",
        stems=["restored"],
        config_url="https://raw.githubusercontent.com/ZFTurbo/Music-Source-Separation-Training/main/configs/config_apollo.yaml",
        checkpoint_url="https://huggingface.co/JusperLee/Apollo/resolve/main/pytorch_model.bin",
        sdr_metrics={},
        description="Apollo model for restoring low-quality MP3 audio.",
        size_mb=300,
    ),
}


def get_all_models() -> dict[str, ModelInfo]:
    """Return all available models merged into a single dict."""
    return {**VOCAL_MODELS, **MULTISTEM_MODELS, **SPECIALIZED_MODELS}


def get_models_by_category() -> dict[str, dict[str, ModelInfo]]:
    """Return models grouped by category."""
    return {
        "vocal": VOCAL_MODELS,
        "multi_stem": MULTISTEM_MODELS,
        "specialized": SPECIALIZED_MODELS,
    }


def get_model(key: str) -> ModelInfo | None:
    """Get a model by its key."""
    return get_all_models().get(key)
