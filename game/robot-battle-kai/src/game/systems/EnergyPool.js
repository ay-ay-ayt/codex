export class EnergyPool {
  constructor({ max, current = max }) {
    this.max = max;
    this.current = current;
  }

  get ratio() {
    return this.max > 0 ? this.current / this.max : 0;
  }

  has(amount) {
    return this.current >= amount;
  }

  spendImmediate(amount) {
    if (this.current < amount) {
      return false;
    }

    this.current -= amount;
    return true;
  }

  spendContinuous(rate, deltaSeconds) {
    const required = rate * deltaSeconds;

    if (required <= 0) {
      return 1;
    }

    const actual = Math.min(this.current, required);
    this.current -= actual;
    return actual / required;
  }

  recover(rate, deltaSeconds) {
    if (rate <= 0) {
      return;
    }

    this.current = Math.min(this.max, this.current + rate * deltaSeconds);
  }

  clamp() {
    this.current = Math.max(0, Math.min(this.max, this.current));
  }
}

export default EnergyPool;
