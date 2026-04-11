function isTouchPrimaryPointer(event) {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

function applyCircularDeadzone(x, y, deadzone = 0.12) {
  const magnitude = Math.min(Math.hypot(x, y), 1);

  if (magnitude <= deadzone || magnitude <= 0.0001) {
    return { x: 0, y: 0 };
  }

  const scaledMagnitude = (magnitude - deadzone) / (1 - deadzone);
  const scale = scaledMagnitude / magnitude;

  return {
    x: x * scale,
    y: y * scale,
  };
}

export class MobileControlsOverlay {
  constructor(root, { forceVisible = false } = {}) {
    this.root = root;
    this.forceVisible = Boolean(forceVisible);
    this.visible =
      this.forceVisible ||
      window.matchMedia("(pointer: coarse)").matches ||
      "ontouchstart" in window;
    this.locked = true;
    this.moveX = 0;
    this.moveY = 0;
    this.vertical = 0;
    this.shootHeld = false;
    this.jetPressedQueued = 0;
    this.hoverToggleQueued = 0;
    this.lockToggleQueued = 0;
    this.lookX = 0;
    this.lookY = 0;

    this.joystickPointerId = null;
    this.lookPointerId = null;
    this.verticalPointerId = null;
    this.lookLastX = 0;
    this.lookLastY = 0;
    this.verificationButtonProbe = null;

    this.cleanupCallbacks = [];

    this.build();
  }

  build() {
    this.root.innerHTML = `
      <div class="mobile-controls ${this.visible ? "mobile-controls--visible" : ""} ${this.forceVisible ? "mobile-controls--forced" : ""}">
        <div class="mobile-look-zone" data-role="look-zone"></div>

        <div class="mobile-joystick-cluster">
          <div class="mobile-cluster-card">
            <div class="mobile-cluster-header">
              <div class="mobile-label">Drive</div>
              <div class="mobile-caption">Move</div>
            </div>
            <div class="mobile-joystick-shell">
              <div class="mobile-joystick-thumb"></div>
            </div>
          </div>
        </div>

        <div class="mobile-right-cluster">
          <div class="mobile-cluster-card mobile-cluster-card--flight">
            <div class="mobile-vertical-control">
              <div class="mobile-label">Altitude</div>
              <div class="mobile-caption">Ascend / Descend</div>
              <div class="mobile-vertical-track">
                <div class="mobile-vertical-thumb"></div>
              </div>
            </div>

            <div class="mobile-action-grid">
              <button class="mobile-action mobile-action--shoot" data-action="shoot" type="button">Shoot</button>
              <button class="mobile-action mobile-action--jet" data-action="jet" type="button">Jet</button>
              <button class="mobile-action mobile-action--hover" data-action="hover" type="button">Hover</button>
              <button class="mobile-action mobile-action--lock" data-action="lock" type="button">Lock</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.container = this.root.querySelector(".mobile-controls");
    this.lookZone = this.root.querySelector(".mobile-look-zone");
    this.joystickShell = this.root.querySelector(".mobile-joystick-shell");
    this.joystickThumb = this.root.querySelector(".mobile-joystick-thumb");
    this.verticalControl = this.root.querySelector(".mobile-vertical-control");
    this.verticalTrack = this.root.querySelector(".mobile-vertical-track");
    this.verticalThumb = this.root.querySelector(".mobile-vertical-thumb");
    this.shootButton = this.root.querySelector('[data-action="shoot"]');
    this.jetButton = this.root.querySelector('[data-action="jet"]');
    this.hoverButton = this.root.querySelector('[data-action="hover"]');
    this.lockButton = this.root.querySelector('[data-action="lock"]');

    if (!this.visible) {
      return;
    }

    this.boundJoystickDown = this.onJoystickDown.bind(this);
    this.boundJoystickMove = this.onJoystickMove.bind(this);
    this.boundJoystickUp = this.onJoystickUp.bind(this);
    this.boundVerticalDown = this.onVerticalDown.bind(this);
    this.boundVerticalMove = this.onVerticalMove.bind(this);
    this.boundVerticalUp = this.onVerticalUp.bind(this);
    this.boundLookDown = this.onLookDown.bind(this);
    this.boundLookMove = this.onLookMove.bind(this);
    this.boundLookUp = this.onLookUp.bind(this);
    this.boundHoverClick = () => {
      this.hoverToggleQueued += 1;
      this.hoverButton.classList.toggle("mobile-action--armed");
    };
    this.boundLockClick = () => {
      this.lockToggleQueued += 1;
    };

    this.addListener(this.joystickShell, "pointerdown", this.boundJoystickDown);
    this.addListener(window, "pointermove", this.boundJoystickMove, { passive: false });
    this.addListener(window, "pointerup", this.boundJoystickUp);
    this.addListener(window, "pointercancel", this.boundJoystickUp);

    this.addListener(this.verticalControl, "pointerdown", this.boundVerticalDown);
    this.addListener(window, "pointermove", this.boundVerticalMove, { passive: false });
    this.addListener(window, "pointerup", this.boundVerticalUp);
    this.addListener(window, "pointercancel", this.boundVerticalUp);

    this.addListener(this.lookZone, "pointerdown", this.boundLookDown);
    this.addListener(window, "pointermove", this.boundLookMove, { passive: false });
    this.addListener(window, "pointerup", this.boundLookUp);
    this.addListener(window, "pointercancel", this.boundLookUp);

    this.bindHoldButton(this.shootButton, (pressed) => {
      this.shootHeld = pressed;
    });
    this.bindPressButton(this.jetButton, () => {
      this.jetPressedQueued += 1;
    });

    this.addListener(this.hoverButton, "click", this.boundHoverClick);
    this.addListener(this.lockButton, "click", this.boundLockClick);
  }

  addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this.cleanupCallbacks.push(() => {
      target.removeEventListener(type, handler, options);
    });
  }

  bindHoldButton(button, setter) {
    if (!button) {
      return;
    }

    let activePointerId = null;

    const start = (event) => {
      if (!isTouchPrimaryPointer(event) || activePointerId !== null) {
        return;
      }

      event.preventDefault();
      activePointerId = event.pointerId;
      button.setPointerCapture?.(event.pointerId);
      setter(true);
      button.classList.add("mobile-action--active");
    };

    const end = (event) => {
      if (activePointerId === null || event.pointerId !== activePointerId) {
        return;
      }

      activePointerId = null;
      setter(false);
      button.classList.remove("mobile-action--active");
    };

    this.addListener(button, "pointerdown", start);
    this.addListener(button, "pointerup", end);
    this.addListener(button, "pointercancel", end);
    this.addListener(button, "lostpointercapture", end);
  }

  bindPressButton(button, onPress) {
    if (!button) {
      return;
    }

    let activePointerId = null;

    const start = (event) => {
      if (!isTouchPrimaryPointer(event) || activePointerId !== null) {
        return;
      }

      event.preventDefault();
      activePointerId = event.pointerId;
      button.setPointerCapture?.(event.pointerId);
      onPress();
      button.classList.add("mobile-action--active");
    };

    const end = (event) => {
      if (activePointerId === null || event.pointerId !== activePointerId) {
        return;
      }

      activePointerId = null;
      button.classList.remove("mobile-action--active");
    };

    this.addListener(button, "pointerdown", start);
    this.addListener(button, "pointerup", end);
    this.addListener(button, "pointercancel", end);
    this.addListener(button, "lostpointercapture", end);
  }

  setVerificationButtonProbe(action) {
    const allowed = new Set(["shoot", "jet", "hover", "lock"]);
    const normalized = typeof action === "string" ? action.trim().toLowerCase() : "";

    this.verificationButtonProbe = allowed.has(normalized) ? normalized : null;
    this.applyVerificationButtonVisualState();
  }

  applyVerificationButtonVisualState() {
    this.shootButton?.classList.remove("mobile-action--active");
    this.jetButton?.classList.remove("mobile-action--active");
    this.hoverButton?.classList.remove("mobile-action--active", "mobile-action--armed");
    this.lockButton?.classList.remove("mobile-action--active");

    switch (this.verificationButtonProbe) {
      case "shoot":
        this.shootButton?.classList.add("mobile-action--active");
        break;
      case "jet":
        this.jetButton?.classList.add("mobile-action--active");
        break;
      case "hover":
        this.hoverButton?.classList.add("mobile-action--active", "mobile-action--armed");
        break;
      case "lock":
        this.lockButton?.classList.add("mobile-action--active");
        break;
      default:
        break;
    }
  }

  onJoystickDown(event) {
    if (!isTouchPrimaryPointer(event) || this.joystickPointerId !== null) {
      return;
    }

    event.preventDefault();
    this.joystickPointerId = event.pointerId;
    this.joystickShell.setPointerCapture?.(event.pointerId);
    this.joystickShell.classList.add("mobile-joystick-shell--active");
    this.updateJoystickAxis(event.clientX, event.clientY);
  }

  onJoystickMove(event) {
    if (event.pointerId !== this.joystickPointerId) {
      return;
    }

    event.preventDefault();
    this.updateJoystickAxis(event.clientX, event.clientY);
  }

  onJoystickUp(event) {
    if (event.pointerId !== this.joystickPointerId) {
      return;
    }

    this.joystickPointerId = null;
    this.moveX = 0;
    this.moveY = 0;
    this.joystickShell.classList.remove("mobile-joystick-shell--active");
    this.joystickThumb.style.transform = "translate(-50%, -50%)";
  }

  updateJoystickAxis(clientX, clientY) {
    const bounds = this.joystickShell.getBoundingClientRect();
    const radius = Math.max(22, Math.min(bounds.width, bounds.height) * 0.34);
    const centerX = bounds.left + bounds.width * 0.5;
    const centerY = bounds.top + bounds.height * 0.5;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const length = Math.hypot(deltaX, deltaY);
    const clampScale = length > radius ? radius / length : 1;
    const clampedX = deltaX * clampScale;
    const clampedY = deltaY * clampScale;
    const normalized = applyCircularDeadzone(clampedX / radius, clampedY / radius);

    this.moveX = normalized.x;
    this.moveY = -normalized.y;
    this.joystickThumb.style.transform =
      `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
  }

  onVerticalDown(event) {
    if (!isTouchPrimaryPointer(event) || this.verticalPointerId !== null) {
      return;
    }

    event.preventDefault();
    this.verticalPointerId = event.pointerId;
    this.verticalControl.setPointerCapture?.(event.pointerId);
    this.verticalControl.classList.add("mobile-vertical-control--active");
    this.updateVerticalAxis(event.clientY);
  }

  onVerticalMove(event) {
    if (event.pointerId !== this.verticalPointerId) {
      return;
    }

    event.preventDefault();
    this.updateVerticalAxis(event.clientY);
  }

  onVerticalUp(event) {
    if (event.pointerId !== this.verticalPointerId) {
      return;
    }

    this.verticalPointerId = null;
    this.vertical = 0;
    this.verticalControl.classList.remove("mobile-vertical-control--active");
    this.verticalThumb.style.transform = "translate(-50%, -50%)";
  }

  updateVerticalAxis(clientY) {
    const bounds = this.verticalTrack.getBoundingClientRect();
    const normalized = 1 - (clientY - bounds.top) / bounds.height;
    this.vertical = Math.max(-1, Math.min(1, normalized * 2 - 1));
    const thumbY = (1 - (this.vertical + 1) * 0.5) * bounds.height;
    this.verticalThumb.style.transform = `translate(-50%, ${thumbY - bounds.height / 2}px)`;
  }

  onLookDown(event) {
    if (!isTouchPrimaryPointer(event) || this.locked || this.lookPointerId !== null) {
      return;
    }

    event.preventDefault();
    this.lookPointerId = event.pointerId;
    this.lookZone.setPointerCapture?.(event.pointerId);
    this.lookLastX = event.clientX;
    this.lookLastY = event.clientY;
  }

  onLookMove(event) {
    if (event.pointerId !== this.lookPointerId || this.locked) {
      return;
    }

    event.preventDefault();
    this.lookX += event.clientX - this.lookLastX;
    this.lookY += event.clientY - this.lookLastY;
    this.lookLastX = event.clientX;
    this.lookLastY = event.clientY;
  }

  onLookUp(event) {
    if (event.pointerId !== this.lookPointerId) {
      return;
    }

    this.lookPointerId = null;
  }

  setLockState(locked) {
    this.locked = locked;
    this.container?.classList.toggle("mobile-controls--locked", locked);

    if (locked) {
      this.lookPointerId = null;
    }
  }

  consume() {
    const frame = {
      visible: this.visible,
      moveX: this.moveX,
      moveY: this.moveY,
      vertical: this.vertical,
      shootHeld: this.shootHeld,
      jetPressed: this.jetPressedQueued > 0,
      hoverTogglePressed: this.hoverToggleQueued > 0,
      lockTogglePressed: this.lockToggleQueued > 0,
      lookX: this.lookX,
      lookY: this.lookY,
    };

    this.hoverToggleQueued = 0;
    this.lockToggleQueued = 0;
    this.jetPressedQueued = 0;
    this.lookX = 0;
    this.lookY = 0;

    return frame;
  }

  reset() {
    this.moveX = 0;
    this.moveY = 0;
    this.vertical = 0;
    this.shootHeld = false;
    this.jetPressedQueued = 0;
    this.hoverToggleQueued = 0;
    this.lockToggleQueued = 0;
    this.lookX = 0;
    this.lookY = 0;
    this.joystickPointerId = null;
    this.lookPointerId = null;
    this.verticalPointerId = null;
    this.lookLastX = 0;
    this.lookLastY = 0;

    this.joystickShell?.classList.remove("mobile-joystick-shell--active");
    this.verticalControl?.classList.remove("mobile-vertical-control--active");
    this.shootButton?.classList.remove("mobile-action--active");
    this.jetButton?.classList.remove("mobile-action--active");
    this.hoverButton?.classList.remove("mobile-action--armed");
    this.lockButton?.classList.remove("mobile-action--active");
    this.joystickThumb?.style.setProperty("transform", "translate(-50%, -50%)");
    this.verticalThumb?.style.setProperty("transform", "translate(-50%, -50%)");
    this.applyVerificationButtonVisualState();
  }

  dispose() {
    for (const cleanup of this.cleanupCallbacks.splice(0)) {
      cleanup();
    }
  }
}

export default MobileControlsOverlay;
