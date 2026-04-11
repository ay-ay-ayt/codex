import * as THREE from "three";

function createMarkerMaterial(color) {
  return new THREE.MeshBasicMaterial({
    color,
    depthWrite: false,
    depthTest: false,
    transparent: true,
    opacity: 0.94,
  });
}

function createLineMaterial(color) {
  return new THREE.LineBasicMaterial({
    color,
    depthWrite: false,
    depthTest: false,
    transparent: true,
    opacity: 0.92,
  });
}

export class VerificationDebugOverlay {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = "VerificationDebugOverlay";
    this.group.visible = false;
    this.scene.add(this.group);

    this.markerGeometry = new THREE.SphereGeometry(0.18, 18, 18);
    this.markers = new Map();
    this.lines = new Map();
  }

  setEnabled(enabled) {
    this.group.visible = enabled;
  }

  update(snapshot) {
    if (!this.group.visible || !snapshot) {
      return;
    }

    const isBarrelScenario =
      snapshot.scenario === "left-barrel-fire" ||
      snapshot.scenario === "right-barrel-fire" ||
      snapshot.scenario === "left-barrel-fire-macro" ||
      snapshot.scenario === "right-barrel-fire-macro" ||
      snapshot.scenario === "left-barrel-fire-top" ||
      snapshot.scenario === "right-barrel-fire-top" ||
      snapshot.scenario === "left-barrel-fire-moving" ||
      snapshot.scenario === "right-barrel-fire-moving";
    const activeMarkers = new Set();
    const activeLines = new Set();

    const drawPoint = (key, position, color, scale = 1) => {
      if (!position) {
        return;
      }

      const marker = this.getMarker(key, color);
      marker.visible = true;
      marker.position.copy(position);
      marker.scale.setScalar(scale);
      activeMarkers.add(key);
    };

    const drawVector = (key, position, direction, length, color, scale = 1) => {
      if (!position) {
        return;
      }

      drawPoint(key, position, color, scale);

      if (!direction || length <= 0) {
        return;
      }

      const line = this.getLine(key, color);
      const end = position.clone().addScaledVector(direction, length);
      line.visible = true;
      line.geometry.setFromPoints([position, end]);
      activeLines.add(key);
    };

    if (!isBarrelScenario) {
      for (const [index, anchor] of (snapshot.player?.rawJetAnchors ?? []).entries()) {
        drawPoint(`raw-jet-anchor-${index}`, anchor.position, "#23fff2", 0.72);
      }

      for (const [index, anchor] of (snapshot.player?.jetAnchors ?? []).entries()) {
        drawVector(`jet-anchor-${index}`, anchor.position, anchor.direction, 2.2, "#61f0ff", 1.2);
      }

      for (const [index, anchor] of (snapshot.player?.footJetAnchors ?? []).entries()) {
        drawVector(`foot-jet-anchor-${index}`, anchor.position, anchor.direction, 1.55, "#f3ffff", 1.05);
      }
    }

    for (const [index, anchor] of (snapshot.player?.rawGunAnchors ?? []).entries()) {
      drawPoint(`raw-gun-anchor-${index}`, anchor.position, "#a04cff", isBarrelScenario ? 1.28 : 0.92);
    }

    for (const [index, axes] of (snapshot.player?.gunAxes ?? []).entries()) {
      if (!axes?.origin) {
        continue;
      }

      drawPoint(`gun-axis-x-point-${index}`, axes.x, "#ff5a5a", 0.72);
      drawPoint(`gun-axis-y-point-${index}`, axes.y, "#6cff72", 0.72);
      drawPoint(`gun-axis-z-point-${index}`, axes.z, "#59a6ff", 0.72);

      const lineX = this.getLine(`gun-axis-x-${index}`, "#ff5a5a");
      lineX.visible = true;
      lineX.geometry.setFromPoints([axes.origin, axes.x ?? axes.origin]);
      activeLines.add(`gun-axis-x-${index}`);

      const lineY = this.getLine(`gun-axis-y-${index}`, "#6cff72");
      lineY.visible = true;
      lineY.geometry.setFromPoints([axes.origin, axes.y ?? axes.origin]);
      activeLines.add(`gun-axis-y-${index}`);

      const lineZ = this.getLine(`gun-axis-z-${index}`, "#59a6ff");
      lineZ.visible = true;
      lineZ.geometry.setFromPoints([axes.origin, axes.z ?? axes.origin]);
      activeLines.add(`gun-axis-z-${index}`);
    }

    for (const [index, anchor] of (snapshot.player?.gunAnchors ?? []).entries()) {
      drawPoint(
        `gun-anchor-${index}`,
        anchor.position,
        isBarrelScenario ? "#57ffad" : "#ff9c2f",
        isBarrelScenario ? 1.46 : 1.18,
      );
    }

    if (snapshot.projectiles?.lastShot) {
      drawPoint(
        "shot-anchor",
        snapshot.projectiles.lastShot.anchor,
        isBarrelScenario ? "#57ffad" : "#ff2db2",
        isBarrelScenario ? 1.5 : 1.2,
      );
      drawVector(
        "shot-origin",
        snapshot.projectiles.lastShot.origin,
        snapshot.projectiles.lastShot.direction,
        3.6,
        isBarrelScenario ? "#b8ff5f" : "#9cff6a",
        isBarrelScenario ? 1.52 : 1.26,
      );
    }

    if (snapshot.fx?.lastMuzzle) {
      drawVector(
        "fx-muzzle",
        snapshot.fx.lastMuzzle.origin,
        snapshot.fx.lastMuzzle.direction,
        2.3,
        isBarrelScenario ? "#7dfdff" : "#ffffff",
        isBarrelScenario ? 1.36 : 1.12,
      );
    }

    for (const [index, muzzle] of (snapshot.fx?.activeMuzzles ?? []).entries()) {
      drawPoint(
        `fx-active-core-${index}`,
        muzzle.core,
        "#fff4be",
        isBarrelScenario ? 0.7 : 0.54,
      );
      drawPoint(
        `fx-active-wake-${index}`,
        muzzle.wake,
        "#ffb889",
        isBarrelScenario ? 0.58 : 0.46,
      );
      drawPoint(
        `fx-active-bloom-${index}`,
        muzzle.bloom,
        "#94f3ff",
        isBarrelScenario ? 0.48 : 0.38,
      );
      drawPoint(
        `fx-active-ring-${index}`,
        muzzle.ring,
        "#ffe2c6",
        isBarrelScenario ? 0.44 : 0.34,
      );
    }

    for (const [index, exhaust] of (snapshot.fx?.recentExhaust ?? []).entries()) {
      drawVector(
        `fx-exhaust-${index}`,
        exhaust.origin,
        exhaust.direction,
        exhaust.type === "jet" ? 2.2 : 1.5,
        exhaust.type === "jet" ? "#7ceeff" : "#8be0ff",
        exhaust.type === "jet" ? 1.05 : 0.8,
      );
    }

    if (!isBarrelScenario && snapshot.camera?.position && snapshot.camera?.lookTarget) {
      drawPoint("camera-position", snapshot.camera.position, "#98ff89", 1.15);
      drawPoint("camera-look", snapshot.camera.lookTarget, "#e8c04a", 0.88);

      const line = this.getLine("camera-view", "#9ef1a0");
      line.visible = true;
      line.geometry.setFromPoints([snapshot.camera.position, snapshot.camera.lookTarget]);
      activeLines.add("camera-view");
    }

    if (snapshot.boss?.aimPoint) {
      drawPoint("boss-aim", snapshot.boss.aimPoint, "#ff7c5d", 1.2);
    }

    this.hideUnused(this.markers, activeMarkers);
    this.hideUnused(this.lines, activeLines);
  }

  hideUnused(map, activeKeys) {
    for (const [key, entry] of map.entries()) {
      entry.visible = activeKeys.has(key);
    }
  }

  getMarker(key, color) {
    let marker = this.markers.get(key);

    if (!marker) {
      marker = new THREE.Mesh(this.markerGeometry, createMarkerMaterial(color));
      marker.renderOrder = 1000;
      this.group.add(marker);
      this.markers.set(key, marker);
    }

    return marker;
  }

  getLine(key, color) {
    let line = this.lines.get(key);

    if (!line) {
      line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(0, 0.1, 0),
        ]),
        createLineMaterial(color),
      );
      line.renderOrder = 1000;
      this.group.add(line);
      this.lines.set(key, line);
    }

    return line;
  }
}

export default VerificationDebugOverlay;
