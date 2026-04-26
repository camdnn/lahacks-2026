const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let win;
let tray;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'index.html'));

  screen.on('display-metrics-changed', () => {
    const { width: w, height: h } = screen.getPrimaryDisplay().workAreaSize;
    win.setSize(w, h);
  });
}

function createTray() {
  // Minimal 1×1 transparent PNG so the tray icon renders on Mac
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2NkYGD4z8BAAiCBgYGBgYGBgZECAADeAAH/2Q=='
  );
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Pudge – Flicker to Flow');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Pudge – Flicker to Flow', enabled: false },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
}

ipcMain.on('set-ignore-mouse', (_event, ignore) => {
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
