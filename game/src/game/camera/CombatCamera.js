import * as THREE from "three";
import { gameConfig } from "../config.js";

function dampAngle(current, target, lambda, deltaSeconds) {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + delta * (1 - Math.exp(-lambda * deltaSeconds));
}

export class CombatCamera {
  constructor(camera) {
    this.camera = camera;
    this.config = gameConfig.camera;

    this.position = new THREE.Vector3(0, 8, 16);
    this.lookTarget = new THREE.Vector3(0, 3, 0);
    this.currentForward = new THREE.Vector3(0, 0, -1);
    this.planarForward = new THREE.Vector3(0, 0, -1);
    this.planarRight = new THREE.Vector3(1, 0, 0);

    this.lookYaw = Math.PI;
    this.lookPitch = 0.22;
    this.freeLookTimer = 0;
    this.lockSide = 1;

    this.tmpPlayerAnchor = new THREE.Vector3();
    this.tmpBossPoint = new THREE.Vector3();
    this.tmpCenter = new THREE.Vector3();
    this.tmpForward = new THREE.Vector3();
    this.tmpRight = new THREE.Vector3();
    this.tmpPosition = new THREE.Vector3();
    this.tmpLook = new THREE.Vector3();
    this.tmpMixed = new THREE.Vector3();
    this.tmpUp = new THREE.Vector3(0, 1, 0);
  }

  getPlanarBasis() {
    return {
      forward: this.planarForward,
      right: this.planarRight,
    };
  }

  getForwardVector(target = new THREE.Vector3()) {
    return target.copy(this.currentForward);
  }

  getAimDirection(origin, lockTarget) {
    if (lockTarget?.isAlive()) {
      return this.tmpForward
        .subVectors(lockTarget.getAimPoint(this.tmpBossPoint), origin)
        .normalize()
        .clone();
    }

    return this.tmpForward.subVectors(this.lookTarget, origin).normalize().clone();
  }

  setInitialLockSide(player, lockTarget) {
    if (!lockTarget) {
      return;
    }

    const playerForward = player.getForwardVector(this.tmpForward);
    const toBoss = this.tmpBossPoint
      .subVectors(lockTarget.getAimPoint(new THREE.Vector3()), player.getWorldPosition(new THREE.Vector3()))
      .setY(0)
      .normalize();
    const lateral = this.tmpRight.crossVectors(this.tmpUp, toBoss).normalize();
    this.lockSide = lateral.dot(playerForward) >= 0 ? 1 : -1;
  }

  update(deltaSeconds, { input, player, lockTarget, arena }) {
    const playerAnchor = player.getCameraAnchor(this.tmpPlayerAnchor);

    if (lockTarget?.isAlive()) {
      this.updateLockedCamera(deltaSeconds, player, playerAnchor, lockTarget, arena);
    } else {
      this.updateFreeCamera(deltaSeconds, input, player, playerAnchor, arena);
    }

    dampVector(this.position, this.tmpPosition, this.config.positionSmoothing, deltaSeconds);
    dampVector(this.lookTarget, this.tmpLook, this.config.targetSmoothing, deltaSeconds);

    this.currentForward.subVectors(this.lookTarget, this.position).normalize();
    this.planarForward.copy(this.currentForward).setY(0);

    if (this.planarForward.lengthSq() < 0.0001) {
      this.planarForward.set(0, 0, -1);
    } else {
      this.planarForward.normalize();
    }

    this.planarRight.crossVectors(this.tmpUp, this.planarForward).normalize();
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookTarget);
  }

  updateFreeCamera(deltaSeconds, input, player, playerAnchor, arena) {
    if (input.lookX !== 0 || input.lookY !== 0) {
      this.lookYaw -= input.lookX * this.config.freeLookSensitivity;
      this.lookPitch = THREE.MathUtils.clamp(
        this.lookPitch - input.lookY * this.config.freeLookSensitivity,
        this.config.freePitchMin,
        this.config.freePitchMax,
      );
      this.freeLookTimer = 1.7;
    } else {
      this.freeLookTimer = Math.max(0, this.freeLookTimer - deltaSeconds);
    }

    const playerForward = player.getForwardVector(this.tmpForward);
    const desiredYaw = Math.atan2(playerForward.x, playerForward.z);

    if (this.freeLookTimer <= 0) {
      this.lookYaw = dampAngle(this.lookYaw, desiredYaw, this.config.followTurnSpeed, deltaSeconds);
    }

    const cosPitch = Math.cos(this.lookPitch);
    const forward = this.tmpForward.set(
      Math.sin(this.lookYaw) * cosPitch,
      Math.sin(this.lookPitch),
      Math.cos(this.lookYaw) * cosPitch,
    ).normalize();
    const right = this.tmpRight.crossVectors(this.tmpUp, forward).normalize();

    this.tmpLook.copy(playerAnchor).addScaledVector(this.tmpUp, 0.6);
    this.tmpPosition
      .copy(this.tmpLook)
      .addScaledVector(right, this.config.freeShoulderOffset)
      .addScaledVector(forward, -this.config.freeDistance)
      .addScaledVector(this.tmpUp, this.config.freeHeight);

    this.clampAboveGround(arena, this.tmpPosition);
  }

  updateLockedCamera(deltaSeconds, player, playerAnchor, lockTarget, arena) {
    const targetPoint = lockTarget.getAimPoint(this.tmpBossPoint);
    const playerForward = player.getForwardVector(this.tmpForward);
    const toBoss = this.tmpMixed.subVectors(targetPoint, playerAnchor);
    const distance = Math.max(0.001, toBoss.length());
    const verticalDelta = Math.abs(toBoss.y);

    toBoss.normalize();

    const lateral = this.tmpRight.crossVectors(this.tmpUp, toBoss).normalize();
    const lateralDot = lateral.dot(playerForward);

    if (Math.abs(lateralDot) > 0.12) {
      this.lockSide = lateralDot >= 0 ? 1 : -1;
    }

    const framingForward = this.tmpForward
      .copy(toBoss)
      .multiplyScalar(0.72)
      .addScaledVector(playerForward, 0.28)
      .normalize();

    const desiredDistance = THREE.MathUtils.clamp(
      this.config.lockBaseDistance + distance * this.config.lockDistanceScale + verticalDelta * 0.75,
      this.config.lockMinDistance,
      this.config.lockMaxDistance,
    );
    const desiredHeight = this.config.lockHeightBase + verticalDelta * this.config.lockHeightScale;

    this.tmpCenter.lerpVectors(playerAnchor, targetPoint, 0.55);
    this.tmpLook.copy(this.tmpCenter).addScaledVector(this.tmpUp, 0.8);
    this.tmpPosition
      .copy(playerAnchor)
      .addScaledVector(framingForward, -desiredDistance)
      .addScaledVector(this.tmpUp, desiredHeight)
      .addScaledVector(lateral, this.lockSide * this.config.lockSideOffset);

    this.clampAboveGround(arena, this.tmpPosition);
  }

  clampAboveGround(arena, position) {
    const ground = arena.sampleHeight(position.x, position.z);
    position.y = Math.max(position.y, ground + 2.4);
  }
}

function dampVector(current, target, lambda, deltaSeconds) {
  const t = 1 - Math.exp(-lambda * deltaSeconds);
  current.lerp(target, t);
}

export default CombatCamera;
