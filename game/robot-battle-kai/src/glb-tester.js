import * as THREE from "three";
import { GLTFLoader } from "../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { assetManifest } from "./game/assets/AssetManifest.js";
import { gameConfig } from "./game/config.js";
import {
  applyPlayerLocomotionAmplification,
  collectPlayerLocomotionAmplifiers,
  getPlayerLocomotionAngleSnapshot,
} from "./game/animation/PlayerLocomotionAmplifier.js";

const canvas = document.querySelector("#glb-tester-canvas");
const clipField = document.querySelector("[data-field='clip']");
const modeField = document.querySelector("[data-field='mode']");
const leftAngleField = document.querySelector("[data-field='left-angle']");
const rightAngleField = document.querySelector("[data-field='right-angle']");
const amplifierCountField = document.querySelector("[data-field='amplifier-count']");
const skeletonStateField = document.querySelector("[data-field='skeleton-state']");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const skeletonButton = document.querySelector("[data-action='skeleton']");

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("GLB tester canvas was not found.");
}

const params = new URLSearchParams(window.location.search);
let locomotionMode = params.get("mode") === "run" ? "run" : "walk";
let skeletonVisible = params.get("skeleton") === "1";
const captureTag = params.get("captureTag")?.trim() || null;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#f2ede7");

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(8.1, 4.35, 0.25);

const hemi = new THREE.HemisphereLight("#fff6e7", "#3f2818", 1.55);
scene.add(hemi);

const key = new THREE.DirectionalLight("#ffd3a0", 1.75);
key.position.set(10, 16, 8);
scene.add(key);

const fill = new THREE.DirectionalLight("#d5f0ff", 0.55);
fill.position.set(-8, 10, -6);
scene.add(fill);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(22, 72),
  new THREE.MeshStandardMaterial({
    color: "#7a573b",
    roughness: 0.98,
    metalness: 0.02,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const mechRoot = new THREE.Group();
scene.add(mechRoot);

const loader = new GLTFLoader();

let mixer = null;
let action = null;
let activeClipName = "loading";
let locomotionAmplifiers = [];
let skeletonHelper = null;
let scannedLegNodeNames = [];
const modelBounds = new THREE.Box3();
const modelSize = new THREE.Vector3();
const modelCenter = new THREE.Vector3();
const lookTarget = new THREE.Vector3(0, 2.45, 0);
const clock = new THREE.Clock();

window.__glbTesterRuntime = {
  getState() {
    return {
      activeClipName,
      locomotionMode,
      amplifierCount: locomotionAmplifiers.length,
      scannedLegNodeNames: [...scannedLegNodeNames],
      currentActionTime: action?.time ?? 0,
      angleSnapshot: getPlayerLocomotionAngleSnapshot(locomotionAmplifiers),
      bones: locomotionAmplifiers.map((entry) => ({
        name: entry.name,
        side: entry.side,
        category: entry.category,
        quaternion: {
          x: entry.node.quaternion.x,
          y: entry.node.quaternion.y,
          z: entry.node.quaternion.z,
          w: entry.node.quaternion.w,
        },
        baseQuaternion: {
          x: entry.baseQuaternion.x,
          y: entry.baseQuaternion.y,
          z: entry.baseQuaternion.z,
          w: entry.baseQuaternion.w,
        },
      })),
    };
  },
};

function fitModel(sceneRoot) {
  modelBounds.setFromObject(sceneRoot);
  modelBounds.getSize(modelSize);
  const scale = gameConfig.player.modelAsset.targetHeight / Math.max(modelSize.y, 0.001);
  sceneRoot.scale.multiplyScalar(scale);
  modelBounds.setFromObject(sceneRoot);
  modelBounds.getCenter(modelCenter);
  sceneRoot.position.x -= modelCenter.x;
  sceneRoot.position.z -= modelCenter.z;
  sceneRoot.position.y -= modelBounds.min.y;

  modelBounds.setFromObject(sceneRoot);
  modelBounds.getSize(modelSize);
  modelBounds.getCenter(modelCenter);
}

function frameSideProfile() {
  const focusY = modelBounds.min.y + modelSize.y * 0.42;
  const distance = Math.max(modelSize.y * 2.05, modelSize.x * 1.48, 10.5);
  const height = focusY + Math.max(modelSize.y * 0.14, 0.7);
  const depth = Math.max(modelSize.z * 0.06, 0.2);

  lookTarget.set(modelCenter.x, focusY, modelCenter.z);
  camera.position.set(modelCenter.x + distance, height, modelCenter.z + depth);
  camera.lookAt(lookTarget);
}

function updateButtons() {
  for (const button of modeButtons) {
    button.dataset.active = button.dataset.mode === locomotionMode ? "true" : "false";
  }

  if (skeletonButton) {
    skeletonButton.dataset.active = skeletonVisible ? "true" : "false";
  }
}

function updateReadout() {
  const angleSnapshot = getPlayerLocomotionAngleSnapshot(locomotionAmplifiers);
  const leftLabel = angleSnapshot.leftBoneName ?? "n/a";
  const rightLabel = angleSnapshot.rightBoneName ?? "n/a";
  const leftMaxLabel = angleSnapshot.leftMaxBoneName ?? "n/a";
  const rightMaxLabel = angleSnapshot.rightMaxBoneName ?? "n/a";
  const previewNames = locomotionAmplifiers
    .slice(0, 4)
    .map((entry) => `${entry.side}:${entry.name}`)
    .join(", ");
  clipField.textContent = locomotionAmplifiers.length === 0 && scannedLegNodeNames.length > 0
    ? `${activeClipName} | scan=${scannedLegNodeNames.slice(0, 3).join(", ")}`
    : `${activeClipName} | L=${leftLabel} | R=${rightLabel} | ${previewNames}`;
  modeField.textContent = locomotionMode;
  leftAngleField.textContent = `${(angleSnapshot.left ?? 0).toFixed(1)} deg`;
  rightAngleField.textContent = `${(angleSnapshot.right ?? 0).toFixed(1)} deg`;
  amplifierCountField.textContent =
    `${locomotionAmplifiers.length} / scan ${scannedLegNodeNames.length} | ` +
    `max ${leftMaxLabel}:${(angleSnapshot.leftMax ?? 0).toFixed(1)} / ${rightMaxLabel}:${(angleSnapshot.rightMax ?? 0).toFixed(1)}`;
  skeletonStateField.textContent = skeletonVisible ? "on" : "off";
  const titleParts = ["GLB Tester"];

  if (captureTag) {
    titleParts.push(`ready-capture=${captureTag}`);
  }

  titleParts.push(activeClipName);
  titleParts.push(locomotionMode);
  titleParts.push(`n=${locomotionAmplifiers.length}/${scannedLegNodeNames.length}`);
  if (locomotionAmplifiers.length === 0 && scannedLegNodeNames.length > 0) {
    titleParts.push(`scan0=${scannedLegNodeNames[0]}`);
  }
  titleParts.push(`t=${action ? action.time.toFixed(2) : "0.00"}`);
  titleParts.push(`L=${leftLabel}:${(angleSnapshot.left ?? 0).toFixed(1)}`);
  titleParts.push(`R=${rightLabel}:${(angleSnapshot.right ?? 0).toFixed(1)}`);
  titleParts.push(`LM=${leftMaxLabel}:${(angleSnapshot.leftMax ?? 0).toFixed(1)}`);
  titleParts.push(`RM=${rightMaxLabel}:${(angleSnapshot.rightMax ?? 0).toFixed(1)}`);
  document.title = titleParts.join(" | ");
}

function applyLocomotionMode() {
  if (!action) {
    return;
  }

  action.timeScale = locomotionMode === "run" ? 1.18 : 1.05;
  updateButtons();
  updateReadout();
}

function tickLocomotion(stepSeconds) {
  if (!mixer || !action) {
    return;
  }

  mixer.update(stepSeconds);
  applyPlayerLocomotionAmplification(locomotionAmplifiers, {
    locomotionMode,
    moveRatio: locomotionMode === "run" ? 1 : 0.58,
  });
  updateReadout();
}

function toggleSkeleton() {
  skeletonVisible = !skeletonVisible;

  if (skeletonHelper) {
    skeletonHelper.visible = skeletonVisible;
  }

  updateButtons();
  updateReadout();
}

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    locomotionMode = button.dataset.mode === "run" ? "run" : "walk";
    applyLocomotionMode();
  });
}

skeletonButton?.addEventListener("click", () => {
  toggleSkeleton();
});

window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "s") {
    toggleSkeleton();
    return;
  }

  if (event.key === "1") {
    locomotionMode = "walk";
    applyLocomotionMode();
    return;
  }

  if (event.key === "2") {
    locomotionMode = "run";
    applyLocomotionMode();
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

async function initialize() {
  const gltf = await loader.loadAsync(assetManifest.models.playerKwIi.scene);
  const sceneRoot = gltf.scene;

  if (!sceneRoot) {
    throw new Error("Player GLB did not contain a scene.");
  }

  sceneRoot.rotation.y = gameConfig.player.modelAsset.rotationY;
  fitModel(sceneRoot);
  mechRoot.add(sceneRoot);
  frameSideProfile();

  const walkingClip = gltf.animations.find((clip) => clip.name === "Walking animation")
    ?? gltf.animations.find((clip) => /walk/i.test(clip.name))
    ?? gltf.animations[0];

  if (!walkingClip) {
    throw new Error("Walking animation was not found in the GLB.");
  }

  activeClipName = walkingClip.name;
  mixer = new THREE.AnimationMixer(sceneRoot);
  action = mixer.clipAction(walkingClip);
  action.enabled = true;
  action.clampWhenFinished = false;
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();

  locomotionAmplifiers = collectPlayerLocomotionAmplifiers(sceneRoot);
  scannedLegNodeNames = [];
  sceneRoot.traverse((object) => {
    if (/LEG|KNEE|SHIN|FOOT|TOE|HIPS/i.test(object.name || "")) {
      scannedLegNodeNames.push(object.name);
    }
  });
  skeletonHelper = new THREE.SkeletonHelper(sceneRoot);
  skeletonHelper.visible = skeletonVisible;
  skeletonHelper.material.depthTest = false;
  skeletonHelper.material.transparent = true;
  skeletonHelper.material.opacity = 0.95;
  scene.add(skeletonHelper);

  applyLocomotionMode();
}

function animate() {
  requestAnimationFrame(animate);
  tickLocomotion(Math.min(clock.getDelta(), 1 / 20));
  camera.lookAt(lookTarget);
  renderer.render(scene, camera);
}

initialize()
  .catch((error) => {
    console.error(error);
    clipField.textContent = `error: ${error instanceof Error ? error.message : String(error)}`;
    document.title = "GLB Tester | error";
  })
  .finally(() => {
    animate();
  });
