import { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import {
  Layers,
  AudioLines,
  Zap,
  Sliders,
  Cpu,
  Volume2,
  ExternalLink,
} from 'lucide-react';

import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ModelSelector } from './components/ModelSelector';
import { EnsembleConfig } from './components/EnsembleConfig';
import { ProcessingView } from './components/ProcessingView';
import { ResultsView } from './components/ResultsView';
import { BackendSplash } from './components/BackendSplash';
import { useWebSocket } from './hooks/useWebSocket';
import * as api from './api/client';
import type { ModelInfo, EnsembleMethodInfo, Job, HealthResponse, SeparationMode } from './types';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [models, setModels] = useState<Record<string, ModelInfo>>({});
  const [categories, setCategories] = useState<Record<string, string[]>>({});
  const [ensembleMethods, setEnsembleMethods] = useState<EnsembleMethodInfo[]>([]);
  const [mode, setMode] = useState<SeparationMode>('single');
  const [file, setFile] = useState<File | null>(null);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [ensembleMethod, setEnsembleMethod] = useState('avg_wave');
  const [modelWeights, setModelWeights] = useState<Record<string, number>>({});
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(new Set());
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [backendStatus, setBackendStatus] = useState<any>(null);
  const { connected: wsConnected, lastJobUpdate } = useWebSocket();

  // Audio parameters
  const [outputFormat, setOutputFormat] = useState('wav_16');
  const [overlap, setOverlap] = useState(0.25);
  const [lowVram, setLowVram] = useState(false);

  // Backend status (Electron)
  useEffect(() => {
    if (!window.electronAPI) {
      setBackendReady(true);
      return;
    }

    // Listen for push updates from main process
    window.electronAPI.onBackendStatus((s: any) => {
      setBackendStatus(s);
      if (s.running) setBackendReady(true);
    });

    // Also actively poll in case listener registered after process spawn
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const pollBackendStatus = async () => {
      try {
        const status = await window.electronAPI!.getBackendStatus();
        if (status.running) {
          setBackendReady(true);
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        }
      } catch {
        /* ignore */
      }
    };
    pollBackendStatus();
    pollInterval = setInterval(pollBackendStatus, 1000);

    return () => {
      window.electronAPI?.removeAllListeners('backend-status');
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  // Data loading
  useEffect(() => {
    if (!backendReady) return;
    (async () => {
      try {
        const [h, m, e] = await Promise.all([
          api.getHealth().catch(() => null),
          api.getModels().catch(() => ({ models: {}, categories: {} })),
          api.getEnsembleMethods().catch(() => ({ methods: [] })),
        ]);
        if (h) setHealth(h);
        setModels(m.models);
        setCategories(m.categories);
        setEnsembleMethods(e.methods);

        // Pre-select first available vocal model if none selected
        const vocalCategory = (m.categories as Record<string, string[]>)?.vocal;
        if (vocalCategory && vocalCategory.length > 0) {
          setSelectedModels([vocalCategory[0]]);
        }
      } catch (err) {
        console.error('Initial data load failed:', err);
      }
    })();
  }, [backendReady]);

  // WebSocket job status updates
  useEffect(() => {
    if (lastJobUpdate && currentJob && lastJobUpdate.id === currentJob.id) {
      setCurrentJob(lastJobUpdate);
      if (lastJobUpdate.status === 'completed') {
        toast.success('Audio separation complete!');
      } else if (lastJobUpdate.status === 'error') {
        toast.error(`Separation error: ${lastJobUpdate.message}`);
      }
    }
  }, [lastJobUpdate, currentJob]);

  const handleToggleModel = useCallback(
    (key: string) => {
      setSelectedModels((prev) => {
        if (mode === 'single') {
          return prev.includes(key) ? [] : [key];
        } else {
          return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
        }
      });
    },
    [mode],
  );

  const handleDownloadModel = useCallback(
    async (key: string) => {
      setDownloadingModels((p) => new Set(p).add(key));
      try {
        await api.downloadModel(key);
        const d = await api.getModels();
        setModels(d.models);
        toast.success(`Downloaded: ${models[key]?.name || key}`);
      } catch (e: any) {
        toast.error(`Download failed: ${e.message}`);
      } finally {
        setDownloadingModels((p) => {
          const n = new Set(p);
          n.delete(key);
          return n;
        });
      }
    },
    [models],
  );

  const handleDeleteModel = useCallback(async (key: string) => {
    try {
      await api.deleteModel(key);
      const d = await api.getModels();
      setModels(d.models);
      setSelectedModels((p) => p.filter((k) => k !== key));
      toast.success('Model deleted from local cache');
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  }, []);

  const handleWeightChange = useCallback((k: string, w: number) => {
    setModelWeights((p) => ({ ...p, [k]: w }));
  }, []);

  const handleCancelJob = useCallback(async () => {
    if (currentJob?.id) {
      try {
        await api.cancelJob(currentJob.id);
        toast.success('Separation cancelled');
      } catch {
        /* ignore */
      }
    }
    setCurrentJob(null);
  }, [currentJob]);

  const pollJob = useCallback(async (id: string) => {
    const go = async () => {
      try {
        const j = await api.getJobStatus(id);
        setCurrentJob(j);
        if (j.status !== 'completed' && j.status !== 'error') {
          setTimeout(go, 1500);
        }
      } catch {
        setTimeout(go, 2500);
      }
    };
    go();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!file) {
      toast.error('Please load an audio file first');
      return;
    }
    if (selectedModels.length === 0) {
      toast.error('Please select at least one separation model');
      return;
    }
    if (mode === 'ensemble' && selectedModels.length < 2) {
      toast.error('Ensemble blending requires at least 2 models');
      return;
    }

    setIsSubmitting(true);
    try {
      const r =
        mode === 'single'
          ? await api.separateAudio(file, selectedModels[0], overlap, 485100, outputFormat, lowVram)
          : await api.ensembleSeparate(
              file,
              selectedModels,
              ensembleMethod,
              selectedModels.map((k) => modelWeights[k] ?? 1.0),
            );

      setCurrentJob({
        id: r.job_id,
        status: 'queued',
        input_file: file.name,
        progress: 0,
        message: 'Initializing AI inference pipeline...',
        output_files: {},
      });

      if (!wsConnected) {
        pollJob(r.job_id);
      }
    } catch (e: any) {
      toast.error(`Failed to start job: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [file, selectedModels, mode, ensembleMethod, modelWeights, wsConnected, overlap, outputFormat, lowVram, pollJob]);

  const handleReset = useCallback(() => {
    setCurrentJob(null);
  }, []);

  const isProcessing = currentJob && !['completed', 'error'].includes(currentJob.status);
  const isComplete = currentJob?.status === 'completed';
  const modelNames = Object.fromEntries(Object.entries(models).map(([k, v]) => [k, v.name]));

  const canSubmit =
    Boolean(file) &&
    selectedModels.length > 0 &&
    (mode !== 'ensemble' || selectedModels.length >= 2) &&
    !isSubmitting;

  const activeModel = mode === 'single' && selectedModels.length > 0 ? models[selectedModels[0]] : null;

  // Initial Electron splash
  if (!backendReady && window.electronAPI) {
    return (
      <div className="h-screen w-screen flex flex-col bg-[#0b0d14] text-zinc-100 overflow-hidden">
        <Header health={null} wsConnected={false} backendReady={false} />
        <div className="flex-1">
          <BackendSplash
            attempt={backendStatus?.attempt || 0}
            maxRetries={backendStatus?.maxRetries || 30}
            error={backendStatus?.error}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0d14] text-zinc-100 select-none overflow-hidden">
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#161822',
            color: '#e4e4e7',
            border: '1px solid #27293d',
            fontSize: '12px',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          },
        }}
      />

      {/* Top Application Header */}
      <Header health={health} wsConnected={wsConnected} backendReady={backendReady} />

      {/* Main Studio Workstation */}
      <main className="flex-1 flex overflow-hidden">
        {isComplete ? (
          <div className="flex-1 p-5 overflow-y-auto">
            <ResultsView job={currentJob!} onReset={handleReset} />
          </div>
        ) : isProcessing ? (
          <div className="flex-1 p-5 flex items-center justify-center overflow-y-auto">
            <ProcessingView job={currentJob!} onReset={handleReset} onCancel={handleCancelJob} />
          </div>
        ) : (
          <div className="flex-1 flex w-full h-full overflow-hidden">
            {/* ══════════════════════════════════════════════════════════
                LEFT PANEL: TRACK & PIPELINE CONTROL DECK (380px)
                ══════════════════════════════════════════════════════════ */}
            <aside className="w-[380px] shrink-0 border-r border-zinc-800/80 bg-zinc-950/70 p-4 flex flex-col justify-between overflow-y-auto gap-4">
              <div className="space-y-4">
                {/* 1. Track Source Dropzone */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                      1. Audio Source
                    </span>
                    {file && (
                      <span className="text-[10px] text-emerald-400 font-mono font-medium">
                        ✓ Loaded
                      </span>
                    )}
                  </div>
                  <FileUpload file={file} onFileSelect={setFile} />
                </div>

                {/* 2. Separation Mode Segmented Switch */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      2. Separation Engine
                    </span>
                  </div>

                  <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('single');
                        setSelectedModels((p) => p.slice(0, 1));
                      }}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                        mode === 'single'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <AudioLines className="w-3.5 h-3.5" />
                      <span>Single Model</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('ensemble')}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                        mode === 'ensemble'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Ensemble Blend</span>
                    </button>
                  </div>
                </div>

                {/* 3. Output Format & Studio DSP Settings */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-3">
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider block">
                    3. Output Parameters
                  </span>

                  {/* Format */}
                  <div>
                    <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                      Audio Format
                    </label>
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg bg-zinc-800 border border-zinc-700/80 text-zinc-200 outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="wav_16">WAV 16-bit PCM (Standard CD)</option>
                      <option value="wav_24">WAV 24-bit PCM (Studio Master HD)</option>
                      <option value="wav_float">WAV 32-bit Float (DAW Mixing)</option>
                      <option value="flac">FLAC Lossless (Compressed)</option>
                    </select>
                  </div>

                  {/* Overlap */}
                  <div>
                    <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                      Chunk Overlap
                    </label>
                    <select
                      value={overlap}
                      onChange={(e) => setOverlap(parseFloat(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg bg-zinc-800 border border-zinc-700/80 text-zinc-200 outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value={0.1}>10% — Fast Inference Preview</option>
                      <option value={0.25}>25% — Balanced Quality (Recommended)</option>
                      <option value={0.5}>50% — Maximum Seamless Stitching</option>
                    </select>
                  </div>

                  {/* Low VRAM Mode */}
                  <div className="pt-2 border-t border-zinc-800">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
                          <Cpu className="w-3.5 h-3.5 text-amber-400" />
                          <span>Low VRAM Mode</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          Optimized for GPUs with ≤ 4GB memory
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={lowVram}
                        onChange={(e) => setLowVram(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500"
                      />
                    </label>
                  </div>
                </div>

                {/* 4. Active Selection Summary */}
                {activeModel && (
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                        Active Target
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        {activeModel.stems.length} stems
                      </span>
                    </div>
                    <div className="font-bold text-zinc-100">{activeModel.name}</div>
                    <div className="text-[11px] text-zinc-400 capitalize">
                      Extracts: {activeModel.stems.join(' + ')}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action Trigger */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                    canSubmit
                      ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/25 active:scale-[0.99] cursor-pointer'
                      : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        style={{ animation: 'spin 0.6s linear infinite' }}
                      />
                      <span>Starting Engine...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>
                        {mode === 'ensemble'
                          ? `Run Ensemble (${selectedModels.length} Models)`
                          : 'Separate Audio'}
                      </span>
                    </>
                  )}
                </button>

                {!canSubmit && (
                  <p className="text-[10px] text-zinc-500 text-center mt-2">
                    {!file
                      ? 'Please load an audio file above'
                      : selectedModels.length === 0
                      ? 'Select a model from the catalog'
                      : mode === 'ensemble' && selectedModels.length < 2
                      ? 'Select at least 2 models for ensemble blend'
                      : ''}
                  </p>
                )}
              </div>
            </aside>

            {/* ══════════════════════════════════════════════════════════
                RIGHT PANEL: MODEL BROWSER & ENSEMBLE WORKSPACE
                ══════════════════════════════════════════════════════════ */}
            <section className="flex-1 flex flex-col p-4 overflow-hidden bg-zinc-900/30">
              {mode === 'single' ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div>
                      <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                        AI Model Catalog
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Select a specialized neural network tailored for your audio task
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <ModelSelector
                      models={models}
                      categories={categories}
                      selectedModels={selectedModels}
                      mode={mode}
                      onToggleModel={handleToggleModel}
                      onDownloadModel={handleDownloadModel}
                      onDeleteModel={handleDeleteModel}
                      downloadingModels={downloadingModels}
                    />
                  </div>
                </div>
              ) : (
                /* Ensemble Mode: Split Catalog & Matrix */
                <div className="flex-1 flex gap-4 h-full overflow-hidden">
                  {/* Left: Model Checklist */}
                  <div className="w-[55%] flex flex-col h-full overflow-hidden">
                    <div className="mb-3 shrink-0">
                      <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                        1. Select Ensemble Contributors
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Choose 2 or more models with matching stems to blend
                      </p>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <ModelSelector
                        models={models}
                        categories={categories}
                        selectedModels={selectedModels}
                        mode={mode}
                        onToggleModel={handleToggleModel}
                        onDownloadModel={handleDownloadModel}
                        onDeleteModel={handleDeleteModel}
                        downloadingModels={downloadingModels}
                      />
                    </div>
                  </div>

                  {/* Right: Ensemble Algorithm Matrix */}
                  <div className="w-[45%] flex flex-col h-full overflow-y-auto pr-1">
                    <div className="mb-3 shrink-0">
                      <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
                        2. Blending Configuration
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Configure recombination algorithm and model weights
                      </p>
                    </div>

                    <EnsembleConfig
                      methods={ensembleMethods}
                      selectedMethod={ensembleMethod}
                      onMethodChange={setEnsembleMethod}
                      modelWeights={modelWeights}
                      selectedModels={selectedModels}
                      modelNames={modelNames}
                      onWeightChange={handleWeightChange}
                    />
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Bottom Status Bar */}
      <footer className="h-7 shrink-0 border-t border-zinc-800/80 bg-zinc-950 px-4 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Audio Separator Studio v1.0
          </span>
          <span className="text-zinc-600">|</span>
          <span>Engine: MSST + PyTorch cu124</span>
          {health?.cuda_device && (
            <>
              <span className="text-zinc-600">|</span>
              <span className="text-indigo-400">{health.cuda_device}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span>44,100 Hz • Stereo Processing</span>
          <a
            href="https://github.com/AndrewImm-OP/audio-separator-studio"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-zinc-400 hover:text-indigo-400 transition-colors"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </footer>
    </div>
  );
}

