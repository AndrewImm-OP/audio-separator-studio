import { useState, useMemo } from 'react';
import { Download, Check, Loader2, Star, Trash2, Mic, Music, Sparkles, Search, X, CheckCircle2, HardDrive } from 'lucide-react';
import type { ModelInfo, SeparationMode } from '../types';

interface ModelSelectorProps {
  models: Record<string, ModelInfo>;
  categories: Record<string, string[]>;
  selectedModels: string[];
  mode: SeparationMode;
  onToggleModel: (key: string) => void;
  onDownloadModel: (key: string) => void;
  onDeleteModel: (key: string) => void;
  downloadingModels: Set<string>;
}

const CAT_CONFIG: Record<string, { label: string; icon: typeof Mic; color: string }> = {
  vocal: { label: 'Vocals', icon: Mic, color: '#ec4899' },
  multi_stem: { label: 'Multi-Stem', icon: Music, color: '#3b82f6' },
  specialized: { label: 'Denoise & FX', icon: Sparkles, color: '#f59e0b' },
};

const STEM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  vocals: { bg: 'rgba(236,72,153,0.15)', text: '#f472b6', border: 'rgba(236,72,153,0.3)' },
  lead_vocals: { bg: 'rgba(236,72,153,0.15)', text: '#f472b6', border: 'rgba(236,72,153,0.3)' },
  backing_vocals: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
  instrumental: { bg: 'rgba(99,102,241,0.15)', text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  other: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa', border: 'rgba(139,92,246,0.3)' },
  drums: { bg: 'rgba(249,115,22,0.15)', text: '#fb923c', border: 'rgba(249,115,22,0.3)' },
  bass: { bg: 'rgba(6,182,212,0.15)', text: '#22d3ee', border: 'rgba(6,182,212,0.3)' },
  guitar: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80', border: 'rgba(34,197,94,0.3)' },
  piano: { bg: 'rgba(99,102,241,0.15)', text: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  clean: { bg: 'rgba(6,182,212,0.15)', text: '#22d3ee', border: 'rgba(6,182,212,0.3)' },
  noise: { bg: 'rgba(113,113,122,0.15)', text: '#a1a1aa', border: 'rgba(113,113,122,0.3)' },
  dry: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  reverb: { bg: 'rgba(168,85,247,0.15)', text: '#c084fc', border: 'rgba(168,85,247,0.3)' },
};

export function ModelSelector({
  models,
  categories,
  selectedModels,
  mode,
  onToggleModel,
  onDownloadModel,
  onDeleteModel,
  downloadingModels,
}: ModelSelectorProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'downloaded' | 'vocal' | 'multi_stem' | 'specialized'>('all');

  const modelList = useMemo(() => {
    const list: (ModelInfo & { category: string })[] = [];
    Object.entries(categories).forEach(([cat, keys]) => {
      keys.forEach((key) => {
        const m = models[key];
        if (m) {
          list.push({ ...m, category: cat });
        }
      });
    });
    return list;
  }, [categories, models]);

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return modelList.filter((m) => {
      // Category filter
      if (activeTab === 'downloaded' && !m.is_downloaded) return false;
      if (activeTab !== 'all' && activeTab !== 'downloaded' && m.category !== activeTab) return false;

      // Query filter
      if (!query) return true;
      return (
        m.name.toLowerCase().includes(query) ||
        m.key.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query) ||
        m.stems.some((s) => s.toLowerCase().includes(query)) ||
        (m.model_type || '').toLowerCase().includes(query)
      );
    });
  }, [modelList, search, activeTab]);

  const downloadedCount = useMemo(() => {
    return Object.values(models).filter((m) => m.is_downloaded).length;
  }, [models]);

  return (
    <div className="flex flex-col h-full space-y-3.5">
      {/* Search Bar + Filters */}
      <div className="flex flex-col gap-2.5 shrink-0">
        {/* Search Input Row */}
        <div className="flex items-center gap-2">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border transition-all"
            style={{
              background: 'var(--bg-secondary)',
              borderColor: search ? 'var(--accent)' : 'var(--border-1)',
            }}
          >
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by model name, architecture, stems (e.g. Roformer, vocals)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-zinc-100 placeholder-zinc-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-zinc-400 hover:text-zinc-200 transition-colors p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {selectedModels.length > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{selectedModels.length} selected</span>
            </div>
          )}
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            All Models ({modelList.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('downloaded')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border flex items-center gap-1.5 ${
              activeTab === 'downloaded'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Downloaded ({downloadedCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('vocal')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border flex items-center gap-1.5 ${
              activeTab === 'vocal'
                ? 'bg-pink-600 text-white border-pink-500 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Mic className="w-3 h-3 text-pink-400" />
            Vocals
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('multi_stem')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border flex items-center gap-1.5 ${
              activeTab === 'multi_stem'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Music className="w-3 h-3 text-blue-400" />
            4-Stem Band
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('specialized')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 border flex items-center gap-1.5 ${
              activeTab === 'specialized'
                ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            Denoise & FX
          </button>
        </div>
      </div>

      {/* Model Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {filteredModels.length === 0 ? (
          <div className="h-48 rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center text-center p-6 text-zinc-400">
            <Search className="w-8 h-8 text-zinc-600 mb-2" />
            <p className="text-sm font-medium text-zinc-300">No models match your filter</p>
            <p className="text-xs text-zinc-500 mt-1">Try changing category or clearing your search term</p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setActiveTab('all');
              }}
              className="mt-3 px-3 py-1.5 text-xs rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
            {filteredModels.map((model) => {
              const isSelected = selectedModels.includes(model.key);
              const isDownloading = downloadingModels.has(model.key);

              return (
                <ModelCard
                  key={model.key}
                  model={model}
                  selected={isSelected}
                  downloading={isDownloading}
                  mode={mode}
                  onToggle={() => onToggleModel(model.key)}
                  onDownload={() => onDownloadModel(model.key)}
                  onDelete={() => onDeleteModel(model.key)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ModelCard({
  model,
  selected,
  downloading,
  mode,
  onToggle,
  onDownload,
  onDelete,
}: {
  model: ModelInfo & { category: string };
  selected: boolean;
  downloading: boolean;
  mode: SeparationMode;
  onToggle: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const cat = CAT_CONFIG[model.category] || { label: model.category, icon: Music, color: '#818cf8' };
  const bestSDR = Object.entries(model.sdr_metrics || {}).sort(([, a], [, b]) => b - a)[0];

  return (
    <div
      onClick={onToggle}
      className={`group relative rounded-xl border p-3.5 flex flex-col justify-between cursor-pointer transition-all duration-200 select-none ${
        selected
          ? 'bg-gradient-to-b from-indigo-950/40 to-zinc-900 border-indigo-500 ring-1 ring-indigo-500 shadow-md shadow-indigo-500/10'
          : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/40'
      }`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          {/* Architecture & Category Badge */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60">
              {model.model_type || 'neural'}
            </span>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-md border"
              style={{
                backgroundColor: `${cat.color}15`,
                color: cat.color,
                borderColor: `${cat.color}30`,
              }}
            >
              {cat.label}
            </span>
            {model.is_downloaded ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Ready
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                Auto-download
              </span>
            )}
          </div>

          {/* Selection indicator */}
          <div
            className={`w-5 h-5 rounded-${mode === 'single' ? 'full' : 'md'} flex items-center justify-center shrink-0 border transition-all ${
              selected
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'border-zinc-700 group-hover:border-zinc-600 bg-zinc-800/50'
            }`}
          >
            {selected && (
              mode === 'ensemble' ? (
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-white" />
              )
            )}
          </div>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors line-clamp-1">
          {model.name}
        </h4>

        {/* Description */}
        <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
          {model.description || 'High performance source separation model'}
        </p>

        {/* Stems Badges */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {model.stems.map((stem) => {
            const stemStyle = STEM_COLORS[stem.toLowerCase()] || {
              bg: 'rgba(113,113,122,0.15)',
              text: '#a1a1aa',
              border: 'rgba(113,113,122,0.3)',
            };
            return (
              <span
                key={stem}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md border capitalize"
                style={{
                  backgroundColor: stemStyle.bg,
                  color: stemStyle.text,
                  borderColor: stemStyle.border,
                }}
              >
                {stem}
              </span>
            );
          })}
        </div>
      </div>

      {/* Card Footer: Metrics & Actions */}
      <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2.5 font-mono text-zinc-400">
          {bestSDR && (
            <span className="flex items-center gap-1 text-amber-400 font-semibold" title="Signal-to-Distortion Ratio">
              <Star className="w-3 h-3 fill-current" />
              {bestSDR[1].toFixed(1)} dB
            </span>
          )}
          {model.size_mb > 0 && (
            <span className="flex items-center gap-1 text-zinc-500">
              <HardDrive className="w-3 h-3" />
              {model.size_mb >= 1000 ? `${(model.size_mb / 1000).toFixed(1)} GB` : `${model.size_mb} MB`}
            </span>
          )}
        </div>

        {/* Download / Delete Action */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {!model.is_downloaded ? (
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/30 flex items-center gap-1 text-[10px] font-medium transition-all"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Delete offline weights"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
