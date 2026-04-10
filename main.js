const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const isDev = process.env.NODE_ENV === 'development';

let backendProcess = null;
let frontendProcess = null;

function getAppRoot() {
  return app.isPackaged ? path.join(process.resourcesPath, 'app') : app.getAppPath();
}

function startNodeScript(args, label, cwd) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  child.on('error', (err) => {
    console.error(`${label} failed to start:`, err);
  });

  child.on('exit', (code, signal) => {
    console.log(`${label} exited with code ${code} and signal ${signal}`);
  });

  return child;
}

function startBackgroundServices() {
  if (isDev) return;

  const appRoot = getAppRoot();
  const exeDir = app.isPackaged ? path.dirname(process.execPath) : appRoot;
  const backendScript = path.join(appRoot, 'server.js');
  const nextCli = path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

  backendProcess = startNodeScript([backendScript], 'Backend server', exeDir);
  frontendProcess = startNodeScript([nextCli, 'start', '-p', '3000'], 'Next.js frontend', appRoot);
}

function stopProcess(child, label) {
  if (!child || child.killed) return;

  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
    } else {
      child.kill('SIGTERM');
    }
  } catch (err) {
    console.error(`Unable to stop ${label}:`, err);
  }
}

function stopBackgroundServices() {
  if (isDev) return;

  stopProcess(backendProcess, 'Backend server');
  stopProcess(frontendProcess, 'Next.js frontend');
  backendProcess = null;
  frontendProcess = null;
}

function waitForUrl(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const probe = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }

        setTimeout(probe, 500);
      });

      req.setTimeout(2000, () => {
        req.destroy();
      });
    };

    probe();
  });
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(getAppRoot(), 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  try {
    if (!isDev) {
      await Promise.all([
        waitForUrl('http://localhost:3000'),
        waitForUrl('http://localhost:5000'),
      ]);
    }

    await mainWindow.loadURL('http://localhost:3000');
  } catch (err) {
    await mainWindow.loadURL('data:text/html;charset=utf-8,<h2>Failed to start app</h2><p>Could not reach http://localhost:3000.</p>');
    console.error(err);
  }

  mainWindow.on('closed', () => {
    stopBackgroundServices();
  });
}

app.whenReady().then(async () => {
  if (!isDev) {
    startBackgroundServices();
  }

  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackgroundServices();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  stopBackgroundServices();
});