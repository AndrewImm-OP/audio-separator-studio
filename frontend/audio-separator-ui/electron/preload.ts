const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Backend
  getBackendStatus: () => ipcRenderer.invoke('backend:status'),
  restartBackend: () => ipcRenderer.invoke('backend:restart'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Event listeners
  onBackendStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('backend-status', (_event: any, status: any) => callback(status));
  },
  onBackendLog: (callback: (msg: string) => void) => {
    ipcRenderer.on('backend-log', (_event: any, msg: string) => callback(msg));
  },
  onWindowMaximized: (callback: (maximized: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_event: any, maximized: boolean) => callback(maximized));
  },

  // Cleanup
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
