export class FixedStepLoop {
  constructor({
    update,
    render,
    fixedDelta = 1 / 60,
    maxSubSteps = 5,
  }) {
    this.update = update;
    this.render = render;
    this.fixedDelta = fixedDelta;
    this.maxSubSteps = maxSubSteps;
    this.accumulator = 0;
    this.running = false;
    this.lastTime = 0;
    this.frameHandle = 0;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastTime = performance.now() * 0.001;
    this.frameHandle = window.requestAnimationFrame(this.frame);
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.running = false;
    window.cancelAnimationFrame(this.frameHandle);
  }

  frame(nowMs) {
    if (!this.running) {
      return;
    }

    const now = nowMs * 0.001;
    let delta = now - this.lastTime;
    this.lastTime = now;

    if (!Number.isFinite(delta) || delta < 0) {
      delta = this.fixedDelta;
    }

    delta = Math.min(delta, 0.25);
    this.accumulator += delta;

    let subSteps = 0;

    while (this.accumulator >= this.fixedDelta && subSteps < this.maxSubSteps) {
      this.update(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
      subSteps += 1;
    }

    if (subSteps === this.maxSubSteps) {
      this.accumulator = 0;
    }

    const alpha = this.accumulator / this.fixedDelta;
    this.render(alpha);
    this.frameHandle = window.requestAnimationFrame(this.frame);
  }
}

export default FixedStepLoop;
