const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { encryptFile, decryptFile } = require('./magic/magic');

function createWindow () {
  ipcMain.handle('select-file', encryptFile);
  ipcMain.handle('decode-file', decryptFile);

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}


app.whenReady().then(createWindow)
