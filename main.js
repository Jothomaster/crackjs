const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { encryptFile, decryptFile, recoverPassword } = require('./magic/magic');

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 400,
	minWidth: 300,
	minHeight: 380,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')

  ipcMain.handle('select-file', (event, pass) => {
    encryptFile(event, pass, win);
  });
  ipcMain.handle('decode-file', (event, pass) => {
    decryptFile(event, pass, win);
  });
  ipcMain.handle('recover-password', (event) => {
    recoverPassword(event, win);
  });
}


app.whenReady().then(createWindow)
