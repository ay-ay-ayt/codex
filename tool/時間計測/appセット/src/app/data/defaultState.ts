import type { AppSettings } from "../types";

export const defaultSettings: AppSettings = {
  alwaysOnTop: true,
  closeBehavior: "confirm-before-exit",
  compactSize: {
    width: 320,
    height: 136
  },
  expandedSize: {
    width: 420,
    height: 680
  }
};
