import * as THREE from "three";
import { gameConfig, locomotionStates } from "../config.js";

function dampAngle(current, target, lambda, deltaSeconds) {
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + delta * (1 - Math.exp(-lambda * deltaSeconds));
}

function isFiniteVector(vector) {
  return (
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  );
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
    this.movementPlanarForward = new THREE.Vector3(0, 0, -1);
    this.movementPlanarRight = new THREE.Vector3(1, 0, 0);

    this.lookYaw = Math.PI;
    this.lookPitch = 0;
    this.freeLookTimer = 0;
    this.lockSide = 1;
    this.baseFov = camera.fov;
    this.wasLockedLastFrame = false;

    this.tmpPlayerAnchor = new THREE.Vector3();
    this.tmpBossPoint = new THREE.Vector3();
    this.tmpCenter = new THREE.Vector3();
    this.tmpForward = new THREE.Vector3();
    this.tmpRight = new THREE.Vector3();
    this.tmpPosition = new THREE.Vector3();
    this.tmpLook = new THREE.Vector3();
    this.tmpMixed = new THREE.Vector3();
    this.tmpUp = new THREE.Vector3(0, 1, 0);
    this.tmpOffset = new THREE.Vector3();
    this.tmpPlanarOffset = new THREE.Vector3();
    this.tmpAimPoint = new THREE.Vector3();
    this.tmpCameraDirection = new THREE.Vector3();
    this.tmpScreenA = new THREE.Vector3();
    this.tmpScreenB = new THREE.Vector3();
    this.ndcProbeCamera = new THREE.PerspectiveCamera(
      camera.fov,
      camera.aspect,
      camera.near,
      camera.far,
    );
  }

  getPlanarBasis() {
    if (
      !isFiniteVector(this.movementPlanarForward) ||
      this.movementPlanarForward.lengthSq() < 0.0001
    ) {
      this.movementPlanarForward.set(0, 0, -1);
    }

    if (
      !isFiniteVector(this.movementPlanarRight) ||
      this.movementPlanarRight.lengthSq() < 0.0001
    ) {
      this.movementPlanarRight.set(1, 0, 0);
    }

    return {
      forward: this.movementPlanarForward,
      right: this.movementPlanarRight,
    };
  }

  getForwardVector(target = new THREE.Vector3()) {
    return target.copy(this.currentForward);
  }

  getAirborneFactor(player, arena) {
    return THREE.MathUtils.clamp(player.getAltitude(arena) / 18, 0, 1);
  }

  getAimPoint(lockTarget, target = new THREE.Vector3()) {
    if (lockTarget?.isAlive()) {
      return lockTarget.getAimPoint(target);
    }

    const aimDirection = this.camera.getWorldDirection(this.tmpCameraDirection);
    const planarAim = this.tmpMixed.copy(this.movementPlanarForward);

    if (!isFiniteVector(aimDirection) || aimDirection.lengthSq() < 0.0001) {
      aimDirection.copy(this.currentForward);
    }

    if (!isFiniteVector(aimDirection) || aimDirection.lengthSq() < 0.0001) {
      aimDirection.set(0, 0, -1);
    } else {
      aimDirection.normalize();
    }

    if (!isFiniteVector(planarAim) || planarAim.lengthSq() < 0.0001) {
      planarAim.copy(this.currentForward).setY(0);
    }

    if (!isFiniteVector(planarAim) || planarAim.lengthSq() < 0.0001) {
      planarAim.set(0, 0, -1);
    } else {
      planarAim.normalize();
    }

    const downwardBias = THREE.MathUtils.clamp((-aimDirection.y - 0.01) / 0.22, 0, 1);
    const planarBlend = 0.18 + downwardBias * 0.7;
    aimDirection.lerp(planarAim, planarBlend);
    aimDirection.y = Math.max(aimDirection.y, -0.015);
    aimDirection.normalize();

    return target
      .copy(this.camera.position)
      .addScaledVector(aimDirection, this.config.freeAimDistance);
  }

  getAimDirection(origin, lockTarget, target = new THREE.Vector3()) {
    return target
      .subVectors(this.getAimPoint(lockTarget, this.tmpAimPoint), origin)
      .normalize();
  }

  composeCombatFrame({
    playerAnchor,
    framingForward,
    lateralDirection,
    lookTarget,
    distance,
    height,
    shoulderOffset,
  }) {
    this.tmpLook.copy(lookTarget);
    this.tmpPosition
      .copy(playerAnchor)
      .addScaledVector(framingForward, -distance)
      .addScaledVector(this.tmpUp, height)
      .addScaledVector(lateralDirection, shoulderOffset);
  }

  setMovementBasisFromForward(sourceForward) {
    this.movementPlanarForward.copy(sourceForward).setY(0);

    if (
      !isFiniteVector(this.movementPlanarForward) ||
      this.movementPlanarForward.lengthSq() < 0.0001
    ) {
      this.movementPlanarForward.copy(this.planarForward);
    }

    if (
      !isFiniteVector(this.movementPlanarForward) ||
      this.movementPlanarForward.lengthSq() < 0.0001
    ) {
      this.movementPlanarForward.set(0, 0, -1);
    } else {
      this.movementPlanarForward.normalize();
    }

    this.movementPlanarRight
      .crossVectors(this.movementPlanarForward, this.tmpUp)
      .normalize();

    if (
      !isFiniteVector(this.movementPlanarRight) ||
      this.movementPlanarRight.lengthSq() < 0.0001
    ) {
      this.movementPlanarRight.set(1, 0, 0);
    }
  }

  syncFreeLookFromForward(sourceForward) {
    this.tmpCameraDirection.copy(sourceForward);

    if (
      !isFiniteVector(this.tmpCameraDirection) ||
      this.tmpCameraDirection.lengthSq() < 0.0001
    ) {
      this.tmpCameraDirection.copy(this.currentForward);
    }

    if (
      !isFiniteVector(this.tmpCameraDirection) ||
      this.tmpCameraDirection.lengthSq() < 0.0001
    ) {
      this.tmpCameraDirection.set(0, 0, -1);
    } else {
      this.tmpCameraDirection.normalize();
    }

    this.lookYaw = Math.atan2(this.tmpCameraDirection.x, this.tmpCameraDirection.z);
    this.lookPitch = THREE.MathUtils.clamp(
      Math.asin(THREE.MathUtils.clamp(this.tmpCameraDirection.y, -0.999, 0.999)),
      this.config.freePitchMin,
      this.config.freePitchMax,
    );
  }

  projectPointToFrameNdc(point, position, lookTarget, target = new THREE.Vector3()) {
    this.ndcProbeCamera.fov = this.camera.fov;
    this.ndcProbeCamera.aspect = this.camera.aspect;
    this.ndcProbeCamera.near = this.camera.near;
    this.ndcProbeCamera.far = this.camera.far;
    this.ndcProbeCamera.updateProjectionMatrix();
    this.ndcProbeCamera.position.copy(position);
    this.ndcProbeCamera.up.copy(this.tmpUp);
    this.ndcProbeCamera.lookAt(lookTarget);
    this.ndcProbeCamera.updateMatrixWorld(true);
    return target.copy(point).project(this.ndcProbeCamera);
  }

  getLockedOverlapAvoidanceStrength(
    playerAnchor,
    targetPoint,
    position,
    lookTarget,
    airborneFactor,
  ) {
    if (airborneFactor < 0.45) {
      return 0;
    }

    const playerScreen = this.projectPointToFrameNdc(
      playerAnchor,
      position,
      lookTarget,
      this.tmpScreenA,
    );
    const targetScreen = this.projectPointToFrameNdc(
      targetPoint,
      position,
      lookTarget,
      this.tmpScreenB,
    );

    if (!isFiniteVector(playerScreen) || !isFiniteVector(targetScreen)) {
      return 0;
    }

    const verticalSeparation = Math.abs(targetScreen.y - playerScreen.y);
    const screenDistance = Math.hypot(
      targetScreen.x - playerScreen.x,
      targetScreen.y - playerScreen.y,
    );

    if (
      verticalSeparation >= this.config.lockOverlapMinVerticalNdc &&
      screenDistance >= this.config.lockOverlapMinScreenDistance
    ) {
      return 0;
    }

    const verticalOverlap = 1 - THREE.MathUtils.clamp(
      verticalSeparation / this.config.lockOverlapMinVerticalNdc,
      0,
      1,
    );
    const screenOverlap = 1 - THREE.MathUtils.clamp(
      screenDistance / this.config.lockOverlapMinScreenDistance,
      0,
      1,
    );
    const airborneWeight = THREE.MathUtils.clamp((airborneFactor - 0.45) / 0.55, 0, 1);
    return THREE.MathUtils.clamp(
      Math.max(verticalOverlap, screenOverlap) * airborneWeight,
      0,
      1,
    );
  }

  setInitialLockSide(player, lockTarget) {
    if (!lockTarget) {
      return;
    }

    const playerForward = player.getForwardVector(this.tmpForward);
    const playerPosition = player.getWorldPosition(this.tmpBossPoint);
    const playerRight = this.tmpRight.set(-playerForward.z, 0, playerForward.x);

    if (playerRight.lengthSq() > 0.0001) {
      playerRight.normalize();
      const cameraOffset = this.tmpCenter.subVectors(this.position, playerPosition).setY(0);

      if (cameraOffset.lengthSq() > 0.0001) {
        this.lockSide = cameraOffset.dot(playerRight) >= 0 ? 1 : -1;
        return;
      }
    }

    const toBoss = this.tmpCenter
      .subVectors(lockTarget.getAimPoint(new THREE.Vector3()), playerPosition)
      .setY(0);

    if (toBoss.lengthSq() < 0.0001) {
      this.lockSide = 1;
      return;
    }

    toBoss.normalize();
    const lateral = this.tmpRight.crossVectors(toBoss, this.tmpUp).normalize();
    this.lockSide = lateral.dot(playerForward) >= 0 ? 1 : -1;
  }

  snap({ input = { lookX: 0, lookY: 0 }, player, lockTarget, arena }) {
    const playerAnchor = player.getCameraAnchor(this.tmpPlayerAnchor);
    const airborneFactor = this.getAirborneFactor(player, arena);
    const isLocked = Boolean(lockTarget?.isAlive());

    if (isLocked) {
      this.updateLockedCamera(1 / 60, player, playerAnchor, lockTarget, arena, airborneFactor);
    } else {
      this.updateFreeCamera(1 / 60, input, player, playerAnchor, arena, airborneFactor);
    }

    if (!isFiniteVector(this.tmpPosition) || !isFiniteVector(this.tmpLook)) {
      this.resetToSafeFrame(player, lockTarget);
      this.applyCameraState(player);
      return;
    }

    this.position.copy(this.tmpPosition);
    this.lookTarget.copy(this.tmpLook);
    this.enforcePlayerClearance(playerAnchor, this.position, Boolean(lockTarget?.isAlive()));

    if (!isFiniteVector(this.position) || !isFiniteVector(this.lookTarget)) {
      this.resetToSafeFrame(player, lockTarget);
    }

    this.applyCameraState(player);
    this.wasLockedLastFrame = isLocked;
  }

  update(deltaSeconds, { input, player, lockTarget, arena }) {
    const playerAnchor = player.getCameraAnchor(this.tmpPlayerAnchor);
    const airborneFactor = this.getAirborneFactor(player, arena);
    const jetTrackingBoost = player.state === locomotionStates.jet ? this.config.jetTrackingBoost : 0;
    const isLocked = Boolean(lockTarget?.isAlive());

    if (isLocked) {
      this.updateLockedCamera(
        deltaSeconds,
        player,
        playerAnchor,
        lockTarget,
        arena,
        airborneFactor,
      );
    } else {
      this.updateFreeCamera(deltaSeconds, input, player, playerAnchor, arena, airborneFactor);
    }

    if (!isFiniteVector(this.tmpPosition) || !isFiniteVector(this.tmpLook)) {
      this.resetToSafeFrame(player, lockTarget);
      this.applyCameraState(player, deltaSeconds);
      return;
    }

    dampVector(
      this.position,
      this.tmpPosition,
      this.config.positionSmoothing + airborneFactor * this.config.airTrackingBoost + jetTrackingBoost,
      deltaSeconds,
    );
    dampVector(
      this.lookTarget,
      this.tmpLook,
      this.config.targetSmoothing + airborneFactor * this.config.airTrackingBoost + jetTrackingBoost,
      deltaSeconds,
    );

    this.enforcePlayerClearance(playerAnchor, this.position, Boolean(lockTarget?.isAlive()));

    if (!isFiniteVector(this.position) || !isFiniteVector(this.lookTarget)) {
      this.resetToSafeFrame(player, lockTarget);
    }

    this.applyCameraState(player, deltaSeconds);
    this.wasLockedLastFrame = isLocked;
  }

  updateFreeCamera(deltaSeconds, input, player, playerAnchor, arena, airborneFactor) {
    const groundMoveFactor = player.state === locomotionStates.ground
      ? THREE.MathUtils.clamp(
          player.horizontalVelocity.length() / Math.max(player.config.groundSpeed, 0.001),
          0,
          1,
        )
      : 0;

    if (this.wasLockedLastFrame) {
      this.syncFreeLookFromForward(this.currentForward);
      this.freeLookTimer = 0;
    }

    const lookSensitivity = input.usingTouch
      ? this.config.mobileLookSensitivity
      : this.config.freeLookSensitivity;

    if (input.lookX !== 0 || input.lookY !== 0) {
      this.lookYaw -= input.lookX * lookSensitivity;
      this.lookPitch = THREE.MathUtils.clamp(
        this.lookPitch - input.lookY * lookSensitivity,
        this.config.freePitchMin,
        this.config.freePitchMax,
      );
      this.freeLookTimer = 1.7;
    } else {
      this.freeLookTimer = Math.max(0, this.freeLookTimer - deltaSeconds);
    }

    const cosPitch = Math.cos(this.lookPitch);
    const forward = this.tmpForward.set(
      Math.sin(this.lookYaw) * cosPitch,
      Math.sin(this.lookPitch),
      Math.cos(this.lookYaw) * cosPitch,
    ).normalize();
    const right = this.tmpRight.crossVectors(forward, this.tmpUp).normalize();
    this.setMovementBasisFromForward(forward);
    const desiredDistance =
      this.config.sharedDistance +
      airborneFactor * 1.1 +
      groundMoveFactor * 0.8;
    const desiredHeight =
      this.config.sharedHeight +
      airborneFactor * 0.38 +
      groundMoveFactor * 0.2;
    const shoulderOffset =
      this.config.sharedShoulderOffset +
      groundMoveFactor * 0.08;
    const lookLift =
      this.config.sharedLookLift +
      airborneFactor * 0.12 +
      groundMoveFactor * 0.08;
    const lookTarget = this.tmpLook
      .copy(playerAnchor)
      .addScaledVector(this.tmpUp, lookLift)
      .addScaledVector(forward, 0.78);

    this.composeCombatFrame({
      playerAnchor,
      framingForward: forward,
      lateralDirection: right,
      lookTarget,
      distance: desiredDistance,
      height: desiredHeight,
      shoulderOffset,
    });

    this.clampElevationAngle(
      playerAnchor,
      this.tmpPosition,
      this.config.freeAirMaxElevationDegrees * (Math.PI / 180),
    );
    this.clampAboveGround(arena, this.tmpPosition);
    this.enforcePlayerClearance(playerAnchor, this.tmpPosition, false);
  }

  updateLockedCamera(deltaSeconds, player, playerAnchor, lockTarget, arena, airborneFactor) {
    const targetPoint = lockTarget.getAimPoint(this.tmpBossPoint);
    const playerForward = player.getForwardVector(this.tmpForward);
    const toBoss = this.tmpMixed.subVectors(targetPoint, playerAnchor);
    const distance = Math.max(0.001, toBoss.length());
    const verticalDelta = Math.abs(toBoss.y);
    const relativeAltitude = THREE.MathUtils.clamp((playerAnchor.y - targetPoint.y) / 18, -1, 1);
    const positiveAltitude = Math.max(0, relativeAltitude);

    toBoss.normalize();

    const lateral = this.tmpRight.crossVectors(toBoss, this.tmpUp).normalize();
    const lateralDot = lateral.dot(playerForward);

    if (Math.abs(lateralDot) > 0.55) {
      this.lockSide = lateralDot >= 0 ? 1 : -1;
    }

    const framingForward = this.tmpForward
      .copy(toBoss)
      .multiplyScalar(0.72)
      .addScaledVector(playerForward, 0.28)
      .normalize();
    this.setMovementBasisFromForward(framingForward);

    const desiredDistance = THREE.MathUtils.clamp(
      this.config.sharedDistance +
        0.24 +
        distance * 0.018 +
        verticalDelta * 0.06 +
        airborneFactor * 0.54 +
        positiveAltitude * 1.15,
      this.config.sharedDistance + 0.1,
      this.config.sharedDistance + 4,
    );
    const desiredHeight = Math.max(
      this.config.sharedHeight - 0.15,
      this.config.sharedHeight +
        0.12 +
        verticalDelta * 0.035 +
        airborneFactor * 0.02 -
        positiveAltitude * 0.65,
    );
    const shoulderOffset =
      this.config.sharedShoulderOffset +
      0.08 +
      positiveAltitude * 0.24;
    const targetBias = THREE.MathUtils.clamp(
      0.34 + airborneFactor * 0.02 + positiveAltitude * 0.04,
      0.34,
      0.4,
    );
    const lookLift =
      this.config.sharedLookLift +
      0.08 +
      airborneFactor * 0.02;

    let adjustedDistance = desiredDistance;
    let adjustedHeight = desiredHeight;
    let adjustedTargetBias = targetBias;
    let adjustedShoulderOffset = this.lockSide * shoulderOffset;

    this.tmpCenter.lerpVectors(playerAnchor, targetPoint, adjustedTargetBias);
    const lookTarget = this.tmpLook.copy(this.tmpCenter).addScaledVector(this.tmpUp, lookLift);
    this.composeCombatFrame({
      playerAnchor,
      framingForward,
      lateralDirection: lateral,
      lookTarget,
      distance: adjustedDistance,
      height: adjustedHeight,
      shoulderOffset: adjustedShoulderOffset,
    });

    const overlapAvoidance = this.getLockedOverlapAvoidanceStrength(
      playerAnchor,
      targetPoint,
      this.tmpPosition,
      lookTarget,
      airborneFactor,
    );

    if (overlapAvoidance > 0.001) {
      adjustedDistance += this.config.lockOverlapDistanceBoost * overlapAvoidance;
      adjustedHeight = Math.max(
        this.config.sharedHeight,
        adjustedHeight - this.config.lockOverlapHeightReduction * overlapAvoidance,
      );
      adjustedTargetBias = THREE.MathUtils.lerp(
        adjustedTargetBias,
        this.config.lockOverlapTargetBiasMax,
        overlapAvoidance,
      );
      adjustedShoulderOffset = this.lockSide * (
        shoulderOffset + this.config.lockOverlapShoulderBoost * overlapAvoidance
      );
      this.tmpCenter.lerpVectors(playerAnchor, targetPoint, adjustedTargetBias);
      lookTarget.copy(this.tmpCenter).addScaledVector(this.tmpUp, lookLift);
      this.composeCombatFrame({
        playerAnchor,
        framingForward,
        lateralDirection: lateral,
        lookTarget,
        distance: adjustedDistance,
        height: adjustedHeight,
        shoulderOffset: adjustedShoulderOffset,
      });
    }

    this.clampElevationAngle(
      this.tmpCenter,
      this.tmpPosition,
      this.config.lockAirMaxElevationDegrees * (Math.PI / 180),
    );
    this.clampAboveGround(arena, this.tmpPosition);
    this.enforcePlayerClearance(playerAnchor, this.tmpPosition, true);
  }

  clampElevationAngle(basePoint, position, maxElevationRadians) {
    this.tmpOffset.subVectors(position, basePoint);
    const horizontalDistance = Math.sqrt(
      this.tmpOffset.x * this.tmpOffset.x +
      this.tmpOffset.z * this.tmpOffset.z,
    );

    if (horizontalDistance <= 0.001) {
      return;
    }

    const maxRise = Math.tan(maxElevationRadians) * horizontalDistance;

    if (this.tmpOffset.y > maxRise) {
      position.y = basePoint.y + maxRise;
    }
  }

  clampAboveGround(arena, position) {
    const ground = arena.sampleHeight(position.x, position.z);
    position.y = Math.max(position.y, ground + 2.4);
  }

  enforcePlayerClearance(playerAnchor, position, locked) {
    const minPlanarDistance = locked
      ? this.config.lockMinPlanarDistance
      : this.config.freeMinPlanarDistance;
    const minHeightAboveAnchor = locked
      ? this.config.lockMinHeightAboveAnchor
      : this.config.freeMinHeightAboveAnchor;

    this.tmpOffset.subVectors(position, playerAnchor);
    this.tmpPlanarOffset.copy(this.tmpOffset).setY(0);
    let planarDistance = this.tmpPlanarOffset.length();

    if (planarDistance < minPlanarDistance) {
      if (planarDistance < 0.001) {
        this.tmpPlanarOffset.copy(this.currentForward).setY(0).multiplyScalar(-1);

        if (this.tmpPlanarOffset.lengthSq() < 0.001) {
          this.tmpPlanarOffset.set(0, 0, 1);
        } else {
          this.tmpPlanarOffset.normalize();
        }

        planarDistance = 1;
      }

      position.addScaledVector(
        this.tmpPlanarOffset.normalize(),
        minPlanarDistance - planarDistance,
      );
    }

    position.y = Math.max(position.y, playerAnchor.y + minHeightAboveAnchor);
  }

  resetToSafeFrame(player, lockTarget) {
    const playerPosition = player.getWorldPosition(this.tmpPlayerAnchor);
    const baseAnchor = isFiniteVector(playerPosition)
      ? playerPosition.addScaledVector(this.tmpUp, 2.4)
      : this.tmpPlayerAnchor.set(0, 2.4, 0);
    const fallbackForward = player.getForwardVector(this.tmpForward).setY(0);

    if (!isFiniteVector(fallbackForward) || fallbackForward.lengthSq() < 0.0001) {
      fallbackForward.set(0, 0, -1);
    } else {
      fallbackForward.normalize();
    }

    const fallbackRight = this.tmpRight.set(-fallbackForward.z, 0, fallbackForward.x);

    if (!isFiniteVector(fallbackRight) || fallbackRight.lengthSq() < 0.0001) {
      fallbackRight.set(1, 0, 0);
    } else {
      fallbackRight.normalize();
    }

    this.lookTarget.copy(baseAnchor);

    if (lockTarget?.isAlive()) {
      this.lookTarget.lerp(lockTarget.getAimPoint(this.tmpBossPoint), 0.38);
    }

    this.position
      .copy(baseAnchor)
      .addScaledVector(fallbackRight, this.config.freeShoulderOffset + 0.4)
      .addScaledVector(fallbackForward, -(this.config.freeDistance + 3.2))
      .addScaledVector(this.tmpUp, this.config.freeHeight + 1.4);

    this.currentForward.subVectors(this.lookTarget, this.position).normalize();
    this.planarForward.copy(this.currentForward).setY(0).normalize();
    this.planarRight.set(-this.planarForward.z, 0, this.planarForward.x).normalize();
  }

  applyCameraState(player, deltaSeconds = 0) {
    this.currentForward.subVectors(this.lookTarget, this.position).normalize();
    this.planarForward.copy(this.currentForward).setY(0);

    if (this.planarForward.lengthSq() < 0.0001) {
      this.planarForward.set(0, 0, -1);
    } else {
      this.planarForward.normalize();
    }

    this.planarRight.crossVectors(this.planarForward, this.tmpUp).normalize();

    const desiredFov =
      player.state === locomotionStates.jet ? this.config.jetFov : this.baseFov;
    this.camera.fov = deltaSeconds > 0
      ? THREE.MathUtils.damp(this.camera.fov, desiredFov, this.config.fovRecovery, deltaSeconds)
      : desiredFov;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.lookTarget);
    this.camera.updateMatrixWorld(true);
  }

  getDebugState() {
    return {
      position: this.position.clone(),
      lookTarget: this.lookTarget.clone(),
    };
  }
}

function dampVector(current, target, lambda, deltaSeconds) {
  const t = 1 - Math.exp(-lambda * deltaSeconds);
  current.lerp(target, t);
}

export default CombatCamera;
