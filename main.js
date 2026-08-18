const { app, BrowserWindow, shell } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const isDev = !app.isPackaged;

let backendProcess = null;
let frontendProcess = null;

function getLogPath() {
  const baseDir = app.isPackaged ? path.dirname(process.execPath) : app.getAppPath();
  return path.join(baseDir, 'startup.log');
}

function writeLog(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;

  try {
    fs.appendFileSync(getLogPath(), line, 'utf8');
  } catch (err) {
    console.error('Failed to write startup log:', err);
  }
}

function getAppRoot() {
  return app.getAppPath();
}

function startNodeScript(args, label, cwd) {
  writeLog(`${label}: starting with cwd=${cwd} args=${JSON.stringify(args)}`);

  const child = spawn(process.execPath, args, {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', (chunk) => {
    writeLog(`${label} stdout: ${chunk.toString().trim()}`);
  });

  child.stderr.on('data', (chunk) => {
    writeLog(`${label} stderr: ${chunk.toString().trim()}`);
  });

  child.on('error', (err) => {
    console.error(`${label} failed to start:`, err);
    writeLog(`${label} failed to start: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    console.log(`${label} exited with code ${code} and signal ${signal}`);
    writeLog(`${label} exited with code=${code} signal=${signal}`);
  });

  return child;
}

function startBackgroundServices() {
  if (isDev) return;

  const appRoot = getAppRoot();
  const exeDir = app.isPackaged ? path.dirname(process.execPath) : appRoot;
  const resourcesDir = app.isPackaged ? process.resourcesPath : appRoot;
  const backendScript = path.join(appRoot, 'server.js');
  const nextCli = path.join(appRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

  writeLog(`App root: ${appRoot}`);
  writeLog(`Resources dir: ${resourcesDir}`);
  writeLog(`Exe dir: ${exeDir}`);

  backendProcess = startNodeScript([backendScript], 'Backend server', exeDir);
  frontendProcess = startNodeScript(
    [nextCli, 'start', appRoot, '--port', '3000', '--hostname', '127.0.0.1'],
    'Next.js frontend',
    resourcesDir,
  );
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
        waitForUrl('http://127.0.0.1:3000'),
        waitForUrl('http://127.0.0.1:5000'),
      ]);
    }

    await mainWindow.loadURL('http://127.0.0.1:3000');
  } catch (err) {
    writeLog(`Window failed to load app URL: ${err.message}`);
    await mainWindow.loadURL('data:text/html;charset=utf-8,<h2>Failed to start app</h2><p>Could not reach http://localhost:3000.</p>');
    console.error(err);
  }

  mainWindow.on('closed', () => {
    stopBackgroundServices();
  });
}

app.whenReady().then(async () => {
  writeLog(`Electron ready. isPackaged=${app.isPackaged} appPath=${app.getAppPath()}`);

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