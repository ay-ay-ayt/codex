import nipplejs from "../../../vendor/nipplejs/nipplejs.js";

function isTouchPrimaryPointer(event) {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

export class MobileControlsOverlay {
  constructor(root) {
    this.root = root;
    this.visible = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    this.locked = true;
    this.moveX = 0;
    this.moveY = 0;
    this.vertical = 0;
    this.shootHeld = false;
    this.jetHeld = false;
    this.hoverToggleQueued = 0;
    this.lockToggleQueued = 0;
    this.lookX = 0;
    this.lookY = 0;

    this.lookPointerId = null;
    this.verticalPointerId = null;

    this.build();
  }

  build() {
    this.root.innerHTML = `
      <div class="mobile-controls ${this.visible ? "mobile-controls--visible" : ""}">
        <div class="mobile-look-zone" data-role="look-zone"></div>
        <div class="mobile-joystick-cluster">
          <div class="mobile-label">Move</div>
          <div class="mobile-joystick-shell">
            <div class="mobile-joystick-zone"></div>
          </div>
        </div>
        <div class="mobile-right-cluster">
          <div class="mobile-vertical-control">
            <div class="mobile-label">Ascend / Descend</div>
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
    `;

    this.container = this.root.querySelector(".mobile-controls");
    this.lookZone = this.root.querySelector(".mobile-look-zone");
    this.joystickZone = this.root.querySelector(".mobile-joystick-zone");
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

    this.joystickManager = nipplejs.create({
      zone: this.joystickZone,
      mode: "static",
      position: { left: "50%", top: "50%" },
      size: 128,
      color: "#f0c38f",
      fadeTime: 0,
    });

    this.joystickManager.on("move", (_event, data) => {
      const force = Math.min(data.force ?? 0, 1);
      this.moveX = (data.vector?.x ?? 0) * force;
      this.moveY = -(data.vector?.y ?? 0) * force;
    });

    this.joystickManager.on("end", () => {
      this.moveX = 0;
      this.moveY = 0;
    });

    this.boundVerticalDown = this.onVerticalDown.bind(this);
    this.boundVerticalMove = this.onVerticalMove.bind(this);
    this.boundVerticalUp = this.onVerticalUp.bind(this);
    this.boundLookDown = this.onLookDown.bind(this);
    this.boundLookMove = this.onLookMove.bind(this);
    this.boundLookUp = this.onLookUp.bind(this);

    this.verticalControl.addEventListener("pointerdown", this.boundVerticalDown);
    window.addEventListener("pointermove", this.boundVerticalMove);
    window.addEventListener("pointerup", this.boundVerticalUp);
    window.addEventListener("pointercancel", this.boundVerticalUp);

    this.lookZone.addEventListener("pointerdown", this.boundLookDown);
    window.addEventListener("pointermove", this.boundLookMove);
    window.addEventListener("pointerup", this.boundLookUp);
    window.addEventListener("pointercancel", this.boundLookUp);

    this.bindHoldButton(this.shootButton, (pressed) => {
      this.shootHeld = pressed;
    });
    this.bindHoldButton(this.jetButton, (pressed) => {
      this.jetHeld = pressed;
    });

    this.hoverButton.addEventListener("click", () => {
      this.hoverToggleQueued += 1;
      this.hoverButton.classList.toggle("mobile-action--armed");
    });

    this.lockButton.addEventListener("click", () => {
      this.lockToggleQueued += 1;
    });
  }

  bindHoldButton(button, setter) {
    if (!button) {
      return;
    }

    const start = (event) => {
      event.preventDefault();
      setter(true);
      button.classList.add("mobile-action--active");
    };
    const end = () => {
      setter(false);
      button.classList.remove("mobile-action--active");
    };

    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", end);
    button.addEventListener("pointercancel", end);
    button.addEventListener("pointerleave", end);
  }

  onVerticalDown(event) {
    if (!isTouchPrimaryPointer(event)) {
      return;
    }

    this.verticalPointerId = event.pointerId;
    this.verticalControl.setPointerCapture?.(event.pointerId);
    this.updateVerticalAxis(event.clientY);
  }

  onVerticalMove(event) {
    if (event.pointerId !== this.verticalPointerId) {
      return;
    }

    this.updateVerticalAxis(event.clientY);
  }

  onVerticalUp(event) {
    if (event.pointerId !== this.verticalPointerId) {
      return;
    }

    this.verticalPointerId = null;
    this.vertical = 0;
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
    if (!isTouchPrimaryPointer(event) || this.locked) {
      return;
    }

    this.lookPointerId = event.pointerId;
    this.lookLastX = event.clientX;
    this.lookLastY = event.clientY;
  }

  onLookMove(event) {
    if (event.pointerId !== this.lookPointerId || this.locked) {
      return;
    }

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
      jetHeld: this.jetHeld,
      hoverTogglePressed: this.hoverToggleQueued > 0,
      lockTogglePressed: this.lockToggleQueued > 0,
      lookX: this.lookX,
      lookY: this.lookY,
    };

    this.hoverToggleQueued = 0;
    this.lockToggleQueued = 0;
    this.lookX = 0;
    this.lookY = 0;

    return frame;
  }

  dispose() {
    this.joystickManager?.destroy();
  }
}

export default MobileControlsOverlay;
