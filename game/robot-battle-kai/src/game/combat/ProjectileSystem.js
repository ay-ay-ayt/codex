import * as THREE from "three";
import { gameConfig } from "../config.js";

export class ProjectileSystem {
  constructor({ scene, fx }) {
    this.scene = scene;
    this.fx = fx;
    this.config = gameConfig.combat;
    this.energyRules = gameConfig.energy;

    this.group = new THREE.Group();
    this.group.name = "ProjectileSystem";
    this.scene.add(this.group);

    this.cooldown = 0;
    this.nextBarrelIndex = 0;
    this.projectiles = [];

    this.projectileGeometry = new THREE.CylinderGeometry(0.055, 0.105, 1.9, 12, 1, true);
    this.projectileCoreGeometry = new THREE.CylinderGeometry(0.026, 0.06, 1.35, 10, 1, true);
    this.projectileLength = 1.9;
    this.projectileCoreLength = 1.35;
    this.projectileSpawnOffset = 0;
    this.projectileMaterial = new THREE.MeshBasicMaterial({
      color: "#ffbe73",
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.projectileCoreMaterial = new THREE.MeshBasicMaterial({
      color: "#fff5df",
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.tmpOrigin = new THREE.Vector3();
    this.tmpAnchor = new THREE.Vector3();
    this.tmpDirection = new THREE.Vector3();
    this.tmpTarget = new THREE.Vector3();
    this.tmpVelocity = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.lastShotDebug = null;
  }

  update(deltaSeconds, { input, player, boss, arena, combatCamera, lockTarget }) {
    this.cooldown = Math.max(0, this.cooldown - deltaSeconds);

    if (input.shootHeld) {
      this.tryFire(player, combatCamera, lockTarget);
    }

    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.life += deltaSeconds;
      projectile.previousPosition.copy(projectile.position);

      if (projectile.target?.isAlive()) {
        const targetPoint = projectile.target.getAimPoint(this.tmpTarget);
        this.tmpDirection
          .subVectors(targetPoint, projectile.position)
          .normalize();
        projectile.velocity.lerp(
          this.tmpDirection.multiplyScalar(this.config.projectileSpeed),
          THREE.MathUtils.clamp(this.config.homingStrength * deltaSeconds, 0, 1),
        );
      }

      projectile.position.addScaledVector(projectile.velocity, deltaSeconds);
      projectile.mesh.position.copy(projectile.position);
      projectile.mesh.quaternion.setFromUnitVectors(
        this.up,
        this.tmpVelocity.copy(projectile.velocity).normalize(),
      );

      const pulse = 0.8 + Math.sin(projectile.life * 48 + projectile.pulseOffset) * 0.2;
      projectile.shell.material.opacity = THREE.MathUtils.clamp(0.58 + pulse * 0.22, 0, 1);
      projectile.core.material.opacity = THREE.MathUtils.clamp(0.82 + pulse * 0.14, 0, 1);

      const hit = boss.intersectProjectileSegment(
        projectile.previousPosition,
        projectile.position,
      );

      if (hit) {
        boss.takeDamage({
          amount: projectile.damage,
          isWeak: hit.isWeak,
          hitPoint: hit.position,
        });
        this.fx.spawnImpact(hit.position, { weak: hit.isWeak });
        this.removeProjectile(index);
        continue;
      }

      const groundY = arena.sampleHeight(projectile.position.x, projectile.position.z);

      if (projectile.position.y <= groundY + this.config.projectileRadius) {
        this.fx.spawnImpact(projectile.position, { weak: false, color: "#f4bc78" });
        this.removeProjectile(index);
        continue;
      }

      if (projectile.life >= this.config.projectileLifetime) {
        this.removeProjectile(index);
      }
    }
  }

  tryFire(player, combatCamera, lockTarget) {
    if (
      this.cooldown > 0 ||
      !player.isAlive ||
      !player.energy.spendImmediate(this.energyRules.shootCost)
    ) {
      return false;
    }

    const barrelIndex = this.nextBarrelIndex;
    this.nextBarrelIndex = (this.nextBarrelIndex + 1) % 2;

    player.group.updateMatrixWorld(true);
    player.modelSceneRoot?.updateMatrixWorld(true);
    const muzzle = player.getWeaponMuzzleWorldPosition(barrelIndex, this.tmpOrigin);
    const aimPoint = combatCamera
      ? combatCamera.getAimPoint(lockTarget, this.tmpTarget)
      : this.tmpTarget.copy(muzzle).add(player.getForwardVector(this.tmpDirection).multiplyScalar(180));
    const direction = this.tmpDirection.subVectors(aimPoint, muzzle);

    if (direction.lengthSq() < 0.0001) {
      player.getForwardVector(direction);
    }

    direction.normalize();

    const shotOrigin = muzzle.clone().addScaledVector(direction, this.projectileSpawnOffset);
    const velocity = direction.clone().multiplyScalar(this.config.projectileSpeed);
    const mesh = new THREE.Group();
    const shell = new THREE.Mesh(
      this.projectileGeometry,
      this.projectileMaterial.clone(),
    );
    const core = new THREE.Mesh(
      this.projectileCoreGeometry,
      this.projectileCoreMaterial.clone(),
    );
    shell.position.y = this.projectileLength * 0.5;
    core.position.y = this.projectileCoreLength * 0.5;
    mesh.add(shell);
    mesh.add(core);
    mesh.position.copy(shotOrigin);
    mesh.quaternion.setFromUnitVectors(this.up, velocity.clone().normalize());

    this.group.add(mesh);
    this.projectiles.push({
      mesh,
      shell,
      core,
      position: shotOrigin.clone(),
      previousPosition: shotOrigin.clone(),
      velocity,
      damage: this.config.projectileDamage,
      life: 0,
      target: lockTarget ?? null,
      pulseOffset: barrelIndex * Math.PI,
    });

    this.lastShotDebug = {
      barrelIndex,
      anchor: muzzle.clone(),
      origin: shotOrigin.clone(),
      direction: direction.clone(),
    };

    this.fx.spawnMuzzleFlash(muzzle, direction, {
      strength: 1.05,
      color: barrelIndex === 0 ? "#fff0d6" : "#fff6e7",
    });
    this.cooldown = 1 / this.config.shotsPerSecond;
    return true;
  }

  clear() {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      this.removeProjectile(index);
    }

    this.cooldown = 0;
    this.nextBarrelIndex = 0;
    this.lastShotDebug = null;
  }

  getDebugState() {
    return {
      lastShot: this.lastShotDebug
        ? {
            barrelIndex: this.lastShotDebug.barrelIndex,
            anchor: this.lastShotDebug.anchor.clone(),
            origin: this.lastShotDebug.origin.clone(),
            direction: this.lastShotDebug.direction.clone(),
          }
        : null,
    };
  }

  removeProjectile(index) {
    const projectile = this.projectiles[index];
    this.group.remove(projectile.mesh);
    projectile.shell.material.dispose();
    projectile.core.material.dispose();
    this.projectiles.splice(index, 1);
  }
}

export default ProjectileSystem;
