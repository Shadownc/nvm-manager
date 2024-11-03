import { app, BrowserWindow, shell, ipcMain, Tray, Menu } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import { installNodeVersion, uninstallNodeVersion, switchNodeVersion, getInstalledVersions, getAvailableNodeVersions } from './nvmHandler';

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let tray: Tray | null = null;
let isQuitting = false;
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'nvm-manager',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  win.on('close', (event) => {
    if (!isQuitting) { // 如果不是真正的退出
      event.preventDefault(); // 阻止默认关闭行为
      win?.hide(); // 隐藏窗口到托盘
    }
    // 如果 isQuitting 为 true，则允许窗口关闭
  });

  Menu.setApplicationMenu(null);

  tray = new Tray(path.join(process.env.VITE_PUBLIC, 'favicon.ico'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '博客',
      icon: path.join(process.env.VITE_PUBLIC, 'icons', 'blog.png'),
      click: () => {
        shell.openExternal('https://blog.lmyself.top'); // 打开博客链接
      }
    },
    { type: 'separator' },
    {
      label: 'Github',
      icon: path.join(process.env.VITE_PUBLIC, 'icons', 'github.png'),
      click: () => {
        shell.openExternal('https://github.com/Shadownc/nvm-manager'); // 打开 Github 链接
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      icon: path.join(process.env.VITE_PUBLIC, 'icons', 'exit.png'),
      click: () => {
        console.log("Debug: User clicked exit, closing application...");
        isQuitting = true;
        app.quit(); // 退出应用
      }
    }
  ]);

  tray.setToolTip('nvm-manager');
  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示窗口
  tray.on('click', () => {
    win?.show();
  });

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  update(win)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unknown error occurred';
}

// 安装 Node.js 版本
ipcMain.handle('install-node-version', async (event, version) => {
  try {
    const result = await installNodeVersion(version);
    return { success: true, message: result };
  } catch (error) {
    return { success: false, message: `Failed to install version: ${getErrorMessage(error)}` };
  }
});

// 卸载 Node.js 版本
ipcMain.handle('uninstall-node-version', async (event, version) => {
  try {
    const result = await uninstallNodeVersion(version);
    return { success: true, message: result };
  } catch (error) {
    return { success: false, message: `Failed to uninstall version: ${getErrorMessage(error)}` };
  }
});

// 切换 Node.js 版本
ipcMain.handle('switch-node-version', async (event, version) => {
  try {
    const result = await switchNodeVersion(version);
    return { success: true, message: result };
  } catch (error) {
    return { success: false, message: `Failed to switch version: ${getErrorMessage(error)}` };
  }
});

// 获取已安装版本
ipcMain.handle('get-installed-versions', async () => {
  try {
    const versions = await getInstalledVersions();
    return { success: true, versions };
  } catch (error) {
    return { success: false, message: `Failed to get installed versions: ${getErrorMessage(error)}` };
  }
});

// 获取可用的 Node.js 版本
ipcMain.handle('get-available-node-versions', async () => {
  try {
    const versions = await getAvailableNodeVersions();
    return { success: true, versions };
  } catch (error) {
    return { success: false, message: `Failed to get available versions: ${getErrorMessage(error)}` };
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

ipcMain.on('quit-app', () => {
  isQuitting = true;
  app.quit();
});