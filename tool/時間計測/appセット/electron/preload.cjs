const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronWindow", {
  isDesktop: true,
  setAlwaysOnTop: (value, level = "floating") =>
    ipcRenderer.invoke("window:set-always-on-top", { value, level }),
  setWindowMode: (mode, size) => ipcRenderer.invoke("window:set-mode", { mode, size }),
  confirmCloseWhileRunning: () => ipcRenderer.invoke("window:confirm-close-while-running"),
  minimize: () => ipcRenderer.invoke("window:minimize"),
  close: () => ipcRenderer.invoke("window:close"),
  toggleDevTools: () => ipcRenderer.invoke("window:toggle-devtools")
});
