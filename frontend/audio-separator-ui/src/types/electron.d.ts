export interface ElectronAPI {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  getBackendStatus: () => Promise<{ running: boolean; url: string }>;
  restartBackend: () => Promise<boolean>;
  getVersion: () => Promise<string>;
  onBackendStatus: (callback: (status: any) => void) => void;
  onBackendLog: (callback: (msg: string) => void) => void;
  onWindowMaximized: (callback: (maximized: boolean) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
