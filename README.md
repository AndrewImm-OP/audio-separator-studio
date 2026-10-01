<div align="center">

# ⚡ Audio Separator Studio

**Next-Generation AI Audio Stem Separation & Multitrack Extraction Studio**

[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![PyTorch 2.x](https://img.shields.io/badge/PyTorch-2.x%20%7C%20CUDA%2012.4-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/React-19%20%7C%20TypeScript-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Electron](https://img.shields.io/badge/Electron-33+-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://electronjs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

*Professional desktop & web workstation for isolating vocals, drums, bass, and instruments using SOTA Roformer, Demucs, and SCNet neural networks with advanced ensemble blending.*

[English](#-key-features) • [Русский](#-описание-на-русском) • [Quick Start](#-quick-start) • [Model Benchmarks](#-supported-models--benchmarks) • [Architecture](#-architecture)

</div>

---

## 🌟 Key Features

- 🧠 **Cutting-Edge Deep Learning Models**: Full support for top-ranking models from the **Music Source Separation (MSST)** benchmarks:
  - **BS-Roformer (ViperX)** (SDR 12.97 dB) — World-class vocal isolation
  - **MelBand-Roformer (KimberleyJensen)** (SDR 10.98 dB) — Ultra-clean vocal extraction
  - **HTDemucs 4 & 6 Stems** (Facebook Research) — Fast multi-stem (vocals, drums, bass, guitar, piano, other)
  - **SCNet XL** — High-fidelity acoustic separation
  - **Specialized Denoise & DeReverb** — Studio vocal cleanup and room acoustic removal
  - **Apollo MP3 Restoration** — Artifact removal and frequency restoration

- 🎛️ **Intelligent Ensemble Blending**:
  - Combine multiple models simultaneously using advanced waveform or spectral (STFT) algorithms.
  - Algorithms: **Average (Waveform/FFT)**, **Median**, **Minimum (Artifact Suppression)**, **Maximum**.
  - Custom per-model weighting with automatic channel matching and peak normalization.

- 🎚️ **Interactive Studio Multitrack Mixer**:
  - **Synchronized Playback**: Listen to all extracted stems playing simultaneously in real-time.
  - **Solo (S) & Mute (M)**: Isolate individual instruments or vocals instantly.
  - **Interactive Waveforms**: Visual envelope playback tracking.
  - **A/B Reference Comparison**: Switch between original mix and processed stems with one click.
  - **Per-track and Master Volume Faders**.

- 🛡️ **Hardware & VRAM Safety Guard**:
  - Adaptive chunk processing with smooth Hann-window overlap-add reconstruction.
  - **Low VRAM Mode**: Tailored for GPUs with 4 GB to 6 GB VRAM (e.g. RTX 2050, GTX 1650) to prevent CUDA Out-of-Memory crashes.
  - Automatic CUDA cache management and CPU fallback recovery.

- 📦 **Professional Export Formats**:
  - **WAV 16-bit PCM** (Standard CD Quality)
  - **WAV 24-bit PCM** (High-Resolution Studio Quality)
  - **WAV 32-bit Float** (Full Dynamic Range)
  - **FLAC** (Lossless Compressed)
  - One-click **ZIP** archive download for all separated stems.

- 💻 **Flexible Deployment**:
  - Native **Electron Desktop App** (dark studio theme, custom titlebar, zero external dependencies).
  - Modern **Web Interface** (React 19 + Tailwind CSS + Framer Motion).
  - Headless **REST API + WebSockets** for remote servers, Docker, and automation pipelines.

---

## 📊 Supported Models & Benchmarks

| Model | Type | Stems | Target SDR | Description | Recommended For |
|---|---|---|---|---|---|
| **BS-Roformer (ViperX)** | `bs_roformer` | Vocals, Other | **12.97 dB** | Top MUSDB18 performer, pristine highs | Lead vocals, acapellas |
| **MelBand-Roformer (KJ)** | `mel_band_roformer` | Vocals, Other | **10.98 dB** | Mel-scale bands, minimal bleed | Complex vocal mixes |
| **MDX23C Vocals** | `mdx23c` | Vocals, Other | **10.17 dB** | TFC-TDF v3 architecture, very fast | Quick vocal removal, karaoke |
| **HTDemucs4 (4 stems)** | `htdemucs` | Bass, Drums, Vocals, Other | **11.76 dB** | Hybrid Transformer 4-stem | Full band stem extraction |
| **HTDemucs4 (6 stems)** | `htdemucs` | Bass, Drums, Vocals, Other, Piano, Guitar | **11.22 dB** | 6-stem arrangement separation | Complex arrangements, guitar/piano |
| **SCNet XL IHF** | `scnet` | Bass, Drums, Vocals, Other | **11.94 dB** | Sparse Compression Network | Clean bass & rhythm separation |
| **MelBand Denoise (aufr33)** | `mel_band_roformer` | Clean, Noise | **27.99 dB** | Background noise & hiss suppression | Podcast, voiceover, vintage audio |
| **DeReverb MelBand** | `mel_band_roformer` | Dry, Reverb | **19.17 dB** | Room echo & reverb removal | Dry vocal recording prep |
| **Apollo MP3 Restoration** | `apollo` | Restored | — | High frequency audio reconstruction | Low-bitrate MP3 / stream restoration |

---

## 🚀 Quick Start

### Prerequisites
- **Python 3.10 or 3.11** (Python 3.11 recommended)
- **Node.js 18+** & **npm**
- **FFmpeg** installed on your system (`sudo apt install ffmpeg` / `brew install ffmpeg` / `choco install ffmpeg`)
- *(Optional)* NVIDIA GPU with CUDA 12.x support for accelerated processing.

### 1-Click Launch (Recommended)

```bash
# Clone the repository
git clone https://github.com/AndrewImm-OP/audio-separator-studio.git
cd audio-separator-studio

# Start everything (auto-installs dependencies and launches Electron desktop app)
chmod +x start.sh
./start.sh
```

### Manual Setup

#### 1. Backend (FastAPI + PyTorch)
```bash
cd backend
bash setup.sh

# Or manually:
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
pip install bs-roformer

# Run API server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at: `http://localhost:8000/docs`

#### 2. Frontend (React + Electron)
```bash
cd frontend/audio-separator-ui
npm install --no-bin-links
bash setup-bin.sh

# Run Desktop App in development:
npm run dev

# Or build production desktop package:
npm run build
```

#### 3. Docker Compose (Headless Server)
```bash
docker-compose up --build
```
Web interface will be accessible at `http://localhost:3000` and API at `http://localhost:8000`.

---

## 🛠️ Architecture

```
audio-separator-studio/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI REST endpoints & WebSocket server
│   │   ├── separator.py         # Neural inference engine (chunking, windowing, VRAM safety)
│   │   ├── ensemble.py          # Multi-model blending (waveform & STFT spectral domains)
│   │   ├── model_registry.py    # Model catalog, download links & benchmark metadata
│   │   ├── model_manager.py     # Download, caching & local model management
│   │   └── models_fallback.py   # Standalone architecture fallback loaders
│   ├── msst/                    # Music-Source-Separation-Training submodule
│   ├── requirements.txt         # Backend Python dependencies
│   ├── setup.sh                 # Intelligent venv setup script
│   └── Dockerfile               # GPU-enabled container definition
├── frontend/
│   └── audio-separator-ui/
│       ├── electron/            # Electron main & preload scripts
│       ├── src/
│       │   ├── components/      # UI: Header, ModelSelector, ResultsView, FileUpload, etc.
│       │   ├── api/client.ts    # REST & WebSocket client with Electron/Web auto-detection
│       │   ├── hooks/           # Real-time WebSocket job tracking hooks
│       │   └── types/           # TypeScript interfaces
│       ├── package.json
│       ├── vite.config.ts
│       └── Dockerfile
├── docker-compose.yml           # Multi-container orchestration
├── start.sh                     # Unified cross-platform startup script
└── README.md
```

---

## 🇷🇺 Описание на русском

**Audio Separator Studio** — профессиональная студия для разделения аудио на изолированные дорожки (вокал, инструментал, бас, ударные, гитара, фортепиано и др.) на базе нейросетей последнего поколения.

### Преимущества:
1. **Топовое качество разделения**: интеграция архитектур **BS-Roformer**, **MelBand-Roformer**, **HTDemucs** и **SCNet** с рекордными показателями метрики SDR (до 12.97 dB).
2. **Ансамблирование моделей**: возможность объединять результаты нескольких нейросетей одновременно (усреднение, медиана, спектральное STFT-сведение) с гибкой настройкой весов.
3. **Мультитрековый студийный плеер**:
   - Синхронное воспроизведение всех стемов в реальном времени.
   - Кнопки **Solo (S)** и **Mute (M)** для изоляции любого инструмента на лету.
   - Интерактивная волна трека и мгновенное **A/B сравнение** с оригинальным миксом.
   - Скачивание как отдельных дорожек, так и полного ZIP-архива.
4. **Адаптация под видеокарты с 4–6 ГБ VRAM**: безопасная обработка чанками с окном Ханна, автоматическая очистка кэша CUDA и режим Low VRAM, предотвращающий падения по Out of Memory на картах уровня RTX 2050 / GTX 1650.
5. **Выбор формата**: экспорт в WAV 16-бит (CD), 24-бит (Студия), 32-бит Float и FLAC.
6. **Удобный запуск**: настольное приложение на Electron или запуск через браузер/Docker.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
Trained model weights and architectures are subject to their respective upstream licenses (Music-Source-Separation-Training / ZFTurbo / Meta Demucs / Lucidrains).
