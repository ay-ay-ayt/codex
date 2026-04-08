import * as THREE from "three";
import { gameConfig } from "../config.js";

function closestPointOnSegment(start, end, target, out) {
  const segment = out.subVectors(end, start);
  const lengthSq = segment.lengthSq();

  if (lengthSq <= 0.0001) {
    return out.copy(start);
  }

  const t = THREE.MathUtils.clamp(
    target.clone().sub(start).dot(segment) / lengthSq,
    0,
    1,
  );
  return out.copy(start).addScaledVector(segment, t);
}

export class BossActor {
  constructor() {
    this.config = gameConfig.boss;
    this.group = new THREE.Group();
    this.group.name = "BossActor";

    this.position = this.group.position;
    this.hp = this.config.hp;
    this.maxHp = this.config.hp;
    this.damageFlash = 0;
    this.baseGroundY = 0;

    this.coreNode = new THREE.Object3D();
    this.coreNode.position.set(0, 7.2, -3.4);

    this.bodySpheres = [
      { center: new THREE.Vector3(0, 5, 0.2), radius: 6.5, weak: false },
      { center: new THREE.Vector3(0, 7.2, -3.4), radius: this.config.weakPointRadius, weak: true },
      { center: new THREE.Vector3(-6.5, 4, 1.6), radius: 3.8, weak: false },
      { center: new THREE.Vector3(6.5, 4, 1.6), radius: 3.8, weak: false },
    ];

    this.shockwaves = [];
    this.cycleTimer = this.config.cycleSeconds;
    this.telegraphActive = false;
    this.telegraphRing = null;
    this.coreMaterial = null;
    this.contactShadow = null;

    this.tmpWorldPosition = new THREE.Vector3();
    this.tmpSegmentPoint = new THREE.Vector3();
    this.tmpSphereWorld = new THREE.Vector3();
    this.tmpToPlayer = new THREE.Vector3();

    this.buildModel();
  }

  buildModel() {
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: "#5e5248",
      roughness: 0.62,
      metalness: 0.24,
    });
    const armorMaterial = new THREE.MeshStandardMaterial({
      color: "#8f7b69",
      roughness: 0.5,
      metalness: 0.2,
    });
    const emissiveMaterial = new THREE.MeshStandardMaterial({
      color: "#ffd8aa",
      emissive: "#ff9d3d",
      emissiveIntensity: 2,
      roughness: 0.14,
      metalness: 0.1,
    });
    this.coreMaterial = emissiveMaterial;

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(7.4, 9.2, 10.6, 10),
      hullMaterial,
    );
    base.position.y = 5.4;
    base.rotation.z = Math.PI / 2;
    this.group.add(base);

    const spine = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 2.8, 12.8),
      armorMaterial,
    );
    spine.position.set(0, 7.2, 0.2);
    this.group.add(spine);

    const prow = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 5.6, 6),
      armorMaterial,
    );
    prow.position.set(0, 6.7, -6.8);
    prow.rotation.x = -Math.PI / 2;
    this.group.add(prow);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 22, 22),
      emissiveMaterial,
    );
    core.position.copy(this.coreNode.position);
    this.group.add(core);
    this.group.add(this.coreNode);

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 2.4, 5.6),
        hullMaterial,
      );
      shoulder.position.set(side * 6.8, 4.6, 1.6);
      this.group.add(shoulder);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 4.8, 2.8),
        armorMaterial,
      );
      arm.position.set(side * 9, 2.6, 2.8);
      arm.rotation.z = side * -0.18;
      this.group.add(arm);

      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 6.8, 2.4),
        hullMaterial,
      );
      leg.position.set(side * 4.8, 1.4, 4.4);
      leg.rotation.z = side * 0.12;
      this.group.add(leg);

      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 4.2, 5),
        armorMaterial,
      );
      fin.position.set(side * 4.1, 8.2, 1.8);
      fin.rotation.z = side * 0.34;
      this.group.add(fin);
    }

    const telegraphRing = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 4.2, 64),
      new THREE.MeshBasicMaterial({
        color: "#ff9a3d",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    telegraphRing.rotation.x = -Math.PI / 2;
    telegraphRing.position.y = 0.18;
    this.telegraphRing = telegraphRing;
    this.group.add(telegraphRing);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(13.2, 48),
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    this.contactShadow = shadow;
    this.group.add(shadow);
  }

  addToScene(scene) {
    scene.add(this.group);
  }

  setSpawnPosition(position) {
    this.position.copy(position);
    this.baseGroundY = position.y;
  }

  isAlive() {
    return this.hp > 0;
  }

  clearShockwaves() {
    for (const wave of this.shockwaves.splice(0)) {
      this.group.remove(wave.mesh);
      wave.mesh.material.dispose();
    }
  }

  resetForBattle(spawnPosition) {
    this.clearShockwaves();
    this.setSpawnPosition(spawnPosition);
    this.hp = this.maxHp;
    this.damageFlash = 0;
    this.cycleTimer = this.config.cycleSeconds;
    this.telegraphActive = false;
    this.group.rotation.y = 0;
    this.telegraphRing.material.opacity = 0;
    this.telegraphRing.scale.setScalar(1);
    this.coreMaterial.emissiveIntensity = 1.8;
  }

  getAimPoint(target = new THREE.Vector3()) {
    return this.coreNode.getWorldPosition(target);
  }

  takeDamage({ amount, isWeak, hitPoint }) {
    if (!this.isAlive()) {
      return 0;
    }

    const appliedDamage = amount * (isWeak ? this.config.weakPointDamageMultiplier : 1);
    this.hp = Math.max(0, this.hp - appliedDamage);
    this.damageFlash = 1;

    return appliedDamage;
  }

  update(deltaSeconds, { player, arena, fx }) {
    if (!this.isAlive()) {
      this.coreMaterial.emissiveIntensity = THREE.MathUtils.damp(
        this.coreMaterial.emissiveIntensity,
        0.25,
        5,
        deltaSeconds,
      );
      return;
    }

    this.cycleTimer -= deltaSeconds;

    if (this.cycleTimer <= this.config.telegraphSeconds && !this.telegraphActive) {
      this.telegraphActive = true;
    }

    if (this.cycleTimer <= 0) {
      this.spawnShockwave();
      this.cycleTimer += this.config.cycleSeconds;
      this.telegraphActive = false;
    }

    this.updatePresentation(deltaSeconds);
    this.updateShockwaves(deltaSeconds, player, arena, fx);
  }

  updatePresentation(deltaSeconds) {
    const time = performance.now() * 0.001;
    const sway = Math.sin(time * 0.8) * 0.08;
    this.group.rotation.y = sway;
    this.group.position.y = this.baseGroundY;

    this.damageFlash = Math.max(0, this.damageFlash - deltaSeconds * 2.2);

    const telegraphPulse = this.telegraphActive
      ? 0.75 + Math.sin(time * 14) * 0.25
      : 0;
    this.coreMaterial.emissiveIntensity =
      1.8 + telegraphPulse * 2.6 + this.damageFlash * 2.4;

    this.telegraphRing.material.opacity = this.telegraphActive ? 0.22 + telegraphPulse * 0.2 : 0;
    this.telegraphRing.scale.setScalar(1 + telegraphPulse * 0.18);
  }

  spawnShockwave() {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1.18, 64),
      new THREE.MeshBasicMaterial({
        color: "#ffb15b",
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.16;
    this.group.add(ring);

    this.shockwaves.push({
      mesh: ring,
      radius: 1.2,
      speed: this.config.shockwaveSpeed,
      width: this.config.shockwaveWidth,
      playerHit: false,
    });
  }

  updateShockwaves(deltaSeconds, player, arena, fx) {
    const groundY = arena.sampleHeight(this.position.x, this.position.z);

    for (let index = this.shockwaves.length - 1; index >= 0; index -= 1) {
      const wave = this.shockwaves[index];
      wave.radius += wave.speed * deltaSeconds;
      const inner = Math.max(0.1, wave.radius - wave.width * 0.5);
      const outer = wave.radius + wave.width * 0.5;
      const scale = wave.radius;

      wave.mesh.scale.setScalar(scale);
      wave.mesh.material.opacity = THREE.MathUtils.clamp(
        1 - wave.radius / 160,
        0,
        0.88,
      );

      if (!wave.playerHit) {
        const playerPosition = player.getWorldPosition(this.tmpWorldPosition);
        this.tmpToPlayer.subVectors(playerPosition, this.position);
        const radialDistance = Math.sqrt(
          this.tmpToPlayer.x * this.tmpToPlayer.x + this.tmpToPlayer.z * this.tmpToPlayer.z,
        );
        const altitude = player.getAltitude(arena);

        if (
          radialDistance >= inner &&
          radialDistance <= outer &&
          altitude < this.config.dodgeHeight
        ) {
          player.takeDamage(this.config.shockwaveDamage);
          wave.playerHit = true;

          if (fx) {
            fx.spawnImpact(player.getAimOrigin(new THREE.Vector3()), {
              weak: false,
              color: "#ff9760",
            });
          }
        }
      }

      if (wave.radius > 152) {
        this.group.remove(wave.mesh);
        wave.mesh.material.dispose();
        this.shockwaves.splice(index, 1);
      }
    }
  }

  intersectProjectileSegment(start, end) {
    let bestHit = null;
    let bestDistanceSq = Infinity;

    for (const sphere of this.bodySpheres) {
      this.tmpSphereWorld.copy(this.position).add(sphere.center);
      const closest = closestPointOnSegment(start, end, this.tmpSphereWorld, this.tmpSegmentPoint);
      const distanceSq = closest.distanceToSquared(this.tmpSphereWorld);

      if (distanceSq > sphere.radius * sphere.radius) {
        continue;
      }

      const hitPoint = closest.clone();
      const hitDistanceSq = hitPoint.distanceToSquared(start);

      if (hitDistanceSq < bestDistanceSq) {
        bestDistanceSq = hitDistanceSq;
        bestHit = {
          position: hitPoint,
          normal: hitPoint.clone().sub(this.tmpSphereWorld).normalize(),
          isWeak: sphere.weak,
        };
      }
    }

    return bestHit;
  }
}

export default BossActor;
