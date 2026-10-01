import { useState } from 'react';
import { Blend, ChevronDown, Waves, BarChart3, Sliders, Info } from 'lucide-react';
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

export function EnsembleConfig({
  methods,
  selectedMethod,
  onMethodChange,
  modelWeights,
  selectedModels,
  modelNames,
  onWeightChange,
}: EnsembleConfigProps) {
  const [showWeights, setShowWeights] = useState(true);
  const currentMethod = methods.find((m) => m.key === selectedMethod);
  const waveMethods = methods.filter((m) => m.domain === 'waveform');
  const specMethods = methods.filter((m) => m.domain === 'spectral');

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
            <Blend className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
              Ensemble Blend Matrix
            </h3>
            <p className="text-[11px] text-zinc-400">
              Combine outputs of {selectedModels.length} models
            </p>
          </div>
        </div>

        {currentMethod && (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 capitalize">
            {currentMethod.domain}
          </span>
        )}
      </div>

      {/* Methods Selection Groups */}
      <div className="space-y-3">
        {/* Waveform Domain */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold text-cyan-400">
            <Waves className="w-3.5 h-3.5" />
            <span>Waveform Domain (Sample Level)</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {waveMethods.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onMethodChange(m.key)}
                className={`text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-all border ${
                  selectedMethod === m.key
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 shadow-sm'
                    : 'bg-zinc-800/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <div className="font-semibold">{m.name.replace(' (Waveform)', '')}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{m.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Spectral Domain */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold text-amber-400">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Spectral Domain (FFT Magnitude)</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {specMethods.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => onMethodChange(m.key)}
                className={`text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-all border ${
                  selectedMethod === m.key
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-zinc-800/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <div className="font-semibold">{m.name.replace(' (Spectral)', '')}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{m.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Method Info Callout */}
      {currentMethod && (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-800 p-2.5 flex items-start gap-2 text-xs text-zinc-300">
          <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed text-[11px]">{currentMethod.description}</div>
        </div>
      )}

      {/* Model Weight Sliders */}
      {selectedModels.length > 0 && (
        <div className="pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={() => setShowWeights(!showWeights)}
            className="w-full flex items-center justify-between text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>Model Weight Balancing</span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${showWeights ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {showWeights && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-2.5 pt-3"
              >
                {selectedModels.map((key) => {
                  const w = modelWeights[key] ?? 1.0;
                  return (
                    <div key={key} className="space-y-1 bg-zinc-800/30 p-2 rounded-lg border border-zinc-800/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-200 font-medium truncate max-w-[200px]">
                          {modelNames[key] || key}
                        </span>
                        <span className="font-mono text-indigo-400 font-bold">{w.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3.0"
                        step="0.1"
                        value={w}
                        onChange={(e) => onWeightChange(key, parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
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
