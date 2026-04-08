import { GameApp } from "./game/GameApp.js";

function reportBootError(prefix, reason) {
  const message = `${prefix}: ${reason instanceof Error ? reason.message : String(reason)}`;
  const bootOverlay = document.querySelector("#boot-overlay");
  const bootMessage = document.querySelector("[data-boot-message]");

  if (bootMessage) {
    bootMessage.textContent = message;
  }

  bootOverlay?.classList.remove("boot-overlay--hidden");
  document.title = `Runtime Error | ${message}`;
  return message;
}

window.addEventListener("error", (event) => {
  reportBootError("Runtime error", event.error ?? event.message ?? "Unknown error");
});

window.addEventListener("unhandledrejection", (event) => {
  reportBootError("Unhandled rejection", event.reason ?? "Unknown rejection");
});

const searchParams = new URLSearchParams(window.location.search);
const app = new GameApp({
  bootScenario: searchParams.get("scenario"),
  captureTag: searchParams.get("captureTag"),
  buttonProbe: searchParams.get("buttonProbe"),
  debugVisualization:
    searchParams.get("debugAnchors") === "1" ||
    searchParams.get("debugAnchors") === "true",
  forceTouchControls:
    searchParams.get("forceTouchControls") === "1" ||
    searchParams.get("forceTouchControls") === "true",
});
window.__gameApp = app;

app.initialize().catch((error) => {
  console.error(error);
  reportBootError("Failed to boot runtime", error);
});
