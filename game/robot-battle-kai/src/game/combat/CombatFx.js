import * as THREE from "three";

function createAdditiveMaterial({ color, opacity, side = THREE.DoubleSide }) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side,
  });
}

export class CombatFx {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "CombatFx";
    this.scene.add(this.group);

    this.effects = [];
    this.up = new THREE.Vector3(0, 1, 0);
    this.forwardAxis = new THREE.Vector3(0, 0, 1);

    this.flashGeometry = new THREE.SphereGeometry(1, 18, 18);
    this.ringGeometry = new THREE.RingGeometry(0.24, 0.6, 36);
    this.streakGeometry = new THREE.CylinderGeometry(0.09, 0.21, 1.1, 12, 1, true);
    this.coreStreakGeometry = new THREE.CylinderGeometry(0.045, 0.09, 0.85, 12, 1, true);
    this.plumeGeometry = new THREE.CylinderGeometry(0.18, 0.56, 1.8, 14, 1, true);
    this.muzzleShellLength = 0.9;
    this.muzzleCoreLength = 0.72;
    this.jetCoreLength = 0.72;
    this.jetPlumeLength = 1.08;
    this.lastMuzzleDebug = null;
    this.recentExhaustDebug = [];
  }

  spawnMuzzleFlash(position, direction, { strength = 1, color = "#ffb56f" } = {}) {
    const flashDirection = direction.clone().normalize();
    this.lastMuzzleDebug = {
      origin: position.clone(),
      direction: flashDirection.clone(),
    };
    const core = new THREE.Mesh(
      this.coreStreakGeometry,
      createAdditiveMaterial({
        color: "#fff5e5",
        opacity: 0.98,
      }),
    );
    const shell = new THREE.Mesh(
      this.streakGeometry,
      createAdditiveMaterial({
        color,
        opacity: 0.9,
      }),
    );
    const flare = new THREE.Mesh(
      this.ringGeometry,
      createAdditiveMaterial({
        color: "#ffd8a2",
        opacity: 0.92,
      }),
    );

    const coreScaleY = 0.48;
    const shellScaleY = 0.54;
    core.scale.set(
      0.72 + strength * 0.12,
      coreScaleY,
      0.72 + strength * 0.12,
    );
    shell.scale.set(
      1 + strength * 0.18,
      shellScaleY,
      1 + strength * 0.18,
    );
    core.position.copy(position).addScaledVector(
      flashDirection,
      (this.muzzleCoreLength * coreScaleY) * 0.5,
    );
    shell.position.copy(position).addScaledVector(
      flashDirection,
      (this.muzzleShellLength * shellScaleY) * 0.5,
    );
    flare.position.copy(position).addScaledVector(flashDirection, 0.04);
    core.quaternion.setFromUnitVectors(this.up, flashDirection);
    shell.quaternion.setFromUnitVectors(this.up, flashDirection);
    flare.quaternion.setFromUnitVectors(this.forwardAxis, flashDirection);

    this.group.add(core);
    this.group.add(shell);
    this.group.add(flare);

    this.effects.push({
      type: "muzzle",
      core,
      shell,
      flare,
      origin: position.clone(),
      direction: flashDirection,
      driftSpeed: 0.8 + strength * 1.6,
      strength,
      life: 0,
      duration: 0.035,
      travel: 0,
      maxTravel: 0.18,
    });
  }

  spawnImpact(position, { weak = false, color = weak ? "#8ef6ff" : "#ffcf8d" } = {}) {
    const burst = new THREE.Mesh(
      this.flashGeometry,
      createAdditiveMaterial({
        color,
        opacity: 0.86,
        side: THREE.FrontSide,
      }),
    );

    const ring = new THREE.Mesh(
      this.ringGeometry,
      createAdditiveMaterial({
        color,
        opacity: 0.9,
      }),
    );

    burst.position.copy(position);
    ring.position.copy(position);
    ring.rotation.x = -Math.PI / 2;

    this.group.add(burst);
    this.group.add(ring);

    this.effects.push({
      type: "impact",
      burst,
      ring,
      life: 0,
      duration: weak ? 0.34 : 0.24,
    });
  }

  spawnJetBurst(position, direction, { strength = 1.2 } = {}) {
    this.spawnExhaustEffect("jet", position, direction, strength);
  }

  spawnThrusterPlume(position, direction, { strength = 0.4 } = {}) {
    this.spawnExhaustEffect("thruster", position, direction, strength);
  }

  spawnExhaustEffect(type, position, direction, strength) {
    const plumeDirection = direction.clone().normalize();
    this.recentExhaustDebug.unshift({
      type,
      origin: position.clone(),
      direction: plumeDirection.clone(),
      age: 0,
    });
    this.recentExhaustDebug.length = Math.min(this.recentExhaustDebug.length, 9);
    const core = new THREE.Mesh(
      this.coreStreakGeometry,
      createAdditiveMaterial({
        color: type === "jet" ? "#ffffff" : "#fffaf0",
        opacity: type === "jet" ? 0.86 : 0.82,
      }),
    );
    const plume = new THREE.Mesh(
      this.plumeGeometry,
      createAdditiveMaterial({
        color: type === "jet" ? "#eef8ff" : "#fff2dc",
        opacity: type === "jet" ? 0.56 : 0.5,
      }),
    );
    const flare = new THREE.Mesh(
      this.ringGeometry,
      createAdditiveMaterial({
        color: type === "jet" ? "#fff7ec" : "#fff0dc",
        opacity: type === "jet" ? 0.24 : 0.22,
      }),
    );

    const coreRadiusScale = type === "jet" ? 0.92 : 0.58;
    const plumeRadiusScale = type === "jet" ? 1.18 : 0.82;
    const coreScaleY = type === "jet" ? 0.44 : 0.34;
    const plumeScaleY = type === "jet" ? 0.48 : 0.42;
    core.scale.set(
      coreRadiusScale * 0.6 + strength * 0.1,
      coreScaleY,
      coreRadiusScale * 0.6 + strength * 0.1,
    );
    plume.scale.set(
      plumeRadiusScale + strength * 0.18,
      plumeScaleY,
      plumeRadiusScale + strength * 0.18,
    );
    core.position.copy(position).addScaledVector(
      plumeDirection,
      (this.jetCoreLength * coreScaleY) * 0.5,
    );
    plume.position.copy(position).addScaledVector(
      plumeDirection,
      (this.jetPlumeLength * plumeScaleY) * 0.5,
    );
    flare.position.copy(position).addScaledVector(plumeDirection, 0.024);
    core.quaternion.setFromUnitVectors(this.up, plumeDirection);
    plume.quaternion.setFromUnitVectors(this.up, plumeDirection);
    flare.quaternion.setFromUnitVectors(this.forwardAxis, plumeDirection);

    this.group.add(core);
    this.group.add(plume);
    this.group.add(flare);

    this.effects.push({
      type,
      core,
      plume,
      flare,
      origin: position.clone(),
      direction: plumeDirection,
      driftSpeed: type === "jet" ? 0.002 + strength * 0.004 : 0.004 + strength * 0.008,
      strength,
      life: 0,
      duration:
        type === "jet"
          ? THREE.MathUtils.lerp(0.04, 0.06, Math.min(1, strength / 1.5))
          : THREE.MathUtils.lerp(0.06, 0.09, Math.min(1, strength)),
      travel: 0,
      maxTravel:
        type === "jet"
          ? THREE.MathUtils.lerp(0.006, 0.018, Math.min(1, strength / 1.5))
          : THREE.MathUtils.lerp(0.01, 0.02, Math.min(1, strength)),
    });
  }

  clear() {
    for (const effect of this.effects.splice(0)) {
      this.disposeEffect(effect);
    }

    this.lastMuzzleDebug = null;
    this.recentExhaustDebug = [];
  }

  update(deltaSeconds) {
    for (let index = this.recentExhaustDebug.length - 1; index >= 0; index -= 1) {
      const entry = this.recentExhaustDebug[index];
      entry.age += deltaSeconds;

      if (entry.age > 0.08) {
        this.recentExhaustDebug.splice(index, 1);
      }
    }

    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.life += deltaSeconds;
      const progress = Math.min(effect.life / effect.duration, 1);
      const easeOut = 1 - (1 - progress) * (1 - progress);

      if (effect.type === "impact") {
        effect.burst.scale.setScalar(0.35 + easeOut * 1.8);
        effect.ring.scale.setScalar(0.7 + easeOut * 4);
        effect.burst.material.opacity = (1 - progress) * 0.75;
        effect.ring.material.opacity = (1 - progress) * 0.9;
      } else if (effect.type === "muzzle") {
        effect.travel = Math.min(effect.maxTravel, effect.travel + effect.driftSpeed * deltaSeconds);
        const coreScaleY = 0.44 + easeOut * 1.2;
        const shellScaleY = 0.52 + easeOut * 1.45;

        effect.core.scale.set(
          0.72 + effect.strength * 0.12,
          coreScaleY,
          0.72 + effect.strength * 0.12,
        );
        effect.shell.scale.set(
          1 + effect.strength * 0.18,
          shellScaleY,
          1 + effect.strength * 0.18,
        );
        effect.core.position.copy(effect.origin).addScaledVector(
          effect.direction,
          effect.travel * 0.38 + (this.muzzleCoreLength * coreScaleY) * 0.5,
        );
        effect.shell.position.copy(effect.origin).addScaledVector(
          effect.direction,
          effect.travel * 0.55 + (this.muzzleShellLength * shellScaleY) * 0.5,
        );
        effect.flare.position.copy(effect.origin).addScaledVector(
          effect.direction,
          0.04 + effect.travel * 0.14,
        );
        effect.flare.scale.setScalar(0.66 + easeOut * (1.1 + effect.strength * 0.32));
        effect.core.material.opacity = (1 - progress) * 0.96;
        effect.shell.material.opacity = (1 - progress) * (0.78 + effect.strength * 0.08);
        effect.flare.material.opacity = (1 - progress) * 0.82;
      } else {
        effect.travel = Math.min(effect.maxTravel, effect.travel + effect.driftSpeed * deltaSeconds);
        const exhaustFade = Math.max(0, 1 - progress);
        const softFade = Math.pow(exhaustFade, 1.35);

        const radiusScale = effect.type === "jet" ? 1.12 : 0.96;
        const lengthScale = effect.type === "jet" ? 0.18 : 0.22;
        const coreScaleY = 0.42 + easeOut * (lengthScale + effect.strength * 0.04);
        const plumeScaleY = 0.58 + easeOut * (lengthScale + effect.strength * 0.08);
        effect.core.scale.set(
          radiusScale * 0.62 + effect.strength * 0.18,
          coreScaleY,
          radiusScale * 0.62 + effect.strength * 0.18,
        );
        effect.plume.scale.set(
          radiusScale + effect.strength * 0.34,
          plumeScaleY,
          radiusScale + effect.strength * 0.34,
        );
        effect.core.position.copy(effect.origin).addScaledVector(
          effect.direction,
          effect.travel * 0.04 + (this.jetCoreLength * coreScaleY) * 0.5,
        );
        effect.plume.position.copy(effect.origin).addScaledVector(
          effect.direction,
          effect.travel * 0.08 + (this.jetPlumeLength * plumeScaleY) * 0.5,
        );
        effect.flare.position.copy(effect.origin).addScaledVector(
          effect.direction,
          0.018 + effect.travel * 0.02,
        );
        effect.flare.scale.setScalar(
          effect.type === "jet"
            ? 1.04 + easeOut * (0.44 + effect.strength * 0.08)
            : 1.08 + easeOut * (0.84 + effect.strength * 0.12),
        );
        effect.core.material.opacity =
          softFade * (effect.type === "jet" ? 0.8 : 0.76 + effect.strength * 0.06);
        effect.plume.material.opacity =
          softFade * (effect.type === "jet" ? 0.62 : 0.62 + effect.strength * 0.08);
        effect.flare.material.opacity =
          softFade * (effect.type === "jet" ? 0.22 : 0.54 + effect.strength * 0.06);
      }

      if (progress >= 1) {
        this.disposeEffect(effect);
        this.effects.splice(index, 1);
      }
    }
  }

  disposeEffect(effect) {
    for (const mesh of [
      effect.mesh,
      effect.core,
      effect.shell,
      effect.plume,
      effect.flare,
      effect.burst,
      effect.ring,
    ]) {
      if (!mesh) {
        continue;
      }

      this.group.remove(mesh);
      mesh.material.dispose();
    }
  }

  getDebugState() {
    return {
      lastMuzzle: this.lastMuzzleDebug
        ? {
            origin: this.lastMuzzleDebug.origin.clone(),
            direction: this.lastMuzzleDebug.direction.clone(),
          }
        : null,
      recentExhaust: this.recentExhaustDebug.map((entry) => ({
        type: entry.type,
        origin: entry.origin.clone(),
        direction: entry.direction.clone(),
      })),
    };
  }
}

export default CombatFx;
