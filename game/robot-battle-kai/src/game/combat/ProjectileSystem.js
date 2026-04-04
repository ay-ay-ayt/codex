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
    this.projectiles = [];

    this.projectileGeometry = new THREE.CapsuleGeometry(0.18, 0.7, 4, 8);
    this.projectileMaterial = new THREE.MeshBasicMaterial({
      color: "#ffd089",
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.tmpOrigin = new THREE.Vector3();
    this.tmpDirection = new THREE.Vector3();
    this.tmpTarget = new THREE.Vector3();
    this.tmpVelocity = new THREE.Vector3();
    this.tmpQuaternion = new THREE.Quaternion();
    this.up = new THREE.Vector3(0, 1, 0);
  }

  update(deltaSeconds, { input, player, boss, arena, aimDirection, lockTarget }) {
    this.cooldown = Math.max(0, this.cooldown - deltaSeconds);

    if (input.shootHeld) {
      this.tryFire(player, aimDirection, lockTarget);
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

      if (projectile.position.y <= groundY + 0.18) {
        this.fx.spawnImpact(projectile.position, { weak: false, color: "#f4bc78" });
        this.removeProjectile(index);
        continue;
      }

      if (projectile.life >= this.config.projectileLifetime) {
        this.removeProjectile(index);
      }
    }
  }

  tryFire(player, aimDirection, lockTarget) {
    if (this.cooldown > 0 || !player.energy.spendImmediate(this.energyRules.shootCost)) {
      return false;
    }

    const muzzle = player.getMuzzleWorldPosition(this.tmpOrigin);
    const direction = this.tmpDirection.copy(aimDirection).normalize();
    const velocity = direction.multiplyScalar(this.config.projectileSpeed).clone();
    const mesh = new THREE.Mesh(this.projectileGeometry, this.projectileMaterial.clone());

    mesh.position.copy(muzzle);
    mesh.quaternion.setFromUnitVectors(this.up, velocity.clone().normalize());

    this.group.add(mesh);
    this.projectiles.push({
      mesh,
      position: muzzle.clone(),
      previousPosition: muzzle.clone(),
      velocity,
      damage: this.config.projectileDamage,
      life: 0,
      target: lockTarget ?? null,
    });

    this.fx.spawnMuzzleFlash(muzzle, velocity.clone().normalize());
    this.cooldown = 1 / this.config.shotsPerSecond;
    return true;
  }

  removeProjectile(index) {
    const projectile = this.projectiles[index];
    this.group.remove(projectile.mesh);
    projectile.mesh.material.dispose();
    this.projectiles.splice(index, 1);
  }
}

export default ProjectileSystem;
