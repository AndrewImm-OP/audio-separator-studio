import { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Layers, AudioLines, Zap } from 'lucide-react';

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

  // Backend status (Electron)
  useEffect(() => {
    if (!window.electronAPI) { setBackendReady(true); return; }

    // Listen for push updates from main process
    window.electronAPI.onBackendStatus((s: any) => {
      setBackendStatus(s);
      if (s.running) setBackendReady(true);
    });

    // Also actively poll — solves race condition where main process
    // sent 'running: true' before this listener was registered
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const pollBackendStatus = async () => {
      try {
        const status = await window.electronAPI!.getBackendStatus();
        if (status.running) {
          setBackendReady(true);
          if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
        }
      } catch { /* ignore */ }
    };
    // Poll immediately, then every 1s until ready
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
        setModels(m.models); setCategories(m.categories); setEnsembleMethods(e.methods);
      } catch (err) { console.error('Load failed:', err); }
    })();
  }, [backendReady]);

  // WS updates
  useEffect(() => {
    if (lastJobUpdate && currentJob && lastJobUpdate.id === currentJob.id) {
      setCurrentJob(lastJobUpdate);
      if (lastJobUpdate.status === 'completed') toast.success('Separation complete!');
      else if (lastJobUpdate.status === 'error') toast.error(`Error: ${lastJobUpdate.message}`);
    }
  }, [lastJobUpdate, currentJob]);

  const handleToggleModel = useCallback((key: string) => {
    setSelectedModels((p) => mode === 'single' ? (p.includes(key) ? [] : [key]) : (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }, [mode]);

  const handleDownloadModel = useCallback(async (key: string) => {
    setDownloadingModels((p) => new Set(p).add(key));
    try { await api.downloadModel(key); const d = await api.getModels(); setModels(d.models); toast.success(`Downloaded: ${models[key]?.name || key}`); }
    catch (e: any) { toast.error(`Download failed: ${e.message}`); }
    finally { setDownloadingModels((p) => { const n = new Set(p); n.delete(key); return n; }); }
  }, [models]);

  const handleDeleteModel = useCallback(async (key: string) => {
    try { await api.deleteModel(key); const d = await api.getModels(); setModels(d.models); setSelectedModels((p) => p.filter((k) => k !== key)); toast.success('Model deleted'); }
    catch (e: any) { toast.error(`Delete failed: ${e.message}`); }
  }, []);

  const [outputFormat, setOutputFormat] = useState('wav_16');
  const [overlap, setOverlap] = useState(0.25);
  const [lowVram, setLowVram] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleWeightChange = useCallback((k: string, w: number) => setModelWeights((p) => ({ ...p, [k]: w })), []);

  const handleCancelJob = useCallback(async () => {
    if (currentJob?.id) {
      try {
        await api.cancelJob(currentJob.id);
        toast.success('Separation cancelled');
      } catch { /* ignore */ }
    }
    setCurrentJob(null);
  }, [currentJob]);

  const handleSubmit = useCallback(async () => {
    if (!file) { toast.error('Select an audio file'); return; }
    if (selectedModels.length === 0) { toast.error('Select a model'); return; }
    if (mode === 'ensemble' && selectedModels.length < 2) { toast.error('Ensemble needs 2+ models'); return; }
    setIsSubmitting(true);
    try {
      const r = mode === 'single'
        ? await api.separateAudio(file, selectedModels[0], overlap, 485100, outputFormat, lowVram)
        : await api.ensembleSeparate(file, selectedModels, ensembleMethod, selectedModels.map((k) => modelWeights[k] ?? 1.0));
      setCurrentJob({ id: r.job_id, status: 'queued', input_file: file.name, progress: 0, message: 'Starting...', output_files: {} });
      if (!wsConnected) pollJob(r.job_id);
    } catch (e: any) { toast.error(`Failed: ${e.message}`); }
    finally { setIsSubmitting(false); }
  }, [file, selectedModels, mode, ensembleMethod, modelWeights, wsConnected, overlap, outputFormat, lowVram]);

  const pollJob = useCallback(async (id: string) => {
    const go = async () => { try { const j = await api.getJobStatus(id); setCurrentJob(j); if (j.status !== 'completed' && j.status !== 'error') setTimeout(go, 2000); } catch { setTimeout(go, 3000); } };
    go();
  }, []);

  const handleReset = useCallback(() => { setCurrentJob(null); setFile(null); }, []);

  const isProcessing = currentJob && !['completed', 'error'].includes(currentJob.status);
  const isComplete = currentJob?.status === 'completed';
  const modelNames = Object.fromEntries(Object.entries(models).map(([k, v]) => [k, v.name]));
  const canSubmit = file && selectedModels.length > 0 && (mode !== 'ensemble' || selectedModels.length >= 2) && !isSubmitting;

  // Splash
  if (!backendReady && window.electronAPI) {
    return (
      <div className="h-screen flex flex-col">
        <Header health={null} wsConnected={false} backendReady={false} />
        <div className="flex-1"><BackendSplash attempt={backendStatus?.attempt || 0} maxRetries={backendStatus?.maxRetries || 30} error={backendStatus?.error} /></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-elevated)', color: 'var(--text-1)',
            border: '1px solid var(--border-1)', fontSize: '13px',
            borderRadius: 'var(--r-md)', padding: '10px 14px',
            boxShadow: 'var(--shadow-lg)',
          },
        }}
      />

      <Header health={health} wsConnected={wsConnected} backendReady={backendReady} />

      <main className="flex-1 overflow-y-auto" style={{ padding: 'var(--sp-lg)', scrollBehavior: 'smooth' }}>
        <div className="max-w-7xl mx-auto w-full">
          {isComplete ? (
            <ResultsView job={currentJob!} onReset={handleReset} />
          ) : isProcessing ? (
            <ProcessingView job={currentJob!} onReset={handleReset} onCancel={handleCancelJob} />
          ) : (
            <div className="space-y-6 anim-in">
              {/* Mode toggle */}
              <div className="flex justify-center">
                <div className="inline-flex p-1 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-1)' }}>
                  <button
                    onClick={() => { setMode('single'); setSelectedModels((p) => p.slice(0, 1)); }}
                    className="btn btn-sm"
                    style={{
                      background: mode === 'single' ? 'var(--accent)' : 'transparent',
                      color: mode === 'single' ? 'white' : 'var(--text-2)',
                      boxShadow: mode === 'single' ? 'var(--shadow-md)' : 'none',
                      borderRadius: 'var(--r-md)',
                    }}
                  >
                    <AudioLines className="w-3.5 h-3.5" /> Single Model
                  </button>
                  <button
                    onClick={() => setMode('ensemble')}
                    className="btn btn-sm"
                    style={{
                      background: mode === 'ensemble' ? 'var(--accent)' : 'transparent',
                      color: mode === 'ensemble' ? 'white' : 'var(--text-2)',
                      boxShadow: mode === 'ensemble' ? 'var(--shadow-md)' : 'none',
                      borderRadius: 'var(--r-md)',
                    }}
                  >
                    <Layers className="w-3.5 h-3.5" /> Ensemble
                  </button>
                </div>
              </div>

              {/* Upload */}
              <FileUpload file={file} onFileSelect={setFile} />

              {/* Model + ensemble side-by-side */}
              <div className={`grid gap-4 ${mode === 'ensemble' ? 'grid-cols-1 lg:grid-cols-[1fr_minmax(300px,380px)]' : 'grid-cols-1'}`}>
                <ModelSelector
                  models={models} categories={categories} selectedModels={selectedModels} mode={mode}
                  onToggleModel={handleToggleModel} onDownloadModel={handleDownloadModel}
                  onDeleteModel={handleDeleteModel} downloadingModels={downloadingModels}
                />
                {mode === 'ensemble' && (
                  <EnsembleConfig
                    methods={ensembleMethods} selectedMethod={ensembleMethod}
                    onMethodChange={setEnsembleMethod} modelWeights={modelWeights}
                    selectedModels={selectedModels} modelNames={modelNames} onWeightChange={handleWeightChange}
                  />
                )}
              </div>

              {/* Advanced Settings Bar */}
              <div className="card" style={{ padding: 'var(--sp-md)' }}>
                <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowAdvanced(!showAdvanced)}>
                  <span style={{ fontSize: 'var(--f-sm)', fontWeight: 600, color: 'var(--text-1)' }}>
                    ⚙️ Advanced Processing Settings
                  </span>
                  <span style={{ fontSize: 'var(--f-xs)', color: 'var(--accent)' }}>
                    {showAdvanced ? 'Hide' : 'Show'}
                  </span>
                </div>

                {showAdvanced && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-[var(--border-1)]">
                    {/* Output Format */}
                    <div>
                      <label style={{ fontSize: 'var(--f-xs)', color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>
                        Audio Format
                      </label>
                      <select
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value)}
                        className="w-full text-xs p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-1)] text-zinc-200 outline-none"
                      >
                        <option value="wav_16">WAV 16-bit PCM (Standard CD)</option>
                        <option value="wav_24">WAV 24-bit PCM (Studio HD)</option>
                        <option value="wav_float">WAV 32-bit Float</option>
                        <option value="flac">FLAC (Lossless Compressed)</option>
                      </select>
                    </div>

                    {/* Overlap */}
                    <div>
                      <label style={{ fontSize: 'var(--f-xs)', color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>
                        Chunk Overlap
                      </label>
                      <select
                        value={overlap}
                        onChange={(e) => setOverlap(parseFloat(e.target.value))}
                        className="w-full text-xs p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-1)] text-zinc-200 outline-none"
                      >
                        <option value={0.1}>10% (Fast)</option>
                        <option value={0.25}>25% (Balanced, recommended)</option>
                        <option value={0.5}>50% (Highest quality)</option>
                      </select>
                    </div>

                    {/* Low VRAM */}
                    <div>
                      <label style={{ fontSize: 'var(--f-xs)', color: 'var(--text-2)', display: 'block', marginBottom: '4px' }}>
                        VRAM Optimization
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer mt-1 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={lowVram}
                          onChange={(e) => setLowVram(e.target.checked)}
                          className="rounded border-[var(--border-1)] text-[var(--accent)]"
                        />
                        <span>Low VRAM Mode (≤ 4GB GPU)</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex justify-center pt-2 pb-6">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="btn btn-primary btn-lg"
                  style={{
                    gap: 'var(--sp-sm)',
                    boxShadow: canSubmit ? '0 4px 20px var(--accent-glow)' : 'none',
                  }}
                >
                  {isSubmitting ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: 'spin 0.6s linear infinite' }} /> Starting...</>
                  ) : (
                    <><Zap className="w-4 h-4" /> {mode === 'ensemble' ? `Ensemble (${selectedModels.length})` : 'Separate Audio'}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-1)', padding: '8px var(--sp-lg)', background: 'var(--bg-secondary)' }}>
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between" style={{ fontSize: 'var(--f-xs)', color: 'var(--text-3)' }}>
          <span>Audio Separator v1.0</span>
          <span>Powered by <a href="https://github.com/ZFTurbo/Music-Source-Separation-Training" target="_blank" rel="noopener noreferrer">MSST</a></span>
        </div>
      </footer>
    </div>
  );
}
