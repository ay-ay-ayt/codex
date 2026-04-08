import * as THREE from "three";

const controlledLegPattern = /^DEF-(?:HIPS(?:_|$)|LEG[LR](?:_|$)|KNEE[LR](?:_|$)|ANKLE[LR](?:_|$)|FOOT[LR](?:_|$)|TOE[LR](?:_|$))/i;

const stressWeights = Object.freeze({
  hips: 0.32,
  leg: 1,
  knee: 0.72,
  ankle: 0.4,
  foot: 0.5,
  toe: 0.34,
  other: 0.2,
});

const tmpDeltaQuaternion = new THREE.Quaternion();
const tmpInverseQuaternion = new THREE.Quaternion();
const tmpBounds = new THREE.Box3();
const tmpBoundsCenter = new THREE.Vector3();
const tmpWorldPosition = new THREE.Vector3();
const tmpAmplifiedQuaternion = new THREE.Quaternion();
const tmpAxis = new THREE.Vector3();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function classifySide(name) {
  const normalized = String(name ?? "").toUpperCase();

  if (
    /(\.|_|-)L(\.|_|-|$)/i.test(name) ||
    /LEFT/i.test(name) ||
    /(LEG|KNEE|ANKLE|FOOT|TOE|SHIN|THIGH|HIP)L(?:_|$)/i.test(normalized) ||
    /-XL(?:_|$)/i.test(normalized) ||
    /-YL(?:_|$)/i.test(normalized) ||
    /-ZL(?:_|$)/i.test(normalized)
  ) {
    return "left";
  }

  if (
    /(\.|_|-)R(\.|_|-|$)/i.test(name) ||
    /RIGHT/i.test(name) ||
    /(LEG|KNEE|ANKLE|FOOT|TOE|SHIN|THIGH|HIP)R(?:_|$)/i.test(normalized) ||
    /-XR(?:_|$)/i.test(normalized) ||
    /-YR(?:_|$)/i.test(normalized) ||
    /-ZR(?:_|$)/i.test(normalized)
  ) {
    return "right";
  }

  return "center";
}

function classifyBoneCategory(name) {
  const normalized = String(name ?? "").toUpperCase();

  if (normalized.includes("HIPS")) {
    return "hips";
  }

  if (normalized.includes("KNEE")) {
    return "knee";
  }

  if (normalized.includes("ANKLE")) {
    return "ankle";
  }

  if (normalized.includes("FOOT")) {
    return "foot";
  }

  if (normalized.includes("TOE")) {
    return "toe";
  }

  if (normalized.includes("LEG")) {
    return "leg";
  }

  return "other";
}

function getStressWeight(category) {
  return stressWeights[category] ?? stressWeights.other;
}

function findPrimaryLeg(entries, side) {
  return entries.find((entry) => entry.side === side && /^DEF-LEG/i.test(entry.name)) ??
    entries.find((entry) => entry.side === side && entry.category === "leg") ??
    null;
}

function getMaxAngleEntry(entries, side) {
  let bestEntry = null;
  let bestAngle = -1;

  for (const entry of entries) {
    if (entry.side !== side) {
      continue;
    }

    const angle = measureQuaternionAngle(entry.baseQuaternion, entry.node.quaternion);

    if (angle > bestAngle) {
      bestAngle = angle;
      bestEntry = entry;
    }
  }

  return {
    entry: bestEntry,
    angle: bestAngle >= 0 ? bestAngle : null,
  };
}

function amplifyBoneRotation(restQuaternion, currentQuaternion, factor) {
  tmpInverseQuaternion.copy(restQuaternion).invert();
  tmpDeltaQuaternion.copy(tmpInverseQuaternion).multiply(currentQuaternion).normalize();

  const axisLength = Math.hypot(
    tmpDeltaQuaternion.x,
    tmpDeltaQuaternion.y,
    tmpDeltaQuaternion.z,
  );

  if (axisLength < 1e-5) {
    return restQuaternion.clone();
  }

  let angle = 2 * Math.atan2(axisLength, tmpDeltaQuaternion.w);

  if (angle > Math.PI) {
    angle -= Math.PI * 2;
  }

  const amplifiedAngle = clamp(angle * factor, -1.9, 1.9);
  tmpAxis.set(
    tmpDeltaQuaternion.x,
    tmpDeltaQuaternion.y,
    tmpDeltaQuaternion.z,
  ).divideScalar(axisLength);
  tmpAmplifiedQuaternion.setFromAxisAngle(tmpAxis, amplifiedAngle);

  return restQuaternion.clone().multiply(tmpAmplifiedQuaternion);
}

function measureQuaternionAngle(restQuaternion, currentQuaternion) {
  tmpInverseQuaternion.copy(restQuaternion).invert();
  tmpDeltaQuaternion.copy(tmpInverseQuaternion).multiply(currentQuaternion).normalize();

  const halfAngle = Math.acos(clamp(tmpDeltaQuaternion.w, -1, 1));
  const angle = halfAngle * 2;
  const normalizedAngle = angle > Math.PI ? Math.PI * 2 - angle : angle;
  return THREE.MathUtils.radToDeg(Math.abs(normalizedAngle));
}

export function collectPlayerLocomotionAmplifiers(sceneRoot) {
  const entries = [];
  sceneRoot.updateMatrixWorld(true);
  tmpBounds.setFromObject(sceneRoot);
  tmpBounds.getCenter(tmpBoundsCenter);

  sceneRoot.traverse((object) => {
    if (!object?.isBone || !controlledLegPattern.test(object.name ?? "")) {
      return;
    }

    const category = classifyBoneCategory(object.name);
    const namedSide = classifySide(object.name);
    const worldPosition = object.getWorldPosition(tmpWorldPosition);
    const fallbackSide = Math.abs(worldPosition.x - tmpBoundsCenter.x) <= 0.04
      ? "center"
      : worldPosition.x < tmpBoundsCenter.x
        ? "left"
        : "right";

    entries.push({
      node: object,
      name: object.name,
      category,
      side: category === "hips" ? "center" : (namedSide !== "center" ? namedSide : fallbackSide),
      baseQuaternion: object.quaternion.clone(),
    });
  });

  entries.primaryLeftLeg = findPrimaryLeg(entries, "left");
  entries.primaryRightLeg = findPrimaryLeg(entries, "right");
  return entries;
}

export function applyPlayerLocomotionAmplification(entries, { locomotionMode, moveRatio }) {
  if (!Array.isArray(entries) || entries.length === 0 || locomotionMode === "idle") {
    return;
  }

  const clampedMoveRatio = clamp(moveRatio, 0, 1);
  const swingMultiplier = locomotionMode === "run"
    ? 2.28 + clampedMoveRatio * 0.18
    : 1.92 + clampedMoveRatio * 0.16;

  for (const entry of entries) {
    const factor = 1 + (swingMultiplier - 1) * getStressWeight(entry.category);
    entry.node.quaternion.copy(
      amplifyBoneRotation(entry.baseQuaternion, entry.node.quaternion, factor),
    );
  }
}

export function getPlayerLocomotionAngleSnapshot(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      left: null,
      right: null,
    };
  }

  const leftEntry = entries.primaryLeftLeg ?? findPrimaryLeg(entries, "left");
  const rightEntry = entries.primaryRightLeg ?? findPrimaryLeg(entries, "right");
  const leftMax = getMaxAngleEntry(entries, "left");
  const rightMax = getMaxAngleEntry(entries, "right");
  const leftPrimaryAngle = leftEntry
    ? measureQuaternionAngle(leftEntry.baseQuaternion, leftEntry.node.quaternion)
    : null;
  const rightPrimaryAngle = rightEntry
    ? measureQuaternionAngle(rightEntry.baseQuaternion, rightEntry.node.quaternion)
    : null;

  return {
    left: leftPrimaryAngle != null && leftPrimaryAngle > 0.1
      ? leftPrimaryAngle
      : leftMax.angle,
    right: rightPrimaryAngle != null && rightPrimaryAngle > 0.1
      ? rightPrimaryAngle
      : rightMax.angle,
    leftBoneName: leftEntry?.name ?? null,
    rightBoneName: rightEntry?.name ?? null,
    leftMax: leftMax.angle,
    rightMax: rightMax.angle,
    leftMaxBoneName: leftMax.entry?.name ?? null,
    rightMaxBoneName: rightMax.entry?.name ?? null,
  };
}
