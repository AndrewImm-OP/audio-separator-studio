import { useState, useEffect } from 'react';
import { Minus, Square, X, Copy, Cpu, Wifi, WifiOff } from 'lucide-react';
import type { HealthResponse } from '../types';

interface HeaderProps {
  health: HealthResponse | null;
  wsConnected: boolean;
  backendReady: boolean;
}

export function Header({ health, wsConnected, backendReady }: HeaderProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = !!window.electronAPI;

  useEffect(() => {
    if (!isElectron) return;
    window.electronAPI!.isMaximized().then(setIsMaximized);
    window.electronAPI!.onWindowMaximized(setIsMaximized);
    return () => { window.electronAPI!.removeAllListeners('window:maximized'); };
  }, [isElectron]);

  return (
    <header
      className="flex items-center shrink-0 relative select-none"
      style={{ height: 'var(--header-h)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-1)' }}
    >
      {/* Brand & Logo */}
      <div className="titlebar-no-drag flex items-center gap-2.5 px-4 shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm"
          style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 10v4" />
            <path d="M6 6v12" />
            <path d="M10 3v18" />
            <path d="M14 8v8" />
            <path d="M18 5v14" />
            <path d="M22 10v4" />
          </svg>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 'var(--f-sm)', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
            Audio Separator
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 'var(--r-sm)',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
              color: 'var(--accent-hover)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Studio
          </span>
        </div>
      </div>

      {/* Drag region */}
      <div className="titlebar-drag flex-1 h-full" />

      {/* Status info */}
      <div className="titlebar-no-drag flex items-center gap-3 px-4">
        {/* GPU */}
        {health && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{ fontSize: 'var(--f-xs)', background: 'var(--bg-tertiary)', color: 'var(--text-2)' }}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span style={{ color: health.cuda_available ? 'var(--c-success)' : 'var(--c-warning)', fontWeight: 500 }}>
              {health.cuda_available ? (health.cuda_device || 'GPU') : 'CPU'}
            </span>
          </div>
        )}

        {/* Backend status */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ fontSize: 'var(--f-xs)', background: 'var(--bg-tertiary)', color: 'var(--text-2)' }}
        >
          {backendReady && wsConnected ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--c-success)', animation: 'pulse-dot 2s ease-in-out infinite' }} />
              <span style={{ color: 'var(--c-success)', fontWeight: 500 }}>Online</span>
            </>
          ) : backendReady ? (
            <>
              <Wifi className="w-3.5 h-3.5" style={{ color: 'var(--c-warning)' }} />
              <span style={{ color: 'var(--c-warning)', fontWeight: 500 }}>Polling</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" style={{ color: 'var(--c-error)' }} />
              <span style={{ color: 'var(--c-error)', fontWeight: 500 }}>Starting</span>
            </>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-4 opacity-40" style={{ background: 'var(--border-1)' }} />
      </div>

      {/* Window controls (Electron only) */}
      {isElectron && (
        <div className="titlebar-no-drag flex items-center h-full">
          <button
            onClick={() => window.electronAPI!.minimize()}
            className="h-8 w-8 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--text-2)', transition: 'var(--t-fast)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => window.electronAPI!.maximize()}
            className="h-8 w-8 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--text-2)', transition: 'var(--t-fast)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
          >
            {isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => window.electronAPI!.close()}
            className="h-8 w-8 flex items-center justify-center rounded-lg mr-2"
            style={{ color: 'var(--text-2)', transition: 'var(--t-fast)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-error)'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
}
