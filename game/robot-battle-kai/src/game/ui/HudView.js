export class HudView {
  constructor(root) {
    this.root = root;
    this.retryHandler = null;
    this.root.innerHTML = `
      <div class="hud-shell">
        <div class="hud-panel hud-panel--player">
          <div class="hud-panel__eyebrow">Player</div>
          <div class="hud-bars">
            <div class="hud-bar">
              <span class="hud-bar__label">HP</span>
              <div class="hud-bar__track"><div class="hud-bar__fill hud-bar__fill--hp"></div></div>
              <span class="hud-bar__value hud-value-hp">000</span>
            </div>
            <div class="hud-bar">
              <span class="hud-bar__label">EN</span>
              <div class="hud-bar__track"><div class="hud-bar__fill hud-bar__fill--energy"></div></div>
              <span class="hud-bar__value hud-value-energy">000</span>
            </div>
          </div>
          <div class="hud-status-row" aria-hidden="true">
            <span class="hud-chip hud-state-chip">Ground</span>
            <span class="hud-chip hud-lock-chip">LOCK: ON</span>
          </div>
        </div>

        <div class="hud-panel hud-panel--boss">
          <div class="hud-panel__eyebrow">Ground Boss</div>
          <div class="hud-boss-title">Colossus Placeholder</div>
          <div class="hud-bar hud-bar--boss">
            <div class="hud-bar__track"><div class="hud-bar__fill hud-bar__fill--boss"></div></div>
            <span class="hud-bar__value hud-value-boss">000</span>
          </div>
        </div>

        <div class="hud-reticle">
          <div class="hud-reticle__ring"></div>
          <div class="hud-reticle__cross"></div>
        </div>

        <div class="hud-lock-indicator">
          <div class="hud-lock-indicator__bracket hud-lock-indicator__bracket--tl"></div>
          <div class="hud-lock-indicator__bracket hud-lock-indicator__bracket--tr"></div>
          <div class="hud-lock-indicator__bracket hud-lock-indicator__bracket--bl"></div>
          <div class="hud-lock-indicator__bracket hud-lock-indicator__bracket--br"></div>
        </div>

        <div class="hud-toast"></div>
        <div class="hud-damage-flash"></div>
        <div class="hud-help">
          <span>WASD Move</span>
          <span>Space/Ctrl Up Down</span>
          <span>Shift Jet</span>
          <span>E Hover</span>
          <span>Q Lock</span>
          <span>RMB Look</span>
        </div>

        <div class="hud-end-overlay">
          <div class="hud-end-card">
            <div class="hud-end-eyebrow">Battle Status</div>
            <div class="hud-end-title">Mission Failed</div>
            <div class="hud-end-copy">Reboot the frame and re-engage.</div>
            <button class="hud-end-button" type="button">Retry</button>
          </div>
        </div>
      </div>
    `;

    this.shell = this.root.querySelector(".hud-shell");
    this.hpFill = this.root.querySelector(".hud-bar__fill--hp");
    this.energyFill = this.root.querySelector(".hud-bar__fill--energy");
    this.bossFill = this.root.querySelector(".hud-bar__fill--boss");
    this.hpValue = this.root.querySelector(".hud-value-hp");
    this.energyValue = this.root.querySelector(".hud-value-energy");
    this.bossValue = this.root.querySelector(".hud-value-boss");
    this.stateChip = this.root.querySelector(".hud-state-chip");
    this.lockChip = this.root.querySelector(".hud-lock-chip");
    this.bossPanel = this.root.querySelector(".hud-panel--boss");
    this.reticle = this.root.querySelector(".hud-reticle");
    this.lockIndicator = this.root.querySelector(".hud-lock-indicator");
    this.toast = this.root.querySelector(".hud-toast");
    this.damageFlash = this.root.querySelector(".hud-damage-flash");
    this.help = this.root.querySelector(".hud-help");
    this.endOverlay = this.root.querySelector(".hud-end-overlay");
    this.endTitle = this.root.querySelector(".hud-end-title");
    this.endCopy = this.root.querySelector(".hud-end-copy");
    this.retryButton = this.root.querySelector(".hud-end-button");

    this.retryButton?.addEventListener("click", () => {
      this.retryHandler?.();
    });
  }

  setRetryHandler(handler) {
    this.retryHandler = handler;
  }

  update({
    player,
    boss,
    isLocked,
    lockScreenPosition,
    damageFlashAmount,
    usingTouch,
    battleState,
  }) {
    const hpRatio = Math.max(0, player.hp / player.config.hp);
    const energyRatio = player.energy.ratio;
    const bossRatio = Math.max(0, boss.hp / boss.maxHp);
    const battleEnded = battleState !== "running";

    this.hpFill.style.transform = `scaleX(${hpRatio})`;
    this.energyFill.style.transform = `scaleX(${energyRatio})`;
    this.bossFill.style.transform = `scaleX(${bossRatio})`;
    this.hpValue.textContent = `${Math.ceil(player.hp)}`;
    this.energyValue.textContent = `${Math.ceil(player.energy.current)}`;
    this.bossValue.textContent = `${Math.ceil(boss.hp)}`;

    this.stateChip.textContent = player.state;
    this.lockChip.textContent = isLocked ? "LOCK: ON" : "LOCK: OFF";
    this.lockChip.classList.toggle("hud-chip--active", isLocked);

    this.bossPanel.classList.toggle("hud-panel--hidden", !isLocked && boss.hp <= 0);
    this.bossPanel.classList.toggle("hud-panel--faded", !isLocked);

    const showReticle = battleState === "running" && isLocked && lockScreenPosition;
    this.reticle.classList.toggle("hud-reticle--visible", Boolean(showReticle));
    this.lockIndicator.classList.toggle("hud-lock-indicator--visible", Boolean(showReticle));

    if (showReticle) {
      const x = lockScreenPosition.x;
      const y = lockScreenPosition.y;
      this.reticle.style.transform = `translate(${x}px, ${y}px)`;
      this.lockIndicator.style.transform = `translate(${x}px, ${y}px)`;
    }

    this.toast.textContent =
      battleState === "cleared"
        ? "Boss neutralized."
        : battleState === "failed"
          ? "Frame integrity lost."
          : player.state === "Jet"
            ? "Jet reduces damage instead of granting invulnerability."
            : isLocked
              ? "Lock-on camera is active."
              : "Right drag for free-look.";

    this.damageFlash.style.opacity = `${Math.max(0, damageFlashAmount)}`;
    this.help.classList.toggle("hud-help--touch", usingTouch);
    this.help.textContent = usingTouch
      ? ""
      : "WASD move / Space Ctrl / Shift / E / Q / LMB shoot / RMB look";

    this.shell.classList.toggle("hud-shell--touch", usingTouch);
    this.shell.classList.toggle("hud-shell--battle-ended", battleEnded);
    this.endOverlay.classList.toggle("hud-end-overlay--visible", battleEnded);

    if (battleState === "cleared") {
      this.endTitle.textContent = "Boss Destroyed";
      this.endCopy.textContent = "Arena secure. Launch again whenever you're ready.";
    } else if (battleState === "failed") {
      this.endTitle.textContent = "Mission Failed";
      this.endCopy.textContent = "Reboot the frame and dive straight back into the fight.";
    }
  }
}

export default HudView;
