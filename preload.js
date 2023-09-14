const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('files', {
  showPicker: () => ipcRenderer.invoke('select-file')
})


