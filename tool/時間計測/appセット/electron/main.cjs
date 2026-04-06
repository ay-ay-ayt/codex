const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
const ALWAYS_ON_TOP_LEVELS = new Set([
  "normal",
  "floating",
  "torn-off-menu",
  "modal-panel",
  "main-menu",
  "status",
  "pop-up-menu",
  "screen-saver"
]);
const DEFAULT_SIZES = {
  compact: { width: 320, height: 136 },
  expanded: { width: 420, height: 680 }
};

let allowNextClose = false;

function clampSize(mode, size) {
  const fallback = DEFAULT_SIZES[mode] ?? DEFAULT_SIZES.compact;
  const width = typeof size?.width === "number" ? Math.max(mode === "compact" ? 300 : 380, Math.round(size.width)) : fallback.width;
  const height = typeof size?.height === "number" ? Math.max(mode === "compact" ? 128 : 560, Math.round(size.height)) : fallback.height;
  return { width, height };
}

function applyWindowMode(target, mode, size) {
  const nextMode = mode === "expanded" ? "expanded" : "compact";
  const nextSize = clampSize(nextMode, size);

  target.setMinimumSize(nextMode === "compact" ? 300 : 380, nextMode === "compact" ? 128 : 560);
  target.setSize(nextSize.width, nextSize.height, true);
  return nextSize;
}

async function confirmCloseWhileRunning(target) {
  const { response } = await dialog.showMessageBox(target, {
    type: "question",
    buttons: ["Keep running", "Save and exit"],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: "Study Timer",
    message: "A study session is still active.",
    detail: "Keep running leaves the window open. Save and exit stores the elapsed time and then closes the app."
  });

  return response === 1 ? "save-and-exit" : "continue";
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: DEFAULT_SIZES.compact.width,
    height: DEFAULT_SIZES.compact.height,
    minWidth: 300,
    minHeight: 128,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.once("ready-to-show", () => {
    window.setAlwaysOnTop(true, "floating");
    window.show();
  });

  window.on("close", (event) => {
    if (allowNextClose) {
      return;
    }

    event.preventDefault();

    void (async () => {
      try {
        const hasRunningSession = await window.webContents.executeJavaScript(
          "window.__studyTimerHasRunningSession ? window.__studyTimerHasRunningSession() : false",
          true
        );

        if (!hasRunningSession) {
          allowNextClose = true;
          window.close();
          return;
        }

        const choice = await confirmCloseWhileRunning(window);
        if (choice !== "save-and-exit") {
          return;
        }

        const saved = await window.webContents.executeJavaScript(
          "window.__studyTimerFinalizeAndClose ? window.__studyTimerFinalizeAndClose() : false",
          true
        );

        if (saved === false) {
          return;
        }

        allowNextClose = true;
        window.close();
      } catch (error) {
        console.error("Failed to close study timer window safely", error);
      }
    })();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  if (DEV_SERVER_URL) {
    void window.loadURL(DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  return window;
}

function getSenderWindow(sender) {
  return BrowserWindow.fromWebContents(sender) ?? BrowserWindow.getFocusedWindow() ?? null;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  allowNextClose = false;
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("window:set-always-on-top", (event, payload = {}) => {
  const target = getSenderWindow(event.sender);
  if (!target) {
    return false;
  }

  const nextValue = Boolean(payload.value);
  const nextLevel = typeof payload.level === "string" && ALWAYS_ON_TOP_LEVELS.has(payload.level)
    ? payload.level
    : "floating";

  target.setAlwaysOnTop(nextValue, nextLevel);
  return target.isAlwaysOnTop();
});

ipcMain.handle("window:set-mode", (event, payload = {}) => {
  const target = getSenderWindow(event.sender);
  if (!target) {
    return DEFAULT_SIZES.compact;
  }

  return applyWindowMode(target, payload.mode, payload.size);
});

ipcMain.handle("window:confirm-close-while-running", async (event) => {
  const target = getSenderWindow(event.sender);
  if (!target) {
    return "continue";
  }

  return confirmCloseWhileRunning(target);
});

ipcMain.handle("window:minimize", (event) => {
  const target = getSenderWindow(event.sender);
  target?.minimize();
});

ipcMain.handle("window:close", (event) => {
  const target = getSenderWindow(event.sender);
  target?.close();
});

ipcMain.handle("window:toggle-devtools", (event) => {
  const target = getSenderWindow(event.sender);
  if (!target) {
    return false;
  }

  if (target.webContents.isDevToolsOpened()) {
    target.webContents.closeDevTools();
    return false;
  }

  target.webContents.openDevTools({ mode: "detach" });
  return true;
});
