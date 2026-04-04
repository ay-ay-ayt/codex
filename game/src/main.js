import { GameApp } from "./game/GameApp.js";

const app = new GameApp();
window.__gameApp = app;

app.initialize().catch((error) => {
  console.error(error);

  const bootMessage = document.querySelector("[data-boot-message]");

  if (bootMessage) {
    bootMessage.textContent = `起動に失敗しました: ${error instanceof Error ? error.message : String(error)}`;
  }
});
