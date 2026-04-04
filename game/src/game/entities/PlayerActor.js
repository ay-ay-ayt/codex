import * as THREE from "three";
import { GLTFLoader } from "../../../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { assetManifest } from "../assets/AssetManifest.js";
import { gameConfig, locomotionStates } from "../config.js";
import { EnergyPool } from "../systems/EnergyPool.js";

function dampVectorToward(current, target, lambda, deltaSeconds) {
  const t = 1 - Math.exp(-lambda * deltaSeconds);
  current.lerp(target, t);
}

function buildMaterialArray(materialOrMaterials, prepareMaterial) {
  if (Array.isArray(materialOrMaterials)) {
    return materialOrMaterials.map(prepareMaterial);
  }

  return prepareMaterial(materialOrMaterials);
}

export class PlayerActor {
  constructor() {
    this.config = gameConfig.player;
    this.energyRules = gameConfig.energy;

    this.group = new THREE.Group();
    this.group.name = "PlayerActor";

    this.visualRoot = new THREE.Group();
    this.visualRoot.name = "PlayerVisualRoot";
    this.group.add(this.visualRoot);

    this.modelRoot = new THREE.Group();
    this.modelRoot.name = "PlayerModelRoot";
    this.visualRoot.add(this.modelRoot);

    this.energy = new EnergyPool({ max: this.energyRules.max });
    this.hp = this.config.hp;
    this.state = locomotionStates.ground;
    this.hoverLatched = false;
    this.isAlive = true;
    this.damageFlash = 0;
    this.jetTimer = 0;

    this.position = this.group.position;
    this.velocity = new THREE.Vector3();
    this.horizontalVelocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.jetDirection = new THREE.Vector3(0, 0, -1);

    this.muzzleNode = new THREE.Object3D();
    this.visualRoot.add(this.muzzleNode);

    this.cameraAnchorNode = new THREE.Object3D();
    this.visualRoot.add(this.cameraAnchorNode);

    this.lockAnchorNode = new THREE.Object3D();
    this.visualRoot.add(this.lockAnchorNode);

    this.contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 28),
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      }),
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.04;
    this.group.add(this.contactShadow);

    this.presentationBaseHeight = 0;
    this.shadowBaseScale = 1.35;
    this.animationMixer = null;
    this.activeAnimationAction = null;

    this.boosterMaterials = [];
    this.coreMaterial = null;
    this.accentMaterials = [];

    this.modelBounds = new THREE.Box3();
    this.modelSize = new THREE.Vector3();
    this.modelCenter = new THREE.Vector3();

    this.tmpMoveDirection = new THREE.Vector3();
    this.tmpDesiredVelocity = new THREE.Vector3();
    this.tmpForward = new THREE.Vector3();
    this.tmpToTarget = new THREE.Vector3();
    this.tmpQuaternion = new THREE.Quaternion();
    this.tmpEuler = new THREE.Euler(0, 0, 0, "YXZ");
    this.tmpBox = new THREE.Box3();
    this.tmpBoxSize = new THREE.Vector3();
    this.tmpBoxCenter = new THREE.Vector3();
  }

  async initialize() {
    try {
      await this.loadPrimaryModel();
    } catch (error) {
      console.warn("Failed to load player model. Falling back to placeholder.", error);
      this.buildFallbackModel();
    }

    if (this.modelRoot.children.length === 0) {
      this.buildFallbackModel();
    }
  }

  async loadPrimaryModel() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(assetManifest.models.playerKwIi.scene);

    if (!gltf.scene) {
      throw new Error("Player GLB did not contain a scene.");
    }

    const sceneRoot = gltf.scene;
    sceneRoot.name = "KWIIPlayerModel";
    sceneRoot.rotation.y = this.config.modelAsset.rotationY;
    sceneRoot.scale.setScalar(this.config.modelScale);

    sceneRoot.traverse((object) => {
      if (!object.isMesh) {
        return;
      }

      object.material = buildMaterialArray(object.material, (material) => {
        if (!material?.clone) {
          return material;
        }

        const clonedMaterial = material.clone();

        if ("envMapIntensity" in clonedMaterial) {
          clonedMaterial.envMapIntensity = Math.max(clonedMaterial.envMapIntensity ?? 1, 0.95);
        }

        return clonedMaterial;
      });
    });

    this.modelRoot.add(sceneRoot);
    this.fitLoadedModel(sceneRoot);
    this.collectAccentMaterials(sceneRoot);
    this.setupAnimation(sceneRoot, gltf.animations ?? []);
  }

  fitLoadedModel(sceneRoot) {
    this.modelBounds.setFromObject(sceneRoot);
    this.modelBounds.getSize(this.modelSize);

    const safeHeight = Math.max(this.modelSize.y, 0.001);
    const scale = this.config.modelAsset.targetHeight / safeHeight;
    sceneRoot.scale.multiplyScalar(scale);

    this.modelBounds.setFromObject(sceneRoot);
    this.modelBounds.getCenter(this.modelCenter);
    sceneRoot.position.x -= this.modelCenter.x;
    sceneRoot.position.z -= this.modelCenter.z;
    sceneRoot.position.y -= this.modelBounds.min.y;

    this.modelBounds.setFromObject(sceneRoot);
    this.modelBounds.getSize(this.modelSize);

    this.presentationBaseHeight = 0;
    this.shadowBaseScale = THREE.MathUtils.clamp(
      Math.max(this.modelSize.x, this.modelSize.z) * 0.55,
      1.35,
      2.4,
    );
    this.configureAnchorsFromBounds(this.modelBounds);
  }

  configureAnchorsFromBounds(bounds) {
    bounds.getSize(this.tmpBoxSize);
    bounds.getCenter(this.tmpBoxCenter);

    const frontZ = bounds.min.z;
    const backZ = bounds.max.z;
    const muzzleZ = frontZ + this.tmpBoxSize.z * this.config.modelAsset.frontInsetRatio;
    const cameraZ = THREE.MathUtils.lerp(frontZ, backZ, this.config.modelAsset.cameraDepthRatio);

    this.muzzleNode.position.set(
      0,
      bounds.min.y + this.tmpBoxSize.y * this.config.modelAsset.muzzleHeightRatio,
      muzzleZ,
    );
    this.lockAnchorNode.position.set(
      0,
      bounds.min.y + this.tmpBoxSize.y * this.config.modelAsset.lockHeightRatio,
      frontZ + this.tmpBoxSize.z * 0.22,
    );
    this.cameraAnchorNode.position.set(
      0,
      bounds.min.y + this.tmpBoxSize.y * this.config.modelAsset.cameraHeightRatio,
      cameraZ,
    );
  }

  collectAccentMaterials(sceneRoot) {
    this.accentMaterials = [];

    sceneRoot.traverse((object) => {
      if (!object.isMesh) {
        return;
      }

      const materials = Array.isArray(object.material) ? object.material : [object.material];

      for (const material of materials) {
        if (
          material?.isMeshStandardMaterial &&
          material.emissive &&
          material.emissive.getHex() !== 0
        ) {
          this.accentMaterials.push({
            material,
            baseIntensity: material.emissiveIntensity ?? 1,
          });
        }
      }
    });
  }

  setupAnimation(sceneRoot, clips) {
    if (clips.length === 0) {
      return;
    }

    const preferredClip = clips.find((clip) =>
      /idle|hover|stand|breath/i.test(clip.name),
    ) ?? clips[0];

    this.animationMixer = new THREE.AnimationMixer(sceneRoot);
    this.activeAnimationAction = this.animationMixer.clipAction(preferredClip);
    this.activeAnimationAction.play();
  }

  buildFallbackModel() {
    this.presentationBaseHeight = 1.1;
    this.shadowBaseScale = 1.35;

    const armorMaterial = new THREE.MeshStandardMaterial({
      color: "#c4b49a",
      roughness: 0.42,
      metalness: 0.22,
      envMapIntensity: 0.55,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: "#5d6776",
      roughness: 0.5,
      metalness: 0.45,
    });
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: "#ffd199",
      emissive: "#ff8c3b",
      emissiveIntensity: 1.8,
      roughness: 0.18,
      metalness: 0.08,
    });
    this.coreMaterial = coreMaterial;

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 2.2, 1.5),
      armorMaterial,
    );
    torso.position.y = 1.45;
    this.modelRoot.add(torso);

    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 1),
      trimMaterial,
    );
    chest.position.set(0, 1.55, -0.86);
    this.modelRoot.add(chest);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 18, 18),
      coreMaterial,
    );
    core.position.set(0, 1.52, -0.98);
    this.modelRoot.add(core);

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.62, 1.45),
        armorMaterial,
      );
      shoulder.position.set(side * 1.35, 1.75, -0.12);
      this.modelRoot.add(shoulder);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 1.6, 0.46),
        trimMaterial,
      );
      arm.position.set(side * 1.45, 0.9, -0.18);
      this.modelRoot.add(arm);

      const legUpper = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 1.2, 0.8),
        armorMaterial,
      );
      legUpper.position.set(side * 0.52, 0.3, 0.08);
      this.modelRoot.add(legUpper);

      const legLower = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 1.25, 0.54),
        trimMaterial,
      );
      legLower.position.set(side * 0.48, -0.7, 0.14);
      this.modelRoot.add(legLower);

      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.2, 0.96),
        armorMaterial,
      );
      foot.position.set(side * 0.46, -1.45, -0.04);
      this.modelRoot.add(foot);

      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.78, 2),
        trimMaterial,
      );
      wing.position.set(side * 1.9, 1.4, 0.24);
      wing.rotation.z = side * -0.3;
      wing.rotation.x = 0.16;
      this.modelRoot.add(wing);

      const boosterMaterial = new THREE.MeshStandardMaterial({
        color: "#9fb2c8",
        emissive: "#5de3ff",
        emissiveIntensity: 0.25,
        roughness: 0.2,
        metalness: 0.28,
      });
      this.boosterMaterials.push(boosterMaterial);

      const booster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.26, 0.78, 16),
        boosterMaterial,
      );
      booster.rotation.x = Math.PI / 2;
      booster.position.set(side * 0.72, 0.65, 1.04);
      this.modelRoot.add(booster);
    }

    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.3, 0.7),
      trimMaterial,
    );
    backpack.position.set(0, 1.15, 1.06);
    this.modelRoot.add(backpack);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.48, 0.62),
      armorMaterial,
    );
    head.position.set(0, 2.62, -0.1);
    this.modelRoot.add(head);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.12, 0.12),
      new THREE.MeshStandardMaterial({
        color: "#b8f3ff",
        emissive: "#88e4ff",
        emissiveIntensity: 1.2,
        roughness: 0.12,
        metalness: 0.04,
      }),
    );
    visor.position.set(0, 2.62, -0.38);
    this.modelRoot.add(visor);

    this.muzzleNode.position.set(0, 1.55, -1.65);
    this.cameraAnchorNode.position.set(0, 1.9, 0.25);
    this.lockAnchorNode.position.set(0, 1.95, 0.2);
  }

  addToScene(scene) {
    scene.add(this.group);
  }

  setSpawnPosition(position) {
    this.position.copy(position);
  }

  getWorldPosition(target = new THREE.Vector3()) {
    return this.group.getWorldPosition(target);
  }

  getCameraAnchor(target = new THREE.Vector3()) {
    return this.cameraAnchorNode.getWorldPosition(target);
  }

  getAimOrigin(target = new THREE.Vector3()) {
    return this.lockAnchorNode.getWorldPosition(target);
  }

  getMuzzleWorldPosition(target = new THREE.Vector3()) {
    return this.muzzleNode.getWorldPosition(target);
  }

  getForwardVector(target = new THREE.Vector3()) {
    return target.copy(this.forward);
  }

  getAltitude(arena) {
    return Math.max(0, this.position.y - arena.sampleHeight(this.position.x, this.position.z));
  }

  getDamageMultiplier() {
    return this.state === locomotionStates.jet ? this.config.jetDamageMultiplier : 1;
  }

  takeDamage(amount) {
    if (!this.isAlive) {
      return 0;
    }

    const actualDamage = amount * this.getDamageMultiplier();
    this.hp = Math.max(0, this.hp - actualDamage);
    this.damageFlash = 1;

    if (this.hp <= 0) {
      this.isAlive = false;
    }

    return actualDamage;
  }

  update(deltaSeconds, { input, moveBasis, arena, lockTargetPosition, fx }) {
    if (!this.isAlive) {
      return;
    }

    const moveX = input.moveX;
    const moveY = input.moveY;
    const moveMagnitude = Math.min(Math.sqrt(moveX * moveX + moveY * moveY), 1);
    const moveDirection = this.computeMoveDirection(moveBasis, moveX, moveY);
    const groundHeight = arena.sampleHeight(this.position.x, this.position.z);
    const altitude = this.position.y - groundHeight;

    if (input.hoverTogglePressed) {
      this.hoverLatched = !this.hoverLatched;
    }

    const hoverIntent = this.hoverLatched || input.vertical > 0.16;

    if (input.jetHeld && this.state !== locomotionStates.jet) {
      this.tryStartJet(moveDirection, altitude, fx);
    }

    if (
      this.state === locomotionStates.ground &&
      hoverIntent &&
      this.energy.has(this.config.hoverRelightMinimum)
    ) {
      const lift = this.config.liftoffImpulse + Math.max(0, input.vertical) * this.config.ascendImpulse;
      this.enterHover(lift);
    }

    if (
      this.state === locomotionStates.fall &&
      hoverIntent &&
      this.energy.has(this.config.hoverRelightMinimum)
    ) {
      this.enterHover(Math.max(this.velocity.y, 0));
    }

    switch (this.state) {
      case locomotionStates.ground:
        this.updateGround(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight);
        break;
      case locomotionStates.hover:
        this.updateHover(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight, hoverIntent);
        break;
      case locomotionStates.fall:
        this.updateFall(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight, hoverIntent);
        break;
      case locomotionStates.jet:
        this.updateJet(deltaSeconds, input, arena, groundHeight, hoverIntent);
        break;
      default:
        break;
    }

    arena.clampToPlayArea(this.position);
    this.updateOrientation(deltaSeconds, moveDirection, lockTargetPosition);
    this.updatePresentation(deltaSeconds, altitude);
  }

  computeMoveDirection(moveBasis, moveX, moveY) {
    this.tmpMoveDirection
      .copy(moveBasis.right)
      .multiplyScalar(moveX)
      .addScaledVector(moveBasis.forward, moveY);

    if (this.tmpMoveDirection.lengthSq() > 1) {
      this.tmpMoveDirection.normalize();
    }

    return this.tmpMoveDirection;
  }

  tryStartJet(moveDirection, altitude, fx) {
    if (!this.energy.has(this.energyRules.jetMinimum)) {
      return false;
    }

    if (!this.energy.spendImmediate(this.energyRules.jetStartCost)) {
      return false;
    }

    this.state = locomotionStates.jet;
    this.jetTimer = 0;

    if (moveDirection.lengthSq() > 0.01) {
      this.jetDirection.copy(moveDirection).normalize();
    } else {
      this.jetDirection.copy(this.forward).setY(0);

      if (this.jetDirection.lengthSq() < 0.001) {
        this.jetDirection.set(0, 0, -1);
      } else {
        this.jetDirection.normalize();
      }
    }

    this.horizontalVelocity.copy(this.jetDirection).multiplyScalar(this.config.jetSpeed);
    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;
    this.velocity.y = altitude > 0.35 ? Math.max(this.velocity.y, 0.65) : 0;

    if (fx) {
      fx.spawnJetBurst(this.getMuzzleWorldPosition(new THREE.Vector3()), this.jetDirection);
    }

    return true;
  }

  enterHover(initialVerticalVelocity) {
    this.state = locomotionStates.hover;
    this.velocity.y = Math.max(this.velocity.y, initialVerticalVelocity);
  }

  updateGround(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight) {
    const fatigue = moveMagnitude > 0.05
      ? 0.72 + this.energy.spendContinuous(this.energyRules.groundMoveDrain, deltaSeconds) * 0.28
      : 1;

    this.energy.recover(this.energyRules.groundRegen, deltaSeconds);

    this.tmpDesiredVelocity.copy(moveDirection).multiplyScalar(this.config.groundSpeed * fatigue);
    this.tmpDesiredVelocity.y = 0;

    dampVectorToward(
      this.horizontalVelocity,
      this.tmpDesiredVelocity,
      moveMagnitude > 0.05 ? this.config.groundAcceleration : this.config.braking,
      deltaSeconds,
    );

    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;
    this.velocity.y = 0;

    this.position.addScaledVector(this.velocity, deltaSeconds);
    this.position.y = arena.sampleHeight(this.position.x, this.position.z);

    if (input.vertical > 0.16 && this.energy.has(this.config.hoverRelightMinimum)) {
      const lift = this.config.liftoffImpulse + input.vertical * this.config.ascendImpulse;
      this.enterHover(lift);
      this.position.y = Math.max(this.position.y, groundHeight + 0.02);
    }
  }

  updateHover(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight, hoverIntent) {
    const drainRatio = this.energy.spendContinuous(this.energyRules.hoverDrain, deltaSeconds);
    this.energy.recover(this.energyRules.airRegen, deltaSeconds);

    if (drainRatio < 1 || (!hoverIntent && input.vertical <= 0.05)) {
      this.state = locomotionStates.fall;
      return;
    }

    this.tmpDesiredVelocity.copy(moveDirection).multiplyScalar(this.config.hoverSpeed);
    dampVectorToward(
      this.horizontalVelocity,
      this.tmpDesiredVelocity,
      moveMagnitude > 0.05 ? this.config.airAcceleration : this.config.braking * 0.75,
      deltaSeconds,
    );

    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;

    const desiredVerticalSpeed = input.vertical * this.config.hoverVerticalSpeed;
    this.velocity.y = THREE.MathUtils.damp(
      this.velocity.y,
      desiredVerticalSpeed,
      this.config.hoverDamping,
      deltaSeconds,
    );

    this.position.addScaledVector(this.velocity, deltaSeconds);

    if (this.position.y <= groundHeight && this.velocity.y <= 0) {
      this.land(arena);
    }
  }

  updateFall(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight, hoverIntent) {
    this.energy.recover(this.energyRules.airRegen, deltaSeconds);

    this.tmpDesiredVelocity.copy(moveDirection).multiplyScalar(this.config.fallSpeed);
    dampVectorToward(
      this.horizontalVelocity,
      this.tmpDesiredVelocity,
      moveMagnitude > 0.05 ? this.config.airAcceleration * 0.7 : this.config.braking * 0.45,
      deltaSeconds,
    );

    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;
    this.velocity.y -= this.config.gravity * deltaSeconds;

    this.position.addScaledVector(this.velocity, deltaSeconds);

    if (this.position.y <= groundHeight) {
      this.land(arena);
      return;
    }

    if (hoverIntent && this.energy.has(this.config.hoverRelightMinimum)) {
      this.enterHover(Math.max(this.velocity.y * 0.4, -1.6));
    }
  }

  updateJet(deltaSeconds, input, arena, groundHeight, hoverIntent) {
    this.jetTimer += deltaSeconds;
    const sustainRatio = this.energy.spendContinuous(this.energyRules.jetDrain, deltaSeconds);
    this.energy.recover(this.energyRules.airRegen, deltaSeconds * 0.25);

    this.horizontalVelocity.copy(this.jetDirection).multiplyScalar(this.config.jetSpeed);
    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;

    if (this.position.y > groundHeight + 0.22) {
      this.velocity.y = THREE.MathUtils.damp(this.velocity.y, 0.15, 7, deltaSeconds);
    } else {
      this.velocity.y = 0;
    }

    this.position.addScaledVector(this.velocity, deltaSeconds);

    const endJet =
      sustainRatio < 1 ||
      !input.jetHeld ||
      this.jetTimer >= this.config.jetDurationCap;

    if (this.position.y <= groundHeight && this.velocity.y <= 0) {
      this.position.y = groundHeight;
    }

    if (!endJet) {
      return;
    }

    const altitude = this.position.y - arena.sampleHeight(this.position.x, this.position.z);

    if (altitude <= 0.05) {
      this.land(arena);
      return;
    }

    if (hoverIntent && this.energy.has(this.config.hoverMaintainMinimum)) {
      this.enterHover(Math.max(this.velocity.y, 0));
      return;
    }

    this.state = locomotionStates.fall;
  }

  land(arena) {
    this.state = locomotionStates.ground;
    this.velocity.set(0, 0, 0);
    this.horizontalVelocity.set(0, 0, 0);
    this.position.y = arena.sampleHeight(this.position.x, this.position.z);
  }

  updateOrientation(deltaSeconds, moveDirection, lockTargetPosition) {
    let desiredForward = this.tmpForward.copy(this.forward);

    if (lockTargetPosition) {
      desiredForward = this.tmpToTarget
        .subVectors(lockTargetPosition, this.getAimOrigin(new THREE.Vector3()))
        .setY(0);

      if (desiredForward.lengthSq() > 0.001) {
        desiredForward.normalize();
      } else {
        desiredForward.copy(this.forward);
      }

      if (moveDirection.lengthSq() > 0.03) {
        desiredForward
          .multiplyScalar(gameConfig.camera.orientationBossWeight)
          .addScaledVector(moveDirection, gameConfig.camera.orientationMoveWeight)
          .normalize();
      }
    } else if (moveDirection.lengthSq() > 0.03) {
      desiredForward.copy(moveDirection).normalize();
    } else if (this.horizontalVelocity.lengthSq() > 0.05) {
      desiredForward.copy(this.horizontalVelocity).setY(0).normalize();
    }

    dampVectorToward(this.forward, desiredForward, 10, deltaSeconds);
    this.forward.setY(0);

    if (this.forward.lengthSq() < 0.001) {
      this.forward.set(0, 0, -1);
    } else {
      this.forward.normalize();
    }

    const yaw = Math.atan2(this.forward.x, this.forward.z);
    this.tmpEuler.set(0, yaw, 0);
    this.tmpQuaternion.setFromEuler(this.tmpEuler);
    this.visualRoot.quaternion.slerp(this.tmpQuaternion, 1 - Math.exp(-11 * deltaSeconds));
  }

  updatePresentation(deltaSeconds, altitude) {
    if (this.animationMixer) {
      this.animationMixer.update(deltaSeconds);
    }

    this.damageFlash = Math.max(0, this.damageFlash - deltaSeconds * 4);

    const hoverFactor = this.state === locomotionStates.hover ? 1 : 0;
    const jetFactor = this.state === locomotionStates.jet ? 1 : 0;
    const groundFactor = this.state === locomotionStates.ground ? 1 : 0;
    const bob = Math.sin(performance.now() * 0.006) * (hoverFactor * 0.08 + jetFactor * 0.04);

    this.visualRoot.position.y = this.presentationBaseHeight + bob;
    this.visualRoot.rotation.z = this.horizontalVelocity.x * 0.012;
    this.visualRoot.rotation.x = -this.horizontalVelocity.z * 0.008;

    if (this.coreMaterial) {
      this.coreMaterial.emissiveIntensity =
        1.5 +
        hoverFactor * 0.55 +
        jetFactor * 1.25 +
        groundFactor * 0.08 +
        this.damageFlash * 1.2;
    } else {
      for (const accent of this.accentMaterials) {
        accent.material.emissiveIntensity =
          accent.baseIntensity +
          hoverFactor * 0.18 +
          jetFactor * 0.5 +
          this.damageFlash * 0.3;
      }
    }

    const boosterIntensity = 0.18 + hoverFactor * 0.8 + jetFactor * 1.7;

    for (const material of this.boosterMaterials) {
      material.emissiveIntensity = boosterIntensity;
    }

    const shadowFactor = THREE.MathUtils.clamp(1.18 - altitude * 0.11, 0.42, 1.18);
    this.contactShadow.scale.setScalar(this.shadowBaseScale * shadowFactor);
    this.contactShadow.material.opacity = THREE.MathUtils.clamp(
      0.28 - altitude * 0.016,
      0.06,
      0.28,
    );
  }
}

export default PlayerActor;
