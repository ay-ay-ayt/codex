import * as THREE from "three";
import { gameConfig, locomotionStates } from "./config.js";
import { FixedStepLoop } from "./loop/FixedStepLoop.js";
import { WastelandArena } from "./world/WastelandArena.js";
import { PlayerActor } from "./entities/PlayerActor.js";
import { BossActor } from "./entities/BossActor.js";
import { CombatCamera } from "./camera/CombatCamera.js";
import { LockOnSystem } from "./lockon/LockOnSystem.js";
import { ProjectileSystem } from "./combat/ProjectileSystem.js";
import { CombatFx } from "./combat/CombatFx.js";
import { InputCoordinator } from "./input/InputCoordinator.js";
import { HudView } from "./ui/HudView.js";
import { VerificationDebugOverlay } from "./debug/VerificationDebugOverlay.js";

export class GameApp {
  constructor({
    bootScenario = null,
    captureTag = null,
    buttonProbe = null,
    debugVisualization = false,
    forceTouchControls = false,
  } = {}) {
    this.canvas = document.querySelector(`#${gameConfig.runtimeCanvasId}`);
    this.hudRoot = document.querySelector(`#${gameConfig.hudRootId}`);
    this.mobileControlsRoot = document.querySelector(`#${gameConfig.mobileControlsRootId}`);
    this.bootOverlay = document.querySelector(`#${gameConfig.bootOverlayId}`);
    this.bootMessage = this.bootOverlay?.querySelector("[data-boot-message]");

    if (!(this.canvas instanceof HTMLCanvasElement)) {
      throw new Error("Runtime canvas was not found.");
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, gameConfig.renderer.pixelRatioCap));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = gameConfig.renderer.toneMappingExposure;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      52,
      window.innerWidth / window.innerHeight,
      gameConfig.renderer.cameraNear,
      460,
    );

    this.world = null;
    this.player = null;
    this.boss = null;
    this.lockOn = null;
    this.combatCamera = null;
    this.projectiles = null;
    this.fx = null;
    this.input = null;
    this.hud = null;
    this.loop = null;
    this.debugOverlay = null;
    this.debugStatusEl = null;

    this.ready = false;
    this.elapsed = 0;
    this.battleState = "running";
    this.debugVisualizationEnabled = Boolean(debugVisualization);
    this.bootScenario = bootScenario;
    this.captureTag = captureTag?.trim() || null;
    this.buttonProbe = buttonProbe?.trim() || null;
    this.forceTouchControls = Boolean(forceTouchControls);
    this.verificationScenario = null;

    this.playerSpawn = new THREE.Vector3();
    this.bossSpawn = new THREE.Vector3();
    this.tmpOrigin = new THREE.Vector3();
    this.tmpForward = new THREE.Vector3();
    this.tmpLockPoint = new THREE.Vector3();
    this.tmpProjected = new THREE.Vector3();
    this.tmpVerificationPosition = new THREE.Vector3();
    this.tmpVerificationBossPoint = new THREE.Vector3();
    this.tmpVerificationCameraPosition = new THREE.Vector3();
    this.tmpVerificationCameraLook = new THREE.Vector3();
    this.tmpVerificationForward = new THREE.Vector3();
    this.tmpVerificationRight = new THREE.Vector3();
    this.tmpVerificationUp = new THREE.Vector3(0, 1, 0);
    this.tmpPlayerAnchor = new THREE.Vector3();

    this.boundResize = this.onResize.bind(this);
    window.addEventListener("resize", this.boundResize);
  }

  async initialize() {
    this.setBootMessage("Loading wasteland arena...");
    this.addSceneLighting();

    this.world = new WastelandArena({
      scene: this.scene,
      renderer: this.renderer,
      config: gameConfig.arena,
    });
    await this.world.initialize();

    this.setBootMessage("Loading player frame...");
    this.player = new PlayerActor();
    await this.player.initialize();
    this.player.addToScene(this.scene);
    this.world.getPlayerSpawnPosition(this.playerSpawn);
    this.player.setSpawnPosition(this.playerSpawn);

    this.setBootMessage("Deploying boss target...");
    this.boss = new BossActor();
    this.boss.addToScene(this.scene);
    this.world.getBossSpawnPosition(this.bossSpawn);
    this.boss.setSpawnPosition(this.bossSpawn);

    this.fx = new CombatFx(this.scene);
    this.projectiles = new ProjectileSystem({
      scene: this.scene,
      fx: this.fx,
    });
    this.lockOn = new LockOnSystem(gameConfig.lockOn);
    this.lockOn.registerTarget(this.boss);
    this.lockOn.setInitialTarget(this.boss);

    this.combatCamera = new CombatCamera(this.camera);
    this.combatCamera.setInitialLockSide(this.player, this.lockOn.target);
    this.combatCamera.snap({
      input: { lookX: 0, lookY: 0 },
      player: this.player,
      lockTarget: this.lockOn.target,
      arena: this.world,
    });

    this.input = new InputCoordinator({
      canvas: this.canvas,
      root: this.mobileControlsRoot,
      forceTouchControls: this.forceTouchControls,
    });
    this.input.setLockState(true);
    this.input.setVerificationButtonProbe(this.buttonProbe);

    this.hud = new HudView(this.hudRoot);
    this.hud.setRetryHandler(() => {
      this.resetBattle();
    });
    this.debugOverlay = new VerificationDebugOverlay(this.scene);
    this.ensureDebugStatus();
    this.setDebugVisualization(this.debugVisualizationEnabled);

    this.loop = new FixedStepLoop({
      update: (deltaSeconds) => this.update(deltaSeconds),
      render: () => this.render(),
    });

    this.ready = true;

    if (this.bootScenario) {
      this.runVerificationScenario(this.bootScenario);
    }

    this.updateDocumentTitle();

    this.bootOverlay?.classList.add("boot-overlay--hidden");
    this.loop.start();
  }

  addSceneLighting() {
    const hemi = new THREE.HemisphereLight("#fff0d7", "#5a2f18", 1.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight("#ffd7a8", 1.85);
    key.position.set(18, 22, 10);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight("#8ccfff", 0.6);
    rim.position.set(-10, 14, -24);
    this.scene.add(rim);
  }

  update(deltaSeconds) {
    if (!this.ready) {
      return;
    }

    this.elapsed += deltaSeconds;

    const input = this.applyVerificationInput(
      deltaSeconds,
      this.input.consume(),
    );
    let targetForCamera = this.lockOn.target;

    if (this.battleState === "running") {
      const cameraForward = this.combatCamera.getForwardVector(this.tmpForward);
      const lockOrigin = this.player.getAimOrigin(this.tmpOrigin);

      if (input.lockTogglePressed) {
        const toggledTarget = this.lockOn.toggle(lockOrigin, cameraForward);

        if (toggledTarget) {
          this.combatCamera.setInitialLockSide(this.player, toggledTarget);
        }
      }

      const targetBeforeMovement = this.lockOn.target;
      const moveBasis = this.combatCamera.getPlanarBasis();

      this.player.update(deltaSeconds, {
        input,
        moveBasis,
        arena: this.world,
        lockTargetPosition: targetBeforeMovement?.getAimPoint(this.tmpLockPoint) ?? null,
        fx: this.fx,
      });

      this.boss.update(deltaSeconds, {
        player: this.player,
        arena: this.world,
        fx: this.fx,
      });

      if (!this.player.isAlive) {
        this.setBattleState("failed");
        targetForCamera = null;
      } else {
        targetForCamera = this.lockOn.update(
          deltaSeconds,
          this.player.getAimOrigin(this.tmpOrigin),
          this.combatCamera.getForwardVector(this.tmpForward),
        );
        this.input.setLockState(Boolean(targetForCamera));
        this.combatCamera.update(deltaSeconds, {
          input,
          player: this.player,
          lockTarget: targetForCamera,
          arena: this.world,
        });
        this.projectiles.update(deltaSeconds, {
          input,
          player: this.player,
          boss: this.boss,
          arena: this.world,
          combatCamera: this.combatCamera,
          lockTarget: targetForCamera,
        });

        if (!this.boss.isAlive()) {
          this.setBattleState("cleared");
          targetForCamera = null;
        }
      }

      this.fx.update(deltaSeconds);
    } else {
      this.fx.update(deltaSeconds);
      targetForCamera = null;
    }

    if (this.battleState !== "running") {
      this.input.setLockState(false);
      this.combatCamera.update(deltaSeconds, {
        input,
        player: this.player,
        lockTarget: targetForCamera,
        arena: this.world,
      });
    }

    this.applyVerificationCameraOverride(deltaSeconds);

    this.hud.update({
      player: this.player,
      boss: this.boss,
      isLocked: Boolean(targetForCamera),
      lockScreenPosition: this.projectLockTarget(targetForCamera),
      damageFlashAmount: Math.min(this.player.damageFlash, 1) * 0.38,
      usingTouch: input.usingTouch,
      battleState: this.battleState,
    });

    this.updateDebugOverlay();
    this.updateDocumentTitle();
  }

  setBattleState(nextState) {
    if (this.battleState === nextState) {
      return;
    }

    this.battleState = nextState;

    if (nextState !== "running") {
      this.lockOn.clear();
      this.input.reset();
      this.input.setLockState(false);
    }
  }

  resetBattle() {
    if (!this.ready) {
      return;
    }

    this.battleState = "running";
    this.input.reset();
    this.fx.clear();
    this.projectiles.clear();
    this.lockOn.clear();
    this.player.resetForBattle(this.playerSpawn);
    this.boss.resetForBattle(this.bossSpawn);
    this.lockOn.setInitialTarget(this.boss);
    this.input.setLockState(true);
    this.combatCamera.setInitialLockSide(this.player, this.boss);
    this.combatCamera.snap({
      input: { lookX: 0, lookY: 0 },
      player: this.player,
      lockTarget: this.lockOn.target,
      arena: this.world,
    });
    this.input.setVerificationButtonProbe(this.buttonProbe);
  }

  setDebugVisualization(enabled) {
    this.debugVisualizationEnabled = Boolean(enabled);
    this.debugOverlay?.setEnabled(this.debugVisualizationEnabled);
    this.ensureDebugStatus();

    if (this.debugStatusEl) {
      this.debugStatusEl.style.display = this.debugVisualizationEnabled ? "block" : "none";
    }
  }

  updateDebugOverlay() {
    if (!this.debugVisualizationEnabled || !this.debugOverlay) {
      return;
    }

    this.debugOverlay.update({
      scenario: this.verificationScenario?.name ?? null,
      player: this.player?.getDebugSnapshot?.() ?? null,
      projectiles: this.projectiles?.getDebugState?.() ?? null,
      fx: this.fx?.getDebugState?.() ?? null,
      camera: this.combatCamera?.getDebugState?.() ?? null,
      boss: this.boss?.isAlive()
        ? {
            aimPoint: this.boss.getAimPoint(new THREE.Vector3()),
          }
        : null,
    });
    this.updateDebugStatus();
  }

  ensureDebugStatus() {
    if (this.debugStatusEl) {
      return;
    }

    this.debugStatusEl = document.createElement("div");
    this.debugStatusEl.setAttribute("data-verification-status", "true");
    Object.assign(this.debugStatusEl.style, {
      position: "fixed",
      left: "18px",
      top: "224px",
      zIndex: "60",
      padding: "10px 12px",
      borderRadius: "12px",
      background: "rgba(17, 11, 9, 0.78)",
      color: "#f8efe4",
      fontFamily: "monospace",
      fontSize: "12px",
      lineHeight: "1.45",
      whiteSpace: "pre-line",
      pointerEvents: "none",
      display: this.debugVisualizationEnabled ? "block" : "none",
    });
    document.body.append(this.debugStatusEl);
  }

  updateDebugStatus() {
    if (!this.debugStatusEl) {
      return;
    }

    const playerDebug = this.player?.getDebugSnapshot?.();
    const projectileDebug = this.projectiles?.getDebugState?.();
    const cameraMode = this.lockOn?.target ? "lock" : "free";
    const barrelLabel = projectileDebug?.lastShot
      ? projectileDebug.lastShot.barrelIndex === 0 ? "left" : "right"
      : "none";
    const formatVector = (vector) => vector
      ? `${vector.x.toFixed(2)}, ${vector.y.toFixed(2)}, ${vector.z.toFixed(2)}`
      : "n/a";

    this.debugStatusEl.textContent = [
      `scenario: ${this.verificationScenario?.name ?? "none"}`,
      `probe: ${this.buttonProbe ?? "none"}`,
      `tag: ${this.captureTag ?? "none"}`,
      `camera: ${cameraMode}`,
      `state: ${this.player?.state ?? "n/a"}`,
      `anim: ${playerDebug?.animation?.active ?? "n/a"}`,
      `legs: ${playerDebug?.animation?.legAngles?.left?.toFixed?.(1) ?? "n/a"} / ${playerDebug?.animation?.legAngles?.right?.toFixed?.(1) ?? "n/a"}`,
      `shot: ${barrelLabel}`,
      `rawJet0: ${formatVector(playerDebug?.rawJetAnchors?.[0]?.position)}`,
      `rawJet1: ${formatVector(playerDebug?.rawJetAnchors?.[1]?.position)}`,
      `jet0: ${formatVector(playerDebug?.jetAnchors?.[0]?.position)}`,
      `jet1: ${formatVector(playerDebug?.jetAnchors?.[1]?.position)}`,
      `jetC: ${formatVector(playerDebug?.jetAnchors?.[2]?.position)}`,
      `raw0: ${formatVector(playerDebug?.rawGunAnchors?.[0]?.position)}`,
      `raw1: ${formatVector(playerDebug?.rawGunAnchors?.[1]?.position)}`,
      `muzzle0: ${formatVector(playerDebug?.gunAnchors?.[0]?.position)}`,
      `muzzle1: ${formatVector(playerDebug?.gunAnchors?.[1]?.position)}`,
      `shotOrigin: ${formatVector(projectileDebug?.lastShot?.origin)}`,
    ].join("\n");
  }

  updateDocumentTitle() {
    const activeAnimation = this.player?.getDebugSnapshot?.()?.animation?.active ?? "n/a";
    const titleParts = [gameConfig.projectName];
    const cameraDebug = this.combatCamera?.getDebugState?.() ?? null;
    const playerForward = this.player?.getForwardVector(new THREE.Vector3()) ?? null;
    const playerAnchor = this.player?.getCameraAnchor(new THREE.Vector3()) ?? null;
    const playerPosition = this.player?.getWorldPosition(new THREE.Vector3()) ?? null;
    const playerDebug = this.player?.getDebugSnapshot?.() ?? null;
    const projectileDebug = this.projectiles?.getDebugState?.() ?? null;

    if (this.captureTag && this.ready) {
      titleParts.push(`ready-capture=${this.captureTag}`);
    }

    if (this.verificationScenario?.name) {
      titleParts.push(this.verificationScenario.name);
    } else if (this.buttonProbe) {
      titleParts.push(`button=${this.buttonProbe}`);
    }

    titleParts.push(activeAnimation);

    if (this.debugVisualizationEnabled) {
      const animationTime = playerDebug?.animation?.time;
      titleParts.push(
        Number.isFinite(animationTime)
          ? `animt=${animationTime.toFixed(2)}`
          : "animt=n/a",
      );
      titleParts.push(`act=${playerDebug?.animation?.hasAction ? 1 : 0}`);
    }

    if (this.debugVisualizationEnabled && cameraDebug?.position && cameraDebug?.lookTarget) {
      const vectors = [cameraDebug.position, cameraDebug.lookTarget];
      const allFinite = vectors.every((vector) =>
        Number.isFinite(vector.x) &&
        Number.isFinite(vector.y) &&
        Number.isFinite(vector.z),
      );

      if (allFinite) {
        titleParts.push(
          `cam=${cameraDebug.position.x.toFixed(1)},${cameraDebug.position.y.toFixed(1)},${cameraDebug.position.z.toFixed(1)}`,
        );
        titleParts.push(
          `look=${cameraDebug.lookTarget.x.toFixed(1)},${cameraDebug.lookTarget.y.toFixed(1)},${cameraDebug.lookTarget.z.toFixed(1)}`,
        );
      } else {
        titleParts.push("cam=NaN");
      }
    }

    if (this.debugVisualizationEnabled && playerForward) {
      const forwardFinite =
        Number.isFinite(playerForward.x) &&
        Number.isFinite(playerForward.y) &&
        Number.isFinite(playerForward.z);
      titleParts.push(
        forwardFinite
          ? `fwd=${playerForward.x.toFixed(2)},${playerForward.y.toFixed(2)},${playerForward.z.toFixed(2)}`
          : "fwd=NaN",
      );
    }

    if (this.debugVisualizationEnabled && playerAnchor) {
      const anchorFinite =
        Number.isFinite(playerAnchor.x) &&
        Number.isFinite(playerAnchor.y) &&
        Number.isFinite(playerAnchor.z);
      titleParts.push(
        anchorFinite
          ? `anchor=${playerAnchor.x.toFixed(1)},${playerAnchor.y.toFixed(1)},${playerAnchor.z.toFixed(1)}`
          : "anchor=NaN",
      );
    }

    if (this.debugVisualizationEnabled && playerPosition) {
      const positionFinite =
        Number.isFinite(playerPosition.x) &&
        Number.isFinite(playerPosition.y) &&
        Number.isFinite(playerPosition.z);
      titleParts.push(
        positionFinite
          ? `pos=${playerPosition.x.toFixed(1)},${playerPosition.y.toFixed(1)},${playerPosition.z.toFixed(1)}`
          : "pos=NaN",
      );
    }

    if (this.debugVisualizationEnabled && playerDebug?.jetAnchors?.[0]?.position) {
      const jet0 = playerDebug.jetAnchors[0].position;
      const jet1 = playerDebug.jetAnchors[1]?.position ?? null;
      titleParts.push(`j0=${jet0.x.toFixed(1)},${jet0.y.toFixed(1)},${jet0.z.toFixed(1)}`);

      if (jet1) {
        titleParts.push(`j1=${jet1.x.toFixed(1)},${jet1.y.toFixed(1)},${jet1.z.toFixed(1)}`);
      }
    }

    if (this.debugVisualizationEnabled && playerDebug?.animation?.legAngles) {
      const leftLeg = playerDebug.animation.legAngles.left;
      const rightLeg = playerDebug.animation.legAngles.right;

      if (Number.isFinite(leftLeg) && Number.isFinite(rightLeg)) {
        titleParts.push(`legs=${leftLeg.toFixed(1)},${rightLeg.toFixed(1)}`);
      }
    }

    if (this.debugVisualizationEnabled && playerDebug?.gunAnchors?.[0]?.position) {
      const muzzle0 = playerDebug.gunAnchors[0].position;
      const muzzle1 = playerDebug.gunAnchors[1]?.position ?? null;
      titleParts.push(`m0=${muzzle0.x.toFixed(1)},${muzzle0.y.toFixed(1)},${muzzle0.z.toFixed(1)}`);

      if (muzzle1) {
        titleParts.push(`m1=${muzzle1.x.toFixed(1)},${muzzle1.y.toFixed(1)},${muzzle1.z.toFixed(1)}`);
      }
    }

    if (this.debugVisualizationEnabled && projectileDebug?.lastShot?.origin) {
      const shotOrigin = projectileDebug.lastShot.origin;
      titleParts.push(`shot=${shotOrigin.x.toFixed(1)},${shotOrigin.y.toFixed(1)},${shotOrigin.z.toFixed(1)}`);
    }

    document.title = titleParts.join(" | ");
  }

  runVerificationScenario(name) {
    const normalizedName = typeof name === "string" ? name.trim() : "";

    if (!normalizedName) {
      this.clearVerificationScenario();
      return false;
    }

    if (!this.ready) {
      this.bootScenario = normalizedName;
      return true;
    }

    this.verificationScenario = {
      name: normalizedName,
      elapsed: 0,
      initialized: false,
      fired: false,
    };
    this.resetBattle();
    this.updateDocumentTitle();
    return true;
  }

  clearVerificationScenario() {
    this.verificationScenario = null;
    this.updateDocumentTitle();
  }

  setVerificationButtonProbe(action) {
    const normalizedAction = typeof action === "string" ? action.trim() : "";
    this.buttonProbe = normalizedAction || null;
    this.input?.setVerificationButtonProbe(this.buttonProbe);
    this.updateDocumentTitle();
  }

  applyVerificationInput(deltaSeconds, liveInput) {
    if (!this.verificationScenario || !this.ready) {
      return liveInput;
    }

    const scenario = this.verificationScenario;

    if (!scenario.initialized) {
      this.setupVerificationScenario(scenario);
    }

    scenario.elapsed += deltaSeconds;
    this.player.energy.current = this.player.energy.max;
    this.player.hp = this.player.config.hp;
    this.boss.hp = Math.max(this.boss.hp, 1);

    const input = {
      moveX: 0,
      moveY: 0,
      vertical: 0,
      shootHeld: false,
      jetPressed: false,
      hoverTogglePressed: false,
      lockTogglePressed: false,
      lookX: 0,
      lookY: 0,
      usingTouch: false,
    };

    this.applyVerificationScenarioFrame(scenario, input, deltaSeconds);
    return input;
  }

  setupVerificationScenario(scenario) {
    scenario.initialized = true;
    scenario.elapsed = 0;
    scenario.fired = false;

    this.fx.clear();
    this.projectiles.clear();
    this.input.reset();
    this.boss.resetForBattle(this.bossSpawn);

    switch (scenario.name) {
      case "rear-jets-hover":
        this.positionPlayerForVerification({
          x: 0,
          z: 108,
          altitude: 4.5,
          state: locomotionStates.hover,
          hoverLatched: true,
        });
        this.syncVerificationLockState(false);
        break;
      case "rear-jets-jet":
        this.positionPlayerForVerification({
          x: 0,
          z: 116,
          altitude: 0,
          state: locomotionStates.ground,
          hoverLatched: false,
        });
        this.syncVerificationLockState(false);
        break;
      case "left-barrel-fire":
      case "right-barrel-fire":
      case "left-barrel-fire-moving":
      case "right-barrel-fire-moving":
        this.positionPlayerForVerification({
          x: 0,
          z: 90,
          altitude: 0,
          state: locomotionStates.ground,
          hoverLatched: false,
        });
        this.syncVerificationLockState(false);
        break;
      case "ground-walk":
      case "ground-run":
      case "ground-turn":
        this.positionPlayerForVerification({
          x: 0,
          z: 110,
          altitude: 0,
          state: locomotionStates.ground,
          hoverLatched: false,
        });
        this.syncVerificationLockState(false);
        break;
      case "high-air-lock":
        this.positionPlayerForVerification({
          x: 0,
          z: 102,
          altitude: 34,
          state: locomotionStates.hover,
          hoverLatched: true,
        });
        this.syncVerificationLockState(true);
        break;
      default:
        this.syncVerificationLockState(false);
        break;
    }

    this.snapCameraToScenario();
  }

  applyVerificationScenarioFrame(scenario, input, deltaSeconds) {
    this.applyVerificationCameraPreset(scenario.name);

    switch (scenario.name) {
      case "rear-jets-hover":
        this.player.hoverLatched = true;
        this.syncVerificationLockState(false);
        break;
      case "rear-jets-jet":
        input.moveY = 1;
        input.jetPressed = scenario.elapsed <= deltaSeconds * 1.25 && this.player.state !== locomotionStates.jet;
        this.syncVerificationLockState(false);
        this.player.hoverLatched = false;

        if (this.player.position.z < 46) {
          this.positionPlayerForVerification({
            x: 0,
            z: 116,
            altitude: 0,
            state: locomotionStates.ground,
            hoverLatched: false,
          });
          this.fx.clear();
          this.projectiles.clear();
          this.snapCameraToScenario();
        }
        break;
      case "left-barrel-fire":
      case "right-barrel-fire":
      case "left-barrel-fire-moving":
      case "right-barrel-fire-moving":
        this.syncVerificationLockState(false);
        this.projectiles.nextBarrelIndex =
          scenario.name === "left-barrel-fire" || scenario.name === "left-barrel-fire-moving"
            ? 0
            : 1;
        input.shootHeld = true;

        if (
          scenario.name === "left-barrel-fire-moving" ||
          scenario.name === "right-barrel-fire-moving"
        ) {
          input.moveY = 0.76;
          input.moveX = scenario.name === "left-barrel-fire-moving" ? -0.52 : 0.52;
        }

        if (scenario.elapsed >= 1.05) {
          scenario.elapsed = 0;
          this.fx.clear();
          this.projectiles.clear();
          this.positionPlayerForVerification({
            x: 0,
            z: 90,
            altitude: 0,
            state: locomotionStates.ground,
            hoverLatched: false,
          });
          this.snapCameraToScenario();
        }
        break;
      case "ground-walk":
        input.moveY = 0.56;
        this.syncVerificationLockState(false);

        if (this.player.position.z < 62) {
          this.positionPlayerForVerification({
            x: 0,
            z: 110,
            altitude: 0,
            state: locomotionStates.ground,
            hoverLatched: false,
          });
          this.snapCameraToScenario();
        }
        break;
      case "ground-run":
        input.moveY = 1;
        this.syncVerificationLockState(false);

        if (this.player.position.z < 58) {
          this.positionPlayerForVerification({
            x: 0,
            z: 110,
            altitude: 0,
            state: locomotionStates.ground,
            hoverLatched: false,
          });
          this.snapCameraToScenario();
        }
        break;
      case "ground-turn":
        input.moveY = 0.72;
        input.moveX = Math.sin(scenario.elapsed * 5.8) * 0.94;
        this.syncVerificationLockState(false);

        if (scenario.elapsed >= 1.35 || this.player.position.z < 66) {
          scenario.elapsed = 0;
          this.positionPlayerForVerification({
            x: 0,
            z: 110,
            altitude: 0,
            state: locomotionStates.ground,
            hoverLatched: false,
          });
          this.snapCameraToScenario();
        }
        break;
      case "high-air-lock":
        this.player.hoverLatched = true;
        this.syncVerificationLockState(true);

        if (Math.abs(this.player.getAltitude(this.world) - 34) > 1.2) {
          this.positionPlayerForVerification({
            x: 0,
            z: 102,
            altitude: 34,
            state: locomotionStates.hover,
            hoverLatched: true,
          });
          this.snapCameraToScenario();
        }
        break;
      default:
        break;
    }
  }

  positionPlayerForVerification({
    x,
    z,
    altitude,
    state,
    hoverLatched,
  }) {
    const groundY = this.world.sampleHeight(x, z);

    this.tmpVerificationPosition.set(x, groundY + altitude, z);
    this.player.setSpawnPosition(this.tmpVerificationPosition);
    this.player.state = state;
    this.player.hoverLatched = hoverLatched;
    this.player.jetTimer = 0;
    this.player.velocity.set(0, 0, 0);
    this.player.horizontalVelocity.set(0, 0, 0);
    this.player.forward.set(0, 0, -1);
    this.player.jetDirection.set(0, 0, -1);
    this.player.group.updateMatrixWorld(true);
  }

  syncVerificationLockState(locked) {
    if (locked) {
      this.lockOn.setInitialTarget(this.boss);
      this.input.setLockState(true);
      return;
    }

    this.lockOn.clear();
    this.input.setLockState(false);
  }

  snapCameraToScenario() {
    this.applyVerificationCameraPreset(this.verificationScenario?.name);
    this.combatCamera.setInitialLockSide(this.player, this.lockOn.target);
    this.combatCamera.snap({
      input: { lookX: 0, lookY: 0 },
      player: this.player,
      lockTarget: this.lockOn.target,
      arena: this.world,
    });
  }

  applyVerificationCameraPreset(scenarioName) {
    if (!this.combatCamera || !scenarioName) {
      return;
    }

    switch (scenarioName) {
      case "rear-jets-hover":
      case "rear-jets-jet":
        this.combatCamera.lookYaw = Math.PI;
        this.combatCamera.lookPitch = 0.24;
        this.combatCamera.freeLookTimer = 999;
        break;
      case "left-barrel-fire":
      case "left-barrel-fire-moving":
        this.combatCamera.lookYaw = Math.PI + 0.88;
        this.combatCamera.lookPitch = 0.2;
        this.combatCamera.freeLookTimer = 999;
        break;
      case "right-barrel-fire":
      case "right-barrel-fire-moving":
        this.combatCamera.lookYaw = Math.PI - 0.88;
        this.combatCamera.lookPitch = 0.2;
        this.combatCamera.freeLookTimer = 999;
        break;
      case "ground-walk":
      case "ground-run":
      case "ground-turn":
        this.combatCamera.lookYaw = Math.PI - Math.PI / 2;
        this.combatCamera.lookPitch = 0.08;
        this.combatCamera.freeLookTimer = 999;
        break;
      default:
        break;
    }
  }

  applyVerificationCameraOverride(deltaSeconds) {
    if (!this.verificationScenario || !this.combatCamera || !this.player) {
      return;
    }

    const playerAnchor = this.player.getCameraAnchor(this.tmpPlayerAnchor);
    const playerBase = this.player.getWorldPosition(this.tmpVerificationPosition);
    const playerForward = this.player.getForwardVector(this.tmpVerificationForward).setY(0);

    if (playerForward.lengthSq() < 0.0001) {
      playerForward.set(0, 0, -1);
    } else {
      playerForward.normalize();
    }

    this.tmpVerificationRight
      .set(-playerForward.z, 0, playerForward.x)
      .normalize();

    const cameraPosition = this.tmpVerificationCameraPosition;
    const cameraLook = this.tmpVerificationCameraLook;

    switch (this.verificationScenario.name) {
      case "rear-jets-hover":
      case "rear-jets-jet":
        cameraPosition
          .copy(playerBase)
          .addScaledVector(playerForward, -10.2)
          .addScaledVector(this.tmpVerificationUp, 5.4)
          .addScaledVector(this.tmpVerificationRight, 1.95);
        cameraLook
          .copy(playerBase)
          .addScaledVector(this.tmpVerificationUp, 3.2)
          .addScaledVector(this.tmpVerificationRight, 0.32);
        break;
      case "left-barrel-fire": {
        cameraPosition
          .copy(playerBase)
          .addScaledVector(playerForward, -6.4)
          .addScaledVector(this.tmpVerificationUp, 4.05)
          .addScaledVector(this.tmpVerificationRight, -5.6);
        cameraLook
          .copy(playerBase)
          .addScaledVector(playerForward, 1.8)
          .addScaledVector(this.tmpVerificationUp, 3.0)
          .addScaledVector(this.tmpVerificationRight, -2.2);
        break;
      }
      case "right-barrel-fire": {
        cameraPosition
          .copy(playerBase)
          .addScaledVector(playerForward, -6.4)
          .addScaledVector(this.tmpVerificationUp, 4.05)
          .addScaledVector(this.tmpVerificationRight, 5.6);
        cameraLook
          .copy(playerBase)
          .addScaledVector(playerForward, 1.8)
          .addScaledVector(this.tmpVerificationUp, 3.0)
          .addScaledVector(this.tmpVerificationRight, 2.2);
        break;
      }
      case "left-barrel-fire-moving": {
        cameraPosition
          .copy(playerBase)
          .addScaledVector(playerForward, -7.2)
          .addScaledVector(this.tmpVerificationUp, 4.2)
          .addScaledVector(this.tmpVerificationRight, -5.95);
        cameraLook
          .copy(playerBase)
          .addScaledVector(playerForward, 2.0)
          .addScaledVector(this.tmpVerificationUp, 3.08)
          .addScaledVector(this.tmpVerificationRight, -2.45);
        break;
      }
      case "right-barrel-fire-moving": {
        cameraPosition
          .copy(playerBase)
          .addScaledVector(playerForward, -7.2)
          .addScaledVector(this.tmpVerificationUp, 4.2)
          .addScaledVector(this.tmpVerificationRight, 5.95);
        cameraLook
          .copy(playerBase)
          .addScaledVector(playerForward, 2.0)
          .addScaledVector(this.tmpVerificationUp, 3.08)
          .addScaledVector(this.tmpVerificationRight, 2.45);
        break;
      }
      case "ground-walk":
      case "ground-run":
      case "ground-turn":
        cameraPosition
          .copy(playerBase)
          .addScaledVector(playerForward, -0.9)
          .addScaledVector(this.tmpVerificationUp, 2.7)
          .addScaledVector(this.tmpVerificationRight, 11.4);
        cameraLook
          .copy(playerBase)
          .addScaledVector(playerForward, 0.45)
          .addScaledVector(this.tmpVerificationUp, 1.92);
        break;
      default:
        return;
    }

    this.combatCamera.position.copy(cameraPosition);
    this.combatCamera.lookTarget.copy(cameraLook);
    this.combatCamera.applyCameraState(this.player, deltaSeconds);
  }

  projectLockTarget(lockTarget) {
    if (!lockTarget?.isAlive()) {
      return null;
    }

    const point = lockTarget.getAimPoint(this.tmpProjected).project(this.camera);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const margin = gameConfig.ui.reticleMargin;

    let x = (point.x * 0.5 + 0.5) * width;
    let y = (-point.y * 0.5 + 0.5) * height;

    if (point.z > 1) {
      x = width * (point.x >= 0 ? 0.92 : 0.08);
      y = height * (point.y >= 0 ? 0.12 : 0.88);
    }

    x = THREE.MathUtils.clamp(x, margin, width - margin);
    y = THREE.MathUtils.clamp(y, margin, height - margin);

    return { x, y };
  }

  render() {
    if (!this.ready) {
      return;
    }

    this.renderer.render(this.scene, this.camera);
  }

  setBootMessage(message) {
    if (this.bootMessage) {
      this.bootMessage.textContent = message;
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, gameConfig.renderer.pixelRatioCap));
  }
}

export default GameApp;
