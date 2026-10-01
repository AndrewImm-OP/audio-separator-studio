const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow: any = null;
let backendProcess: any = null;
let backendReady = false;

// Resolve paths
const isDev = !app.isPackaged;
const BACKEND_DIR = isDev
  ? path.resolve(__dirname, '..', '..', '..', 'backend')
  : path.join((process as any).resourcesPath, 'backend');

const os = require('os');
const LOCAL_VENV_PYTHON = path.join(BACKEND_DIR, 'venv', 'bin', 'python');
const USER_VENV_PYTHON = path.join(os.homedir(), '.local', 'share', 'audio-separator', 'venv', 'bin', 'python');

function getBackendUrl(): string {
  return 'http://localhost:8000';
}

// ─── Backend Management ──────────────────────────────────────────────────────

function startBackend(): void {
  if (backendProcess) return;

  const pythonCmd = fs.existsSync(LOCAL_VENV_PYTHON)
    ? LOCAL_VENV_PYTHON
    : fs.existsSync(USER_VENV_PYTHON)
    ? USER_VENV_PYTHON
    : 'python3';

  console.log(`[Backend] Starting with: ${pythonCmd}`);
  console.log(`[Backend] Dir: ${BACKEND_DIR}`);

  backendProcess = spawn(
    pythonCmd,
    ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000'],
    {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        MSST_PATH: path.join(BACKEND_DIR, 'msst'),
        UPLOAD_DIR: '/tmp/audio-separator/uploads',
        OUTPUT_DIR: '/tmp/audio-separator/outputs',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

  backendProcess.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) {
      console.log(`[Backend] ${msg}`);
      sendToRenderer('backend-log', msg);
    }
  });

  backendProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) {
      console.log(`[Backend] ${msg}`);
      sendToRenderer('backend-log', msg);
    }
  });

  backendProcess.on('exit', (code: number | null) => {
    console.log(`[Backend] Exited with code ${code}`);
    backendProcess = null;
    backendReady = false;
    sendToRenderer('backend-status', { running: false, code });
  });

  backendProcess.on('error', (err: Error) => {
    console.error('[Backend] Failed to start:', err.message);
    sendToRenderer('backend-status', { running: false, error: err.message });
  });
}

function stopBackend(): void {
  if (backendProcess) {
    console.log('[Backend] Stopping...');
    backendProcess.kill('SIGTERM');
    setTimeout(() => {
      if (backendProcess) {
        backendProcess.kill('SIGKILL');
        backendProcess = null;
      }
    }, 5000);
  }
}

// Safe send to renderer — only if window exists and webContents is not destroyed
function sendToRenderer(channel: string, data: any): void {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  } catch {
    // Window might be closing
  }
}

async function waitForBackend(maxRetries = 30): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${getBackendUrl()}/api/health`);
      if (response.ok) {
        console.log('[Backend] Ready!');
        backendReady = true;
        sendToRenderer('backend-status', { running: true });
        return true;
      }
    } catch {
      // Backend not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    sendToRenderer('backend-status', {
      running: false,
      starting: true,
      attempt: i + 1,
      maxRetries,
    });
  }
  sendToRenderer('backend-status', {
    running: false,
    error: 'Backend failed to start within 30 seconds',
  });
  return false;
}

// ─── Window Management ───────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── IPC Handlers ────────────────────────────────────────────────────────────

function setupIPC(): void {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

  // Renderer can actively ask for backend status (solves race condition)
  ipcMain.handle('backend:status', () => ({
    running: backendReady,
    url: getBackendUrl(),
    processAlive: backendProcess !== null,
  }));

  ipcMain.handle('backend:restart', async () => {
    stopBackend();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    startBackend();
    return waitForBackend();
  });

  ipcMain.handle('app:getVersion', () => app.getVersion());

  mainWindow?.on('maximize', () => {
    sendToRenderer('window:maximized', true);
  });
  mainWindow?.on('unmaximize', () => {
    sendToRenderer('window:maximized', false);
  });
}

// ─── App Lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  createWindow();
  setupIPC();

  // Start backend immediately — don't wait for renderer
  startBackend();

  // Wait for the page to actually load before starting health poll
  // This ensures the renderer's IPC listener is registered
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[Main] Renderer loaded, starting backend health poll...');
    // If backend is already ready (unlikely but possible), notify immediately
    if (backendReady) {
      sendToRenderer('backend-status', { running: true });
    }
  });

  // Run health poll — messages sent before renderer loads will be missed,
  // but renderer also polls on mount via backend:status invoke
  await waitForBackend();
});

app.on('window-all-closed', () => {
  stopBackend();
  app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
