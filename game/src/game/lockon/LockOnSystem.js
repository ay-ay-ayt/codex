export class LockOnSystem {
  constructor(config) {
    this.config = config;
    this.targets = [];
    this.currentTarget = null;
    this.outOfBoundsTimer = 0;
  }

  registerTarget(target) {
    this.targets.push(target);
  }

  setInitialTarget(target) {
    this.currentTarget = target;
    this.outOfBoundsTimer = 0;
  }

  toggle(origin, cameraForward) {
    if (this.currentTarget) {
      this.clear();
      return null;
    }

    const target = this.findBestTarget(origin, cameraForward);

    if (target) {
      this.currentTarget = target;
      this.outOfBoundsTimer = 0;
    }

    return this.currentTarget;
  }

  clear() {
    this.currentTarget = null;
    this.outOfBoundsTimer = 0;
  }

  get target() {
    return this.currentTarget;
  }

  update(deltaSeconds, origin, cameraForward) {
    if (!this.currentTarget) {
      return null;
    }

    const target = this.currentTarget;

    if (!target.isAlive()) {
      this.clear();
      return null;
    }

    const targetPosition = target.getAimPoint();
    const dx = targetPosition.x - origin.x;
    const dy = targetPosition.y - origin.y;
    const dz = targetPosition.z - origin.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > this.config.hardBreakDistance) {
      this.clear();
      return null;
    }

    const inverseDistance = distance > 0.0001 ? 1 / distance : 1;
    const dot =
      cameraForward.x * dx * inverseDistance +
      cameraForward.y * dy * inverseDistance +
      cameraForward.z * dz * inverseDistance;
    const inSoftRange =
      distance <= this.config.acquireDistance && dot >= this.config.viewDotThreshold;

    if (inSoftRange) {
      this.outOfBoundsTimer = 0;
      return target;
    }

    this.outOfBoundsTimer += deltaSeconds;

    if (this.outOfBoundsTimer >= this.config.graceSeconds) {
      this.clear();
      return null;
    }

    return target;
  }

  findBestTarget(origin, cameraForward) {
    let bestTarget = null;
    let bestScore = -Infinity;

    for (const target of this.targets) {
      if (!target.isAlive()) {
        continue;
      }

      const position = target.getAimPoint();
      const dx = position.x - origin.x;
      const dy = position.y - origin.y;
      const dz = position.z - origin.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance > this.config.acquireDistance) {
        continue;
      }

      const inverseDistance = distance > 0.0001 ? 1 / distance : 1;
      const dot =
        cameraForward.x * dx * inverseDistance +
        cameraForward.y * dy * inverseDistance +
        cameraForward.z * dz * inverseDistance;

      if (dot < this.config.viewDotThreshold) {
        continue;
      }

      const score = dot * 1000 - distance;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }

    return bestTarget;
  }
}

export default LockOnSystem;
