import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import type { Job } from '../types';

interface ProcessingViewProps {
  job: Job;
  onReset: () => void;
  onCancel?: () => void;
}

const LABELS: Record<string, string> = {
  queued: 'In Queue',
  downloading_model: 'Downloading Model',
  loading_model: 'Loading Model',
  processing: 'Separating Audio',
  completed: 'Complete',
  error: 'Separation Error',
};

export function ProcessingView({ job, onReset, onCancel }: ProcessingViewProps) {
  const label = LABELS[job.status] || 'Working...';
  const active = ['queued', 'downloading_model', 'loading_model', 'processing'].includes(job.status);
  const isOOM = job.message?.toLowerCase().includes('out of memory') || job.message?.toLowerCase().includes('cuda');

  return (
    <div className="flex flex-col items-center justify-center py-16 anim-in">
      {/* Visual icon / spinner */}
      <div className="relative w-28 h-28 mb-8">
        {active && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 112 112" style={{ animation: 'spin 3s linear infinite' }}>
            <circle
              cx="56"
              cy="56"
              r="52"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeDasharray="80 247"
              strokeLinecap="round"
              opacity="0.6"
            />
          </svg>
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
            style={{
              background: job.status === 'error' ? 'var(--c-error-light)' : 'var(--accent-light)',
            }}
          >
            {job.status === 'error' ? (
              <AlertCircle className="w-7 h-7" style={{ color: 'var(--c-error)' }} />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <h2 style={{ fontSize: 'var(--f-xl)', fontWeight: 700, color: job.status === 'error' ? 'var(--c-error)' : 'var(--text-1)' }}>
        {label}
      </h2>
      <p style={{ fontSize: 'var(--f-sm)', color: 'var(--text-2)', marginTop: '4px', maxWidth: '420px', textAlign: 'center' }}>
        {job.message}
      </p>

      {/* Progress */}
      {active && (
        <div className="w-full max-w-sm mt-8 space-y-3">
          <div className="progress-track progress-track-md">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${job.progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="truncate max-w-[200px]" style={{ fontSize: 'var(--f-xs)', color: 'var(--text-3)' }}>
              {job.input_file}
            </span>
            <span style={{ fontSize: 'var(--f-xs)', fontWeight: 600, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
              {job.progress}%
            </span>
          </div>

          {onCancel && (
            <div className="flex justify-center pt-4">
              <button
                onClick={onCancel}
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--text-3)', fontSize: 'var(--f-xs)' }}
              >
                Cancel Separation
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error Card & Recovery Action */}
      {job.status === 'error' && (
        <div className="mt-6 flex flex-col items-center gap-4 max-w-md w-full">
          <div
            className="w-full text-left"
            style={{
              padding: 'var(--sp-md)',
              borderRadius: 'var(--r-lg)',
              background: 'var(--c-error-light)',
              border: '1px solid rgba(248,113,113,0.25)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--c-error)' }} />
              <div>
                <p style={{ fontSize: 'var(--f-sm)', color: 'var(--c-error)', fontWeight: 600 }}>
                  Separation failed
                </p>
                <p style={{ fontSize: 'var(--f-xs)', color: 'var(--text-2)', marginTop: '4px', wordBreak: 'break-word' }}>
                  {job.message}
                </p>
                {isOOM && (
                  <p style={{ fontSize: 'var(--f-xs)', color: 'var(--c-warning)', marginTop: '8px' }}>
                    💡 <strong>Tip:</strong> GPU memory was exceeded. Try selecting Low VRAM mode or using a faster model.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={onReset} className="btn btn-primary">
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
