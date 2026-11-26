const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bridge', {
  gunShoot: (x, y) => ipcRenderer.invoke('gun-shoot', { x, y }),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  onSpawn: fn => ipcRenderer.on('spawn-gun', () => fn()),
  onHolster: fn => ipcRenderer.on('holster-gun', () => fn()),
});
