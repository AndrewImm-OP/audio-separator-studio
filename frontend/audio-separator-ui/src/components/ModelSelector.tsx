import { useState, useMemo } from 'react';
import { Download, Check, Loader2, ChevronDown, Star, Trash2, Mic, Music, Sparkles, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

const CAT: Record<string, { label: string; icon: typeof Mic; color: string }> = {
  vocal: { label: 'Vocal Separation', icon: Mic, color: '#ec4899' },
  multi_stem: { label: 'Multi-Stem', icon: Music, color: '#3b82f6' },
  specialized: { label: 'Specialized (Denoise/DeReverb)', icon: Sparkles, color: '#f59e0b' },
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
  const [expanded, setExpanded] = useState<string | null>('vocal');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'downloaded' | 'vocal' | 'multi_stem' | 'specialized'>('all');

  const filteredCategories = useMemo(() => {
    const result: Record<string, string[]> = {};
    const query = search.trim().toLowerCase();

    Object.entries(categories).forEach(([cat, keys]) => {
      if (activeTab !== 'all' && activeTab !== 'downloaded' && activeTab !== cat) return;

      const filteredKeys = keys.filter((key) => {
        const m = models[key];
        if (!m) return false;
        if (activeTab === 'downloaded' && !m.is_downloaded) return false;
        if (!query) return true;
        return (
          m.name.toLowerCase().includes(query) ||
          m.key.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query) ||
          m.stems.some((s) => s.toLowerCase().includes(query))
        );
      });

      if (filteredKeys.length > 0) {
        result[cat] = filteredKeys;
      }
    });

    return result;
  }, [categories, models, search, activeTab]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 style={{ fontSize: 'var(--f-lg)', fontWeight: 700, color: 'var(--text-1)' }}>
            {mode === 'ensemble' ? 'Select Ensemble Models' : 'Separation Model'}
          </h2>
          <p style={{ fontSize: 'var(--f-xs)', color: 'var(--text-2)', marginTop: '2px' }}>
            {mode === 'ensemble'
              ? 'Choose 2 or more models to blend algorithms'
              : 'Choose the best architecture for your audio'}
          </p>
        </div>

        {selectedModels.length > 0 && (
          <span
            className="flex items-center gap-1.5"
            style={{
              fontSize: 'var(--f-xs)',
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 'var(--r-full)',
              background: 'var(--accent-light)',
              color: 'var(--accent-hover)',
            }}
          >
            {selectedModels.length} selected
          </span>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div
          className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-1)' }}
        >
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search models by name, stem, architecture..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-xs w-full text-zinc-200 placeholder-zinc-500"
          />
        </div>

        {/* Tab Filters */}
        <div
          className="inline-flex p-1 rounded-lg shrink-0 gap-1 overflow-x-auto"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-1)' }}
        >
          {(['all', 'downloaded', 'vocal', 'multi_stem'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-2.5 py-1 text-xs rounded font-medium transition-all"
              style={{
                background: activeTab === tab ? 'var(--accent)' : 'transparent',
                color: activeTab === tab ? 'white' : 'var(--text-3)',
              }}
            >
              {tab === 'all'
                ? 'All'
                : tab === 'downloaded'
                ? 'Ready'
                : tab === 'vocal'
                ? 'Vocals'
                : 'Multi-Stem'}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      {Object.entries(filteredCategories).length === 0 ? (
        <div className="card text-center py-8" style={{ color: 'var(--text-3)', fontSize: 'var(--f-sm)' }}>
          No models matching your search
        </div>
      ) : (
        Object.entries(filteredCategories).map(([cat, keys]) => {
          const cfg = CAT[cat] || { label: cat, icon: Music, color: '#71717a' };
          const Icon = cfg.icon;
          const isOpen = expanded === cat || Boolean(search);

          return (
            <div key={cat} className="card overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => setExpanded(isOpen ? null : cat)}
                className="w-full flex items-center gap-3 transition-colors"
                style={{ padding: 'var(--sp-md)', background: 'transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${cfg.color}18` }}
                >
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 text-left">
                  <span style={{ fontSize: 'var(--f-sm)', fontWeight: 600, color: 'var(--text-1)' }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: 'var(--f-xs)', color: 'var(--text-3)', marginLeft: '6px' }}>
                    ({keys.length})
                  </span>
                </div>
                <ChevronDown
                  className="w-4 h-4 transition-transform duration-200"
                  style={{ color: 'var(--text-3)', transform: isOpen ? 'rotate(180deg)' : 'none' }}
                />
              </button>

              {/* Model items */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div style={{ padding: '0 var(--sp-sm) var(--sp-sm)' }} className="space-y-1">
                      {keys.map((key) => {
                        const m = models[key];
                        if (!m) return null;
                        return (
                          <ModelItem
                            key={key}
                            model={m}
                            selected={selectedModels.includes(key)}
                            downloading={downloadingModels.has(key)}
                            onToggle={() => onToggleModel(key)}
                            onDownload={() => onDownloadModel(key)}
                            onDelete={() => onDeleteModel(key)}
                          />
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}
    </div>
  );
}

function ModelItem({
  model,
  selected,
  downloading,
  onToggle,
  onDownload,
  onDelete,
}: {
  model: ModelInfo;
  selected: boolean;
  downloading: boolean;
  onToggle: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const bestSDR = Object.entries(model.sdr_metrics).sort(([, a], [, b]) => b - a)[0];

  return (
    <div
      className={`flex items-center gap-3 rounded-lg cursor-pointer group transition-all ${
        selected ? 'card-active' : ''
      }`}
      style={{
        padding: 'var(--sp-sm) var(--sp-md)',
        background: selected ? undefined : 'transparent',
        border: selected ? undefined : '1px solid transparent',
      }}
      onClick={onToggle}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {/* Checkbox */}
      <div
        className="w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
        style={{
          borderColor: selected ? 'var(--accent)' : 'var(--border-2)',
          background: selected ? 'var(--accent)' : 'transparent',
        }}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate" style={{ fontSize: 'var(--f-sm)', fontWeight: 600, color: 'var(--text-1)' }}>
            {model.name}
          </span>
          {!model.is_downloaded ? (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                padding: '1px 6px',
                borderRadius: 'var(--r-full)',
                background: 'rgba(251,191,36,0.12)',
                color: 'var(--c-warning)',
              }}
            >
              auto-download on run
            </span>
          ) : (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 500,
                padding: '1px 6px',
                borderRadius: 'var(--r-full)',
                background: 'var(--c-success-light)',
                color: 'var(--c-success)',
              }}
            >
              downloaded
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {model.stems.map((s) => (
            <span
              key={s}
              style={{
                fontSize: '11px',
                fontWeight: 500,
                padding: '1px 6px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-2)',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </span>
          ))}
          {bestSDR && (
            <span
              className="flex items-center gap-0.5"
              style={{ fontSize: '11px', fontWeight: 600, color: '#fbbf24' }}
              title="Signal-to-Distortion Ratio (SDR dB)"
            >
              <Star className="w-3 h-3 fill-current" />
              SDR {bestSDR[1].toFixed(2)} dB
            </span>
          )}
          {model.size_mb > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              {model.size_mb >= 1000 ? `${(model.size_mb / 1000).toFixed(1)} GB` : `${model.size_mb} MB`}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {!model.is_downloaded ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          disabled={downloading}
          className="btn btn-ghost btn-icon btn-sm"
          title="Download model now"
          style={{ color: 'var(--accent)' }}
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="btn btn-ghost btn-icon btn-sm opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete downloaded model"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--c-error)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-3)';
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
