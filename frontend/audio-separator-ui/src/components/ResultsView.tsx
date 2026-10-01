import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Archive,
  ArrowLeft,
  Mic,
  Drum,
  Guitar,
  Music,
  Waves,
  CheckCircle2,
  Sliders,
  Radio,
} from 'lucide-react';
import type { Job } from '../types';
import { getStemDownloadUrl, getAllStemsDownloadUrl, getOriginalAudioUrl } from '../api/client';

interface ResultsViewProps {
  job: Job;
  onReset: () => void;
}

const STEM_CONFIGS: Record<string, { icon: typeof Music; color: string; label: string }> = {
  vocals: { icon: Mic, color: '#ec4899', label: 'Vocals' },
  drums: { icon: Drum, color: '#f97316', label: 'Drums' },
  bass: { icon: Guitar, color: '#06b6d4', label: 'Bass' },
  guitar: { icon: Guitar, color: '#22c55e', label: 'Guitar' },
  other: { icon: Waves, color: '#8b5cf6', label: 'Other / Instrumental' },
  piano: { icon: Music, color: '#6366f1', label: 'Piano' },
  clean: { icon: Waves, color: '#06b6d4', label: 'Cleaned' },
  noise: { icon: Waves, color: '#71717a', label: 'Noise' },
  dry: { icon: Waves, color: '#3b82f6', label: 'Dry (De-reverbed)' },
  reverb: { icon: Waves, color: '#a855f7', label: 'Reverb' },
  restored: { icon: Music, color: '#10b981', label: 'Restored Audio' },
};

const DEFAULT_CONFIG = { icon: Music, color: '#818cf8', label: 'Stem' };

export function ResultsView({ job, onReset }: ResultsViewProps) {
  const stems = Object.keys(job.output_files);

  // Multitrack playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [soloStem, setSoloStem] = useState<string | null>(null);
  const [mutedStems, setMutedStems] = useState<Set<string>>(new Set());
  const [stemVolumes, setStemVolumes] = useState<Record<string, number>>(
    Object.fromEntries(stems.map((s) => [s, 1.0]))
  );
  const [compareOriginal, setCompareOriginal] = useState(false);

  // Audio references
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize audio elements
  useEffect(() => {
    // Stems audio
    stems.forEach((name) => {
      const audio = new Audio(getStemDownloadUrl(job.id, name));
      audio.preload = 'metadata';
      audioRefs.current[name] = audio;

      audio.addEventListener('loadedmetadata', () => {
        if (audio.duration && !isNaN(audio.duration)) {
          setDuration((prev) => Math.max(prev, audio.duration));
        }
      });
    });

    // Original audio for A/B comparison
    const origAudio = new Audio(getOriginalAudioUrl(job.id));
    origAudio.preload = 'metadata';
    origAudio.addEventListener('loadedmetadata', () => {
      if (origAudio.duration && !isNaN(origAudio.duration)) {
        setDuration((prev) => Math.max(prev, origAudio.duration));
      }
    });
    originalAudioRef.current = origAudio;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      Object.values(audioRefs.current).forEach((a) => {
        a.pause();
        a.src = '';
      });
      if (originalAudioRef.current) {
        originalAudioRef.current.pause();
        originalAudioRef.current.src = '';
      }
    };
  }, [job.id, stems]);

  // Update track time loop
  const updateLoop = useCallback(() => {
    let t = 0;
    if (compareOriginal && originalAudioRef.current) {
      t = originalAudioRef.current.currentTime;
    } else {
      const firstStem = stems[0] ? audioRefs.current[stems[0]] : null;
      if (firstStem) t = firstStem.currentTime;
    }
    setCurrentTime(t);

    if (duration > 0 && t >= duration - 0.1) {
      setIsPlaying(false);
      seekAll(0);
      return;
    }

    animFrameRef.current = requestAnimationFrame(updateLoop);
  }, [compareOriginal, duration, stems]);

  // Apply volumes and solo/mute to audio elements
  useEffect(() => {
    if (compareOriginal) {
      // Original track active
      if (originalAudioRef.current) {
        originalAudioRef.current.volume = masterVolume;
        originalAudioRef.current.muted = false;
      }
      // Mute all stems
      Object.values(audioRefs.current).forEach((a) => {
        a.muted = true;
      });
    } else {
      // Normal multitrack mode
      if (originalAudioRef.current) {
        originalAudioRef.current.muted = true;
      }

      stems.forEach((name) => {
        const audio = audioRefs.current[name];
        if (!audio) return;

        const isSoloed = soloStem === name;
        const hasSolo = soloStem !== null;
        const isMuted = mutedStems.has(name);

        if (hasSolo) {
          audio.muted = !isSoloed;
        } else {
          audio.muted = isMuted;
        }

        const vol = (stemVolumes[name] ?? 1.0) * masterVolume;
        audio.volume = Math.max(0, Math.min(1, vol));
      });
    }
  }, [compareOriginal, soloStem, mutedStems, stemVolumes, masterVolume, stems]);

  // Play / Pause toggle
  const togglePlay = () => {
    if (isPlaying) {
      pauseAll();
    } else {
      playAll();
    }
  };

  const playAll = () => {
    const targetTime = currentTime;
    if (compareOriginal) {
      if (originalAudioRef.current) {
        originalAudioRef.current.currentTime = targetTime;
        originalAudioRef.current.play().catch(() => {});
      }
    } else {
      Object.values(audioRefs.current).forEach((a) => {
        a.currentTime = targetTime;
        a.play().catch(() => {});
      });
    }
    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(updateLoop);
  };

  const pauseAll = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    Object.values(audioRefs.current).forEach((a) => a.pause());
    if (originalAudioRef.current) originalAudioRef.current.pause();
    setIsPlaying(false);
  };

  const seekAll = (time: number) => {
    Object.values(audioRefs.current).forEach((a) => {
      a.currentTime = time;
    });
    if (originalAudioRef.current) {
      originalAudioRef.current.currentTime = time;
    }
    setCurrentTime(time);
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekAll(pct * duration);
  };

  const toggleSolo = (name: string) => {
    setSoloStem((prev) => (prev === name ? null : name));
  };

  const toggleMute = (name: string) => {
    setMutedStems((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const setStemVolume = (name: string, vol: number) => {
    setStemVolumes((prev) => ({ ...prev, [name]: vol }));
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 anim-in">
      {/* Top Banner */}
      <div className="card" style={{ padding: 'var(--sp-lg)' }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--c-success-light)' }}
            >
              <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--c-success)' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 style={{ fontSize: 'var(--f-lg)', fontWeight: 700, color: 'var(--text-1)' }}>
                  Separation Studio
                </h2>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--r-full)',
                    background: 'var(--accent-light)',
                    color: 'var(--accent-hover)',
                  }}
                >
                  {stems.length} Stems
                </span>
              </div>
              <p style={{ fontSize: 'var(--f-xs)', color: 'var(--text-2)', marginTop: '2px' }}>
                Track: <strong style={{ color: 'var(--text-1)' }}>{job.input_file}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a href={getAllStemsDownloadUrl(job.id)} className="btn btn-primary">
              <Archive className="w-4 h-4" /> Download All (ZIP)
            </a>
            <button onClick={onReset} className="btn btn-secondary">
              <ArrowLeft className="w-4 h-4" /> New Audio
            </button>
          </div>
        </div>
      </div>

      {/* Studio Master Deck & Timeline */}
      <div className="card overflow-hidden" style={{ padding: 'var(--sp-lg)', background: 'var(--bg-secondary)' }}>
        {/* Timeline Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          {/* Main Transport Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="btn btn-primary"
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--r-full)',
                padding: 0,
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              onClick={() => seekAll(0)}
              className="btn btn-ghost btn-icon btn-sm"
              title="Return to start"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="flex items-baseline gap-1 font-mono pl-2" style={{ fontSize: 'var(--f-sm)' }}>
              <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{formatTime(currentTime)}</span>
              <span style={{ color: 'var(--text-3)' }}>/</span>
              <span style={{ color: 'var(--text-3)' }}>{duration ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>

          {/* Master Controls & A/B Comparison */}
          <div className="flex items-center gap-4">
            {/* A/B Compare Toggle */}
            <button
              onClick={() => setCompareOriginal(!compareOriginal)}
              className="btn btn-sm"
              style={{
                background: compareOriginal ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: compareOriginal ? 'white' : 'var(--text-2)',
                border: `1px solid ${compareOriginal ? 'var(--accent)' : 'var(--border-1)'}`,
                gap: '6px',
              }}
            >
              <Radio className="w-3.5 h-3.5" />
              {compareOriginal ? 'Original Track (A)' : 'Stems Mix (B)'}
            </button>

            {/* Master Volume */}
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
              <span style={{ fontSize: 'var(--f-xs)', color: 'var(--text-3)' }}>Master</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={masterVolume}
                onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
        </div>

        {/* Global Scrub Bar */}
        <div
          className="progress-track progress-track-md cursor-pointer relative"
          onClick={handleScrub}
          style={{ height: '10px' }}
        >
          <div
            className="progress-fill"
            style={{
              width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              background: 'linear-gradient(90deg, var(--accent), #a855f7)',
              transition: 'none',
            }}
          />
        </div>
      </div>

      {/* Multitrack Stems List */}
      <div className="space-y-3">
        {stems.map((name, idx) => {
          const cfg = STEM_CONFIGS[name] || DEFAULT_CONFIG;
          const Icon = cfg.icon;
          const isSoloed = soloStem === name;
          const isMuted = mutedStems.has(name);
          const isMutedBySolo = soloStem !== null && !isSoloed;
          const effectiveMute = isMuted || isMutedBySolo || compareOriginal;
          const vol = stemVolumes[name] ?? 1.0;
          const stemUrl = getStemDownloadUrl(job.id, name);

          return (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="card overflow-hidden"
              style={{
                padding: 'var(--sp-md) var(--sp-lg)',
                borderColor: isSoloed ? cfg.color : effectiveMute ? 'var(--border-1)' : undefined,
                opacity: effectiveMute ? 0.6 : 1,
                transition: 'opacity 0.2s, border-color 0.2s',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Stem Badge & Label */}
                <div className="flex items-center gap-3 min-w-[160px]">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${cfg.color}20` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 'var(--f-sm)', fontWeight: 600, color: 'var(--text-1)' }}>
                      {cfg.label}
                    </h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                      {name}
                    </span>
                  </div>
                </div>

                {/* Simulated Interactive Waveform Display */}
                <div
                  className="flex-1 min-w-[200px] h-9 rounded-lg flex items-center px-3 cursor-pointer overflow-hidden relative"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-1)' }}
                  onClick={handleScrub}
                >
                  <WaveformVisualizer
                    color={cfg.color}
                    progress={duration > 0 ? currentTime / duration : 0}
                    isActive={isPlaying && !effectiveMute}
                  />
                </div>

                {/* Track Channel Strip Controls (Solo, Mute, Volume, Download) */}
                <div className="flex items-center gap-3 shrink-0">
                  {/* Solo (S) button */}
                  <button
                    onClick={() => toggleSolo(name)}
                    className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: isSoloed ? '#fbbf24' : 'var(--bg-tertiary)',
                      color: isSoloed ? '#000' : 'var(--text-3)',
                      border: '1px solid var(--border-1)',
                    }}
                    title="Solo track"
                  >
                    S
                  </button>

                  {/* Mute (M) button */}
                  <button
                    onClick={() => toggleMute(name)}
                    className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-all"
                    style={{
                      background: isMuted ? 'var(--c-error)' : 'var(--bg-tertiary)',
                      color: isMuted ? '#fff' : 'var(--text-3)',
                      border: '1px solid var(--border-1)',
                    }}
                    title="Mute track"
                  >
                    M
                  </button>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-1.5 pl-1">
                    <button
                      onClick={() => setStemVolume(name, vol === 0 ? 1 : 0)}
                      className="btn btn-ghost btn-icon btn-sm"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {vol === 0 || effectiveMute ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={vol}
                      onChange={(e) => setStemVolume(name, parseFloat(e.target.value))}
                      className="w-16"
                    />
                  </div>

                  {/* Download single stem */}
                  <a
                    href={stemUrl}
                    download
                    className="btn btn-ghost btn-icon btn-sm"
                    title={`Download ${name} stem`}
                    style={{ color: 'var(--accent)' }}
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Waveform envelope component
function WaveformVisualizer({
  color,
  progress,
  isActive,
}: {
  color: string;
  progress: number;
  isActive: boolean;
}) {
  const barsCount = 64;
  // Generate a deterministic pseudo-random waveform pattern
  const heights = useRef(
    Array.from({ length: barsCount }, (_, i) => {
      const v = Math.sin(i * 0.28) * 0.4 + Math.cos(i * 0.6) * 0.3 + 0.35;
      return Math.max(0.15, Math.min(0.95, v));
    })
  ).current;

  return (
    <div className="w-full h-full flex items-center gap-[2px] relative">
      {heights.map((h, i) => {
        const barPos = i / barsCount;
        const played = barPos <= progress;
        return (
          <div
            key={i}
            className="flex-1 rounded-full transition-all"
            style={{
              height: `${h * 80}%`,
              background: played ? color : 'var(--border-2)',
              opacity: played ? 1 : 0.45,
              transform: isActive && played ? 'scaleY(1.08)' : 'scaleY(1)',
            }}
          />
        );
      })}
    </div>
  );
}
