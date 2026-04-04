import { MobileControlsOverlay } from "./MobileControlsOverlay.js";

export class InputCoordinator {
  constructor({ canvas, root }) {
    this.canvas = canvas;
    this.root = root;
    this.keys = new Set();
    this.pointerButtons = new Set();
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.hoverToggleQueued = 0;
    this.lockToggleQueued = 0;
    this.mouseDragging = false;
    this.isLockedOn = true;

    this.boundKeyDown = this.onKeyDown.bind(this);
    this.boundKeyUp = this.onKeyUp.bind(this);
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundContextMenu = (event) => event.preventDefault();

    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    this.canvas.addEventListener("pointerdown", this.boundPointerDown);
    window.addEventListener("pointermove", this.boundPointerMove, { passive: false });
    window.addEventListener("pointerup", this.boundPointerUp);
    window.addEventListener("pointercancel", this.boundPointerUp);
    this.canvas.addEventListener("contextmenu", this.boundContextMenu);

    this.mobileOverlay = new MobileControlsOverlay(root);
  }

  setLockState(isLocked) {
    this.isLockedOn = isLocked;
    this.mobileOverlay.setLockState(isLocked);
  }

  onKeyDown(event) {
    if (event.repeat) {
      this.keys.add(event.code);
      return;
    }

    this.keys.add(event.code);

    if (event.code === "KeyE") {
      this.hoverToggleQueued += 1;
    }

    if (event.code === "KeyQ") {
      this.lockToggleQueued += 1;
    }
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  onPointerDown(event) {
    this.pointerButtons.add(event.button);

    if (event.button === 2) {
      this.mouseDragging = true;
    }
  }

  onPointerMove(event) {
    if (!this.mouseDragging || this.isLockedOn) {
      return;
    }

    event.preventDefault();
    this.lookDeltaX += event.movementX ?? 0;
    this.lookDeltaY += event.movementY ?? 0;
  }

  onPointerUp(event) {
    this.pointerButtons.delete(event.button);

    if (event.button === 2) {
      this.mouseDragging = false;
    }
  }

  consume() {
    const mobile = this.mobileOverlay.consume();
    const moveX =
      (this.keys.has("KeyD") ? 1 : 0) -
      (this.keys.has("KeyA") ? 1 : 0) +
      mobile.moveX;
    const moveY =
      (this.keys.has("KeyW") ? 1 : 0) -
      (this.keys.has("KeyS") ? 1 : 0) +
      mobile.moveY;
    const ascend = (this.keys.has("Space") ? 1 : 0) + Math.max(0, mobile.vertical);
    const descend =
      (this.keys.has("ControlLeft") || this.keys.has("ControlRight") ? 1 : 0) +
      Math.max(0, -mobile.vertical);

    const clampedMoveX = Math.max(-1, Math.min(1, moveX));
    const clampedMoveY = Math.max(-1, Math.min(1, moveY));

    const frame = {
      moveX: clampedMoveX,
      moveY: clampedMoveY,
      vertical: Math.max(-1, Math.min(1, ascend - descend)),
      shootHeld: this.pointerButtons.has(0) || mobile.shootHeld,
      jetHeld: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") || mobile.jetHeld,
      hoverTogglePressed: this.hoverToggleQueued > 0 || mobile.hoverTogglePressed,
      lockTogglePressed: this.lockToggleQueued > 0 || mobile.lockTogglePressed,
      lookX: this.lookDeltaX + mobile.lookX,
      lookY: this.lookDeltaY + mobile.lookY,
      usingTouch: mobile.visible,
    };

    this.hoverToggleQueued = 0;
    this.lockToggleQueued = 0;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;

    return frame;
  }

  dispose() {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    this.canvas.removeEventListener("pointerdown", this.boundPointerDown);
    window.removeEventListener("pointermove", this.boundPointerMove);
    window.removeEventListener("pointerup", this.boundPointerUp);
    window.removeEventListener("pointercancel", this.boundPointerUp);
    this.canvas.removeEventListener("contextmenu", this.boundContextMenu);
    this.mobileOverlay.dispose();
  }
}

export default InputCoordinator;
