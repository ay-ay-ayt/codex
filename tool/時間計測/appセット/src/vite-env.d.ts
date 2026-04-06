/// <reference types="vite/client" />

type ElectronAlwaysOnTopLevel =
  | "normal"
  | "floating"
  | "torn-off-menu"
  | "modal-panel"
  | "main-menu"
  | "status"
  | "pop-up-menu"
  | "screen-saver";

type ElectronWindowBridge = {
  isDesktop: boolean;
  setAlwaysOnTop: (value: boolean, level?: ElectronAlwaysOnTopLevel) => Promise<boolean>;
  setWindowMode: (mode: "compact" | "expanded", size?: { width: number; height: number }) => Promise<{ width: number; height: number }>;
  confirmCloseWhileRunning: () => Promise<"continue" | "save-and-exit">;
  minimize: () => Promise<void>;
  close: () => Promise<void>;
  toggleDevTools: () => Promise<boolean>;
};

interface Window {
  electronWindow?: ElectronWindowBridge;
  __studyTimerHasRunningSession?: () => boolean;
  __studyTimerFinalizeAndClose?: () => Promise<boolean>;
}
