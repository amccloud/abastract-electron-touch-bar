const electron = require('electron')
const Abstract = require('abstract-sdk')
const path = require('path')
const url = require('url')

const ICON_WIDTH = 64

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow

function createWindow() {
  // Create the browser window.
  mainWindow = new electron.BrowserWindow({
    minWidth: 800,
    minHeight: 600,
    width: 1280,
    height: 800,
    frame: false,
    webPreferences: {
      webviewTag: true,
      nodeIntegration: true
    }
  })

  // For iframe: Removoe X-Frame-Options from app.abstract.com response
  // mainWindow.webContents.on('did-finish-load', async () => {
  //   mainWindow.webContents.session.webRequest.onHeadersReceived({
  //     urls: ['*://app.abstract.com/*']
  //   }, (details, callback) => {
  //     delete details.responseHeaders['x-frame-options']
  //     delete details.responseHeaders['X-Frame-Options']
  //
  //     callback({
  //       cancel: false,
  //       responseHeaders: details.responseHeaders
  //     })
  //   })
  // })

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:'
  }))

  electron.ipcMain.on('shareUrl', async (event, shareUrl) => {
    const shareDescriptor = { url: shareUrl }
    const abstract = new Abstract.Client({ accessToken: shareDescriptor })
    const share = await abstract.shares.info(shareDescriptor)
    const { collection, layers } = await abstract.collections.info(share.descriptor)
    const layersById = layers.reduce((layersById, layer) => {
      layersById[layer.id] = layer
      return layersById
    }, {})

    const items = await Promise.all(collection.layers.map(
      async collectionLayer => {
        const layer = layersById[collectionLayer.layerId]
        // TODO: methods for object -> descriptor
        const layerDescriptor = {
          projectId: collection.projectId,
          branchId: collection.branchId,
          fileId: collectionLayer.fileId,
          layerId: collectionLayer.layerId,
          sha: layer.lastChangedAtSha
        }

        const buffer = Buffer.from(await abstract.previews.raw(layerDescriptor, {
          disableWrite: true // TODO: Should really be default!
        }))

        return {
          // TODO: methods for descriptor -> url
          // prettier-ignore
          url: `https://previews.goabstract.com/projects/${layerDescriptor.projectId}/commits/${layerDescriptor.sha}/files/${layerDescriptor.fileId}/layers/${layerDescriptor.layerId}?shareId=${share.id}`,
          // For presentation (slower because electron can't history replace in iframe/webview?)
          // url: `https://app.abstract.com/share/${share.id}?collectionLayerId=${collectionLayer.id}&present=true`,
          icon: new electron.nativeImage.createFromBuffer(buffer, {
            width: layer.width,
            height: layer.height,
            scaleFactor: layer.width / ICON_WIDTH,
          })
        }
      }
    ))

    function show(index) {
      mainWindow.webContents.send('replace', items[index].url)
    }

    // Show first item
    show(0)

  	const scrubber = new electron.TouchBar.TouchBarScrubber({
  		items: items,
      showArrowButtons: true,
      overlayStyle: 'outline',
  		select: (index) => show(index)
  	})

  	const touchBar = new electron.TouchBar({
  		items: [scrubber]
  	})

  	mainWindow.setTouchBar(touchBar)
  })

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
electron.app.on('ready', createWindow)

// Quit when all windows are closed.
electron.app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    electron.app.quit()
  }
})

electron.app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
