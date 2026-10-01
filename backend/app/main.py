"""
FastAPI backend for Audio Separator.
Provides REST API + WebSocket for real-time progress updates.
"""

import asyncio
import json
import logging
import os
import shutil
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .ensemble import EnsembleMethod, EnsemblePipeline
from .model_manager import ModelManager
from .model_registry import get_all_models, get_models_by_category, get_model
from .separator import SeparationEngine

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── App Configuration ────────────────────────────────────────────────────────
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/tmp/audio-separator/uploads"))
OUTPUT_DIR = Path(os.environ.get("OUTPUT_DIR", "/tmp/audio-separator/outputs"))
MSST_PATH = os.environ.get("MSST_PATH", "")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Initialize core components ──────────────────────────────────────────────
model_manager = ModelManager()
separator = SeparationEngine(msst_path=MSST_PATH)
ensemble_pipeline = EnsemblePipeline(separator, model_manager)

# ─── Track active jobs ────────────────────────────────────────────────────────
active_jobs: dict[str, dict] = {}
connected_websockets: dict[str, WebSocket] = {}

# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Audio Separator",
    description="AI-powered audio stem separation with ensemble support",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    import torch
    return {
        "status": "ok",
        "cuda_available": torch.cuda.is_available(),
        "cuda_device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
        "loaded_models": separator.get_loaded_models(),
    }


# ─── Models ───────────────────────────────────────────────────────────────────

@app.get("/api/models")
async def list_models():
    """List all available models with download status."""
    status = model_manager.get_download_status()
    categories = get_models_by_category()
    return {
        "models": status,
        "categories": {
            cat: list(models.keys()) for cat, models in categories.items()
        },
    }


@app.get("/api/models/{model_key}")
async def get_model_info(model_key: str):
    """Get detailed info about a specific model."""
    info = get_model(model_key)
    if not info:
        raise HTTPException(404, f"Model '{model_key}' not found")
    is_downloaded = model_manager.is_model_downloaded(model_key)
    return {
        "key": info.key,
        "name": info.name,
        "model_type": info.model_type,
        "stems": info.stems,
        "sdr_metrics": info.sdr_metrics,
        "description": info.description,
        "size_mb": info.size_mb,
        "is_downloaded": is_downloaded,
    }


@app.post("/api/models/{model_key}/download")
async def download_model(model_key: str):
    """Download a model's config and checkpoint."""
    info = get_model(model_key)
    if not info:
        raise HTTPException(404, f"Model '{model_key}' not found")

    if model_manager.is_model_downloaded(model_key):
        return {"status": "already_downloaded", "model_key": model_key}

    try:
        config_path, checkpoint_path = await model_manager.download_model_async(model_key)
        return {
            "status": "downloaded",
            "model_key": model_key,
            "config_path": str(config_path),
            "checkpoint_path": str(checkpoint_path),
        }
    except Exception as e:
        raise HTTPException(500, f"Download failed: {str(e)}")


@app.delete("/api/models/{model_key}")
async def delete_model(model_key: str):
    """Delete a downloaded model."""
    if model_manager.delete_model(model_key):
        return {"status": "deleted", "model_key": model_key}
    raise HTTPException(404, f"Model '{model_key}' not found or not downloaded")


# ─── Separation ───────────────────────────────────────────────────────────────

@app.post("/api/separate")
async def separate_audio(
    file: UploadFile = File(...),
    model_key: str = Form(...),
    overlap: float = Form(0.25),
    chunk_size: int = Form(485100),
    output_format: str = Form("wav_16"),
    low_vram: bool = Form(False),
):
    """
    Separate audio into stems using a single model.
    Returns job_id for tracking progress.
    """
    # Validate model
    info = get_model(model_key)
    if not info:
        raise HTTPException(404, f"Model '{model_key}' not found")

    # Save uploaded file
    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    input_path = job_dir / file.filename
    with open(input_path, "wb") as f:
        content = await file.read()
        f.write(content)

    output_dir = OUTPUT_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    # Track job
    active_jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "model_key": model_key,
        "input_file": file.filename,
        "input_path": str(input_path),
        "output_format": output_format,
        "low_vram": low_vram,
        "progress": 0,
        "message": "Queued",
        "output_files": {},
    }

    # Run separation in background
    asyncio.create_task(
        _run_separation(
            job_id, model_key, str(input_path), str(output_dir), overlap, chunk_size, output_format, low_vram
        )
    )

    return {"job_id": job_id, "status": "queued"}


async def _run_separation(
    job_id: str,
    model_key: str,
    input_path: str,
    output_dir: str,
    overlap: float,
    chunk_size: int,
    output_format: str = "wav_16",
    low_vram: bool = False,
):
    """Background task for running separation."""
    try:
        active_jobs[job_id]["status"] = "downloading_model"
        active_jobs[job_id]["message"] = "Downloading model..."
        await _notify_ws(job_id)

        # Ensure model is downloaded
        if not model_manager.is_model_downloaded(model_key):
            await model_manager.download_model_async(model_key)

        config_path, checkpoint_path = model_manager.get_local_paths(model_key)
        model_info = get_model(model_key)

        active_jobs[job_id]["status"] = "loading_model"
        active_jobs[job_id]["message"] = "Loading model into memory..."
        active_jobs[job_id]["progress"] = 10
        await _notify_ws(job_id)

        # Load model
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            separator.load_model,
            model_key,
            str(config_path),
            str(checkpoint_path),
            model_info.model_type,
        )

        active_jobs[job_id]["status"] = "processing"
        active_jobs[job_id]["message"] = "Starting audio separation..."
        active_jobs[job_id]["progress"] = 25
        await _notify_ws(job_id)

        def progress_cb(pct: int, msg: str):
            active_jobs[job_id]["progress"] = pct
            active_jobs[job_id]["message"] = msg
            asyncio.run_coroutine_threadsafe(_notify_ws(job_id), loop)

        # Run separation
        stem_paths = await loop.run_in_executor(
            None,
            lambda: separator.separate(
                model_key,
                input_path,
                output_dir,
                overlap=overlap,
                chunk_size=chunk_size,
                output_format=output_format,
                progress_callback=progress_cb,
                low_vram=low_vram,
            ),
        )

        active_jobs[job_id]["status"] = "completed"
        active_jobs[job_id]["message"] = "Separation complete!"
        active_jobs[job_id]["progress"] = 100
        active_jobs[job_id]["output_files"] = {
            name: str(path) for name, path in stem_paths.items()
        }
        await _notify_ws(job_id)

    except Exception as e:
        logger.error(f"Separation failed for job {job_id}: {e}", exc_info=True)
        active_jobs[job_id]["status"] = "error"
        active_jobs[job_id]["message"] = str(e)
        await _notify_ws(job_id)


# ─── Ensemble Separation ─────────────────────────────────────────────────────

@app.post("/api/ensemble")
async def ensemble_separate(
    file: UploadFile = File(...),
    model_keys: str = Form(...),  # JSON array of model keys
    method: str = Form("avg_wave"),
    weights: Optional[str] = Form(None),  # JSON array of floats
):
    """
    Run ensemble separation with multiple models.
    """
    try:
        keys_list = json.loads(model_keys)
    except json.JSONDecodeError:
        raise HTTPException(400, "model_keys must be a JSON array")

    if len(keys_list) < 2:
        raise HTTPException(400, "Ensemble requires at least 2 models")

    # Validate models
    for key in keys_list:
        if not get_model(key):
            raise HTTPException(404, f"Model '{key}' not found")

    # Parse weights
    weights_list = None
    if weights:
        try:
            weights_list = json.loads(weights)
        except json.JSONDecodeError:
            raise HTTPException(400, "weights must be a JSON array of floats")

    # Parse method
    try:
        ensemble_method = EnsembleMethod(method)
    except ValueError:
        raise HTTPException(400, f"Invalid ensemble method: {method}")

    # Save uploaded file
    job_id = str(uuid.uuid4())
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    input_path = job_dir / file.filename
    with open(input_path, "wb") as f:
        content = await file.read()
        f.write(content)

    output_dir = OUTPUT_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    active_jobs[job_id] = {
        "id": job_id,
        "status": "queued",
        "model_keys": keys_list,
        "method": method,
        "input_file": file.filename,
        "input_path": str(input_path),
        "progress": 0,
        "message": "Queued",
        "output_files": {},
    }

    asyncio.create_task(
        _run_ensemble(job_id, str(input_path), str(output_dir), keys_list, ensemble_method, weights_list)
    )

    return {"job_id": job_id, "status": "queued"}


async def _run_ensemble(
    job_id: str,
    input_path: str,
    output_dir: str,
    model_keys: list[str],
    method: EnsembleMethod,
    weights: Optional[list[float]],
):
    """Background task for ensemble separation."""
    try:
        loop = asyncio.get_event_loop()

        def progress_callback(step, total, message):
            progress = int((step / total) * 100)
            active_jobs[job_id]["progress"] = progress
            active_jobs[job_id]["message"] = message
            active_jobs[job_id]["status"] = "processing"
            asyncio.run_coroutine_threadsafe(_notify_ws(job_id), loop)

        active_jobs[job_id]["status"] = "processing"
        active_jobs[job_id]["message"] = "Starting ensemble pipeline..."
        await _notify_ws(job_id)

        stem_paths = await loop.run_in_executor(
            None,
            ensemble_pipeline.run_ensemble,
            input_path,
            model_keys,
            output_dir,
            method,
            weights,
            progress_callback,
        )

        active_jobs[job_id]["status"] = "completed"
        active_jobs[job_id]["message"] = "Ensemble separation complete!"
        active_jobs[job_id]["progress"] = 100
        active_jobs[job_id]["output_files"] = {
            name: str(path) for name, path in stem_paths.items()
        }
        await _notify_ws(job_id)

    except Exception as e:
        logger.error(f"Ensemble failed for job {job_id}: {e}", exc_info=True)
        active_jobs[job_id]["status"] = "error"
        active_jobs[job_id]["message"] = str(e)
        await _notify_ws(job_id)


# ─── Job Status & Downloads ──────────────────────────────────────────────────

@app.get("/api/jobs/{job_id}")
async def get_job_status(job_id: str):
    """Get the status of a separation job."""
    if job_id not in active_jobs:
        raise HTTPException(404, "Job not found")
    return active_jobs[job_id]


@app.get("/api/jobs/{job_id}/original")
async def get_original_audio(job_id: str):
    """Stream the original input audio for A/B comparison."""
    if job_id not in active_jobs:
        raise HTTPException(404, "Job not found")

    job = active_jobs[job_id]
    input_path = job.get("input_path")
    if not input_path or not Path(input_path).exists():
        raise HTTPException(404, "Original audio file not found")

    file_path = Path(input_path)
    suffix = file_path.suffix.lower()
    media_map = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
    }
    return FileResponse(
        str(file_path),
        media_type=media_map.get(suffix, "audio/wav"),
        filename=file_path.name,
    )


@app.post("/api/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running job."""
    if job_id not in active_jobs:
        raise HTTPException(404, "Job not found")
    job = active_jobs[job_id]
    if job["status"] in ("queued", "processing", "loading_model", "downloading_model"):
        job["status"] = "error"
        job["message"] = "Job cancelled by user"
        await _notify_ws(job_id)
        return {"status": "cancelled"}
    return {"status": job["status"]}


@app.get("/api/jobs/{job_id}/download/{stem_name}")
async def download_stem(job_id: str, stem_name: str):
    """Download a separated stem file."""
    if job_id not in active_jobs:
        raise HTTPException(404, "Job not found")

    job = active_jobs[job_id]
    if job["status"] != "completed":
        raise HTTPException(400, "Job not completed yet")

    output_files = job.get("output_files", {})
    if stem_name not in output_files:
        raise HTTPException(404, f"Stem '{stem_name}' not found")

    file_path = Path(output_files[stem_name])
    if not file_path.exists():
        raise HTTPException(404, "File not found on disk")

    media_type = "audio/flac" if file_path.suffix.lower() == ".flac" else "audio/wav"
    return FileResponse(
        str(file_path),
        media_type=media_type,
        filename=file_path.name,
    )


@app.get("/api/jobs/{job_id}/download-all")
async def download_all_stems(job_id: str):
    """Download all stems as a zip file."""
    if job_id not in active_jobs:
        raise HTTPException(404, "Job not found")

    job = active_jobs[job_id]
    if job["status"] != "completed":
        raise HTTPException(400, "Job not completed yet")

    output_files = job.get("output_files", {})
    if not output_files:
        raise HTTPException(404, "No output files")

    # Create zip
    zip_path = Path(OUTPUT_DIR) / job_id / "stems.zip"
    import zipfile
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for stem_name, file_path in output_files.items():
            zf.write(file_path, Path(file_path).name)

    return FileResponse(
        str(zip_path),
        media_type="application/zip",
        filename=f"{Path(job.get('input_file', 'stems')).stem}_separated.zip",
    )


@app.delete("/api/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a job and its files."""
    if job_id in active_jobs:
        del active_jobs[job_id]

    # Clean up files
    for base_dir in [UPLOAD_DIR, OUTPUT_DIR]:
        job_dir = base_dir / job_id
        if job_dir.exists():
            shutil.rmtree(job_dir)

    return {"status": "deleted"}


# ─── Ensemble Methods Info ────────────────────────────────────────────────────

@app.get("/api/ensemble-methods")
async def list_ensemble_methods():
    """List available ensemble methods with descriptions."""
    return {
        "methods": [
            {
                "key": "avg_wave",
                "name": "Average (Waveform)",
                "description": "Average waveforms sample by sample. Best overall quality, recommended default.",
                "domain": "waveform",
            },
            {
                "key": "median_wave",
                "name": "Median (Waveform)",
                "description": "Median of waveforms. Good for 3+ models, reduces outliers.",
                "domain": "waveform",
            },
            {
                "key": "min_wave",
                "name": "Minimum (Waveform)",
                "description": "Picks minimum absolute value. Conservative, reduces artifacts.",
                "domain": "waveform",
            },
            {
                "key": "max_wave",
                "name": "Maximum (Waveform)",
                "description": "Picks maximum absolute value. Most aggressive.",
                "domain": "waveform",
            },
            {
                "key": "avg_fft",
                "name": "Average (Spectral)",
                "description": "Average in STFT domain. Preserves spectral balance.",
                "domain": "spectral",
            },
            {
                "key": "median_fft",
                "name": "Median (Spectral)",
                "description": "Median in STFT domain. Good for 3+ models.",
                "domain": "spectral",
            },
            {
                "key": "min_fft",
                "name": "Minimum (Spectral)",
                "description": "Minimum magnitude in STFT. Reduces aggressiveness.",
                "domain": "spectral",
            },
            {
                "key": "max_fft",
                "name": "Maximum (Spectral)",
                "description": "Maximum magnitude in STFT. Most aggressive spectral method.",
                "domain": "spectral",
            },
        ]
    }


# ─── WebSocket for real-time updates ─────────────────────────────────────────

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time job updates."""
    await websocket.accept()
    connected_websockets[client_id] = websocket
    logger.info(f"WebSocket connected: {client_id}")

    try:
        while True:
            data = await websocket.receive_text()
            # Client can request job status via WebSocket
            try:
                msg = json.loads(data)
                if msg.get("type") == "subscribe_job":
                    job_id = msg.get("job_id")
                    if job_id in active_jobs:
                        await websocket.send_json(active_jobs[job_id])
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {client_id}")
        connected_websockets.pop(client_id, None)


async def _notify_ws(job_id: str):
    """Notify all connected WebSocket clients about job update."""
    if job_id not in active_jobs:
        return

    job_data = active_jobs[job_id]
    dead_clients = []

    for client_id, ws in connected_websockets.items():
        try:
            await ws.send_json({"type": "job_update", "job": job_data})
        except Exception:
            dead_clients.append(client_id)

    for client_id in dead_clients:
        connected_websockets.pop(client_id, None)


# ─── Serve frontend (production) ─────────────────────────────────────────────

FRONTEND_BUILD = Path(__file__).parent.parent.parent / "frontend" / "dist"
if FRONTEND_BUILD.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_BUILD), html=True), name="frontend")
