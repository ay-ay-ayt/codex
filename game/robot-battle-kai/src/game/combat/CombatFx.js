import * as THREE from "three";

export class CombatFx {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "CombatFx";
    this.scene.add(this.group);

    this.effects = [];
    this.tmpVector = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);

    this.flashGeometry = new THREE.SphereGeometry(1, 18, 18);
    this.ringGeometry = new THREE.RingGeometry(0.32, 0.52, 32);
    this.streakGeometry = new THREE.CylinderGeometry(0.12, 0.32, 1.8, 10, 1, true);
  }

  spawnMuzzleFlash(position, direction, color = "#ffb56f") {
    const mesh = new THREE.Mesh(
      this.streakGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );

    mesh.position.copy(position);
    mesh.quaternion.setFromUnitVectors(this.up, direction.clone().normalize());
    this.group.add(mesh);

    this.effects.push({
      type: "muzzle",
      mesh,
      life: 0,
      duration: 0.08,
    });
  }

  spawnImpact(position, { weak = false, color = weak ? "#8ef6ff" : "#ffcf8d" } = {}) {
    const burst = new THREE.Mesh(
      this.flashGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );

    const ring = new THREE.Mesh(
      this.ringGeometry,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
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

  spawnJetBurst(position, direction) {
    const mesh = new THREE.Mesh(
      this.streakGeometry,
      new THREE.MeshBasicMaterial({
        color: "#7cecff",
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );

    mesh.position.copy(position);
    mesh.quaternion.setFromUnitVectors(this.up, direction.clone().normalize());
    this.group.add(mesh);

    this.effects.push({
      type: "jet",
      mesh,
      life: 0,
      duration: 0.16,
    });
  }

  update(deltaSeconds) {
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
      } else {
        effect.mesh.scale.set(1, 0.6 + progress * 1.8, 1);
        effect.mesh.material.opacity = (1 - progress) * (effect.type === "jet" ? 0.6 : 0.9);
      }

      if (progress >= 1) {
        this.disposeEffect(effect);
        this.effects.splice(index, 1);
      }
    }
  }

  disposeEffect(effect) {
    if (effect.mesh) {
      this.group.remove(effect.mesh);
      effect.mesh.material.dispose();
    }

    if (effect.burst) {
      this.group.remove(effect.burst);
      effect.burst.material.dispose();
    }

    if (effect.ring) {
      this.group.remove(effect.ring);
      effect.ring.material.dispose();
    }
  }
}

export default CombatFx;
