import { useState } from 'react';
import { Blend, ChevronDown, Waves, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EnsembleMethodInfo } from '../types';

interface EnsembleConfigProps {
  methods: EnsembleMethodInfo[];
  selectedMethod: string;
  onMethodChange: (method: string) => void;
  modelWeights: Record<string, number>;
  selectedModels: string[];
  modelNames: Record<string, string>;
  onWeightChange: (key: string, weight: number) => void;
}

export function EnsembleConfig({ methods, selectedMethod, onMethodChange, modelWeights, selectedModels, modelNames, onWeightChange }: EnsembleConfigProps) {
  const [showWeights, setShowWeights] = useState(false);
  const info = methods.find((m) => m.key === selectedMethod);
  const wave = methods.filter((m) => m.domain === 'waveform');
  const spec = methods.filter((m) => m.domain === 'spectral');

  return (
    <div className="card" style={{ padding: 'var(--sp-lg)' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
          <Blend className="w-4 h-4" style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: 'var(--f-md)', fontWeight: 700, color: 'var(--text-1)' }}>Ensemble Method</h3>
          <p style={{ fontSize: 'var(--f-xs)', color: 'var(--text-2)' }}>How model outputs are blended</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Waveform */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Waves className="w-3.5 h-3.5" style={{ color: '#06b6d4' }} />
            <span style={{ fontSize: 'var(--f-xs)', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Waveform</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {wave.map((m) => (
              <MethodBtn key={m.key} method={m} active={selectedMethod === m.key} onClick={() => onMethodChange(m.key)} />
            ))}
          </div>
        </div>

        {/* Spectral */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-3.5 h-3.5" style={{ color: '#f97316' }} />
            <span style={{ fontSize: 'var(--f-xs)', fontWeight: 600, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Spectral (FFT)</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {spec.map((m) => (
              <MethodBtn key={m.key} method={m} active={selectedMethod === m.key} onClick={() => onMethodChange(m.key)} />
            ))}
          </div>
        </div>
      </div>

      {info && (
        <p style={{
          fontSize: 'var(--f-xs)', color: 'var(--text-2)', marginTop: 'var(--sp-md)',
          padding: 'var(--sp-sm) var(--sp-md)', borderRadius: 'var(--r-md)',
          background: 'var(--bg-tertiary)',
        }}>
          {info.description}
        </p>
      )}

      {/* Weights */}
      {selectedModels.length > 0 && (
        <div style={{ marginTop: 'var(--sp-lg)' }}>
          <button
            onClick={() => setShowWeights(!showWeights)}
            className="flex items-center gap-2"
            style={{ fontSize: 'var(--f-sm)', color: 'var(--text-2)', fontWeight: 500, background: 'none' }}
          >
            <ChevronDown
              className="w-4 h-4 transition-transform duration-200"
              style={{ transform: showWeights ? 'rotate(180deg)' : 'none' }}
            />
            Model Weights
            <span style={{ fontSize: 'var(--f-xs)', color: 'var(--text-3)' }}>(optional)</span>
          </button>

          <AnimatePresence>
            {showWeights && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-3 mt-3"
              >
                {selectedModels.map((key) => {
                  const w = modelWeights[key] ?? 1.0;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="truncate" style={{ fontSize: 'var(--f-xs)', color: 'var(--text-2)', maxWidth: '200px' }}>{modelNames[key] || key}</span>
                        <span style={{ fontSize: 'var(--f-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--accent)' }}>{w.toFixed(1)}x</span>
                      </div>
                      <input type="range" min="0.1" max="3.0" step="0.1" value={w} onChange={(e) => onWeightChange(key, parseFloat(e.target.value))} className="w-full" />
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function MethodBtn({ method, active, onClick }: { method: EnsembleMethodInfo; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left transition-all"
      style={{
        padding: 'var(--sp-sm) var(--sp-md)',
        borderRadius: 'var(--r-md)',
        fontSize: 'var(--f-sm)',
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--accent-hover)' : 'var(--text-2)',
        background: active ? 'var(--accent-light)' : 'var(--bg-tertiary)',
        border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
        boxShadow: active ? 'var(--shadow-glow)' : 'none',
      }}
      onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-2)'; } }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.borderColor = 'transparent'; } }}
    >
      {method.name}
    </button>
  );
}
