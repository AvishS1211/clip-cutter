const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 3456;
const isDev = !app.isPackaged;

let mainWindow;
let serverProcess;

function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http.get(`http://localhost:${PORT}`, (res) => {
        if (res.statusCode < 500) resolve();
        else setTimeout(() => attempt(n - 1), 500);
      }).on('error', () => {
        if (n <= 0) reject(new Error('Server failed to start'));
        else setTimeout(() => attempt(n - 1), 500);
      });
    };
    attempt(retries);
  });
}

function startServer() {
  if (isDev) {
    // In dev, Next.js is already running via `npm run electron:dev`
    return Promise.resolve();
  }

  // In production, run the standalone Next.js server bundled in the app
  const serverScript = path.join(process.resourcesPath, 'server', 'server.js');

  serverProcess = spawn(process.execPath, [serverScript], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
    },
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', (d) => console.log('[server]', d.toString()));
  serverProcess.stderr.on('data', (d) => console.error('[server]', d.toString()));

  return waitForServer();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 720,
    minHeight: 500,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    title: 'Clip Cutter',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('Failed to start server:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
