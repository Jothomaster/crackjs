const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require('fs')
const fsPromises = require('fs/promises')
const path = require('path')
const https = require('https')

function createWindow () {
    ipcMain.handle('select-file', showFileDialog)

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}

const showFileDialog = async () => {
    const res = await dialog.showOpenDialog({properties: ['openFile'] })

    if (!res.canceled) {
        // return res.filePaths[0];
        
        const file = await fsPromises.readFile(res.filePaths[0])
        console.log(file);
        return file.toJSON().data;

    } else {
        return null;
    }
    
}

app.whenReady().then(createWindow)
