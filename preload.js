const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('files', {
  encodeFile: (pass) => ipcRenderer.invoke('select-file', pass),
  decodeFile: (pass) => ipcRenderer.invoke('decode-file', pass)
})


