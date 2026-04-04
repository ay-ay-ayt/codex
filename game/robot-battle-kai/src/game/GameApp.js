import * as THREE from "three";
import { gameConfig } from "./config.js";
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

export class GameApp {
  constructor() {
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
      0.1,
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

    this.ready = false;
    this.elapsed = 0;

    this.tmpOrigin = new THREE.Vector3();
    this.tmpForward = new THREE.Vector3();
    this.tmpLockPoint = new THREE.Vector3();
    this.tmpProjected = new THREE.Vector3();

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
    this.player.setSpawnPosition(this.world.getPlayerSpawnPosition(new THREE.Vector3()));

    this.setBootMessage("Deploying boss target...");
    this.boss = new BossActor();
    this.boss.addToScene(this.scene);
    this.boss.setSpawnPosition(this.world.getBossSpawnPosition(new THREE.Vector3()));

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
    this.combatCamera.update(1 / 60, {
      input: { lookX: 0, lookY: 0 },
      player: this.player,
      lockTarget: this.lockOn.target,
      arena: this.world,
    });

    this.input = new InputCoordinator({
      canvas: this.canvas,
      root: this.mobileControlsRoot,
    });
    this.input.setLockState(true);

    this.hud = new HudView(this.hudRoot);

    this.loop = new FixedStepLoop({
      update: (deltaSeconds) => this.update(deltaSeconds),
      render: () => this.render(),
    });

    this.ready = true;
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

    const input = this.input.consume();
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

    const shotAimDirection = this.combatCamera.getAimDirection(
      this.player.getMuzzleWorldPosition(this.tmpOrigin),
      targetBeforeMovement,
    );

    this.projectiles.update(deltaSeconds, {
      input,
      player: this.player,
      boss: this.boss,
      arena: this.world,
      aimDirection: shotAimDirection,
      lockTarget: targetBeforeMovement,
    });

    this.fx.update(deltaSeconds);

    const targetAfterCombat = this.lockOn.update(
      deltaSeconds,
      this.player.getAimOrigin(this.tmpOrigin),
      this.combatCamera.getForwardVector(this.tmpForward),
    );
    this.input.setLockState(Boolean(targetAfterCombat));

    this.combatCamera.update(deltaSeconds, {
      input,
      player: this.player,
      lockTarget: targetAfterCombat,
      arena: this.world,
    });

    this.hud.update({
      player: this.player,
      boss: this.boss,
      isLocked: Boolean(targetAfterCombat),
      lockScreenPosition: this.projectLockTarget(targetAfterCombat),
      damageFlashAmount: Math.min(this.player.damageFlash, 1) * 0.38,
      usingTouch: input.usingTouch,
    });
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
