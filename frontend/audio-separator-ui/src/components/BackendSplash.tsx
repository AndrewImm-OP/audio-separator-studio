import { motion } from 'framer-motion';

interface BackendSplashProps { attempt: number; maxRetries: number; error?: string; }

export function BackendSplash({ attempt, maxRetries, error }: BackendSplashProps) {
  const pct = Math.min((attempt / maxRetries) * 100, 95);

  return (
    <div className="h-full flex flex-col items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex flex-col items-center gap-6 max-w-xs text-center">
        {/* Logo */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--accent)', boxShadow: '0 8px 32px var(--accent-glow)' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
        </div>

        <div>
          <h2 style={{ fontSize: 'var(--f-xl)', fontWeight: 700, color: 'var(--text-1)' }}>Audio Separator</h2>
          <p style={{ fontSize: 'var(--f-sm)', color: 'var(--text-2)', marginTop: '4px' }}>
            {error ? 'Failed to start backend' : 'Starting backend server...'}
          </p>
        </div>

        {!error ? (
          <div className="w-56 space-y-2">
            <div className="progress-track progress-track-sm">
              <motion.div
                className="progress-fill"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p style={{ fontSize: 'var(--f-xs)', color: 'var(--text-3)' }}>
              Initializing... ({attempt}/{maxRetries})
            </p>
          </div>
        ) : (
          <div style={{
            padding: 'var(--sp-md)', borderRadius: 'var(--r-lg)',
            background: 'var(--c-error-light)', border: '1px solid rgba(248,113,113,0.2)',
          }}>
            <p style={{ fontSize: 'var(--f-sm)', color: 'var(--c-error)' }}>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
