const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlay', {
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
});
