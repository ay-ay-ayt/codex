import * as THREE from "./vendor/three.module.min.js";

const canvas = document.getElementById("game");
const startMenuOverlayEl = document.getElementById("startMenuOverlay");
const startModeEl = document.getElementById("startMode");
const startSoloWrapEl = document.getElementById("startSoloWrap");
const startSoloBotCountEl = document.getElementById("startSoloBotCount");
const startTeamWrapEl = document.getElementById("startTeamWrap");
const startTeamAllyCountEl = document.getElementById("startTeamAllyCount");
const startTeamEnemyCountEl = document.getElementById("startTeamEnemyCount");
const startMapTypeEl = document.getElementById("startMapType");
const startAutoLevelEl = document.getElementById("startAutoLevel");
const startMatchBtn = document.getElementById("startMatchBtn");
const startMenuNoteEl = document.getElementById("startMenuNote");
const healthEl = document.getElementById("health");
const ammoEl = document.getElementById("ammo");
const boostStatEl = document.getElementById("boostStat");
const botCountEl = document.getElementById("botCount");
const mapTypeEl = document.getElementById("mapType");
const autoLevelEl = document.getElementById("autoLevel");
const restartBtn = document.getElementById("restartBtn");
const startMenuBtn = document.getElementById("startMenuBtn");
const menuBtn = document.getElementById("menuBtn");
const zoomSliderEl = document.getElementById("zoomSlider");
const botCountButtons = botCountEl ? Array.from(botCountEl.querySelectorAll(".tap-btn[data-bot-count]")) : [];
const mapTypeButtons = Array.from(mapTypeEl.querySelectorAll(".tap-btn[data-map-type]"));
const startModeButtons = startModeEl ? Array.from(startModeEl.querySelectorAll(".tap-btn[data-match-mode]")) : [];
const startSoloBotButtons = startSoloBotCountEl ? Array.from(startSoloBotCountEl.querySelectorAll(".tap-btn[data-solo-bot-count]")) : [];
const startTeamAllyButtons = startTeamAllyCountEl ? Array.from(startTeamAllyCountEl.querySelectorAll(".tap-btn[data-team-allies]")) : [];
const startTeamEnemyButtons = startTeamEnemyCountEl ? Array.from(startTeamEnemyCountEl.querySelectorAll(".tap-btn[data-team-enemies]")) : [];
const startMapButtons = startMapTypeEl ? Array.from(startMapTypeEl.querySelectorAll(".tap-btn[data-start-map-type]")) : [];
const startAutoLevelButtons = startAutoLevelEl ? Array.from(startAutoLevelEl.querySelectorAll(".tap-btn[data-auto-level]")) : [];
const autoLevelButtons = autoLevelEl ? Array.from(autoLevelEl.querySelectorAll(".tap-btn[data-auto-level]")) : [];

const MATCH_MODE_FFA = "ffa";
const MATCH_MODE_TEAM = "team";
const MAX_MATCH_BOTS = 5;

let selectedMatchMode = startModeButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.matchMode || MATCH_MODE_FFA;
let selectedBotCount = Number(startSoloBotButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.soloBotCount || 2);
let selectedTeamAllyCount = Number(startTeamAllyButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.teamAllies || 1);
let selectedTeamEnemyCount = Number(startTeamEnemyButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.teamEnemies || 3);
let selectedMapType = startMapButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.startMapType
  || mapTypeButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.mapType
  || "city";
let selectedAutoLevelEnabled = parseAutoLevelValue(
  startAutoLevelButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.autoLevel
  || autoLevelButtons.find((btn) => btn.classList.contains("is-active"))?.dataset.autoLevel
  || "on"
);
const menuPanel = document.getElementById("menuPanel");
menuPanel.hidden = true;
menuBtn.setAttribute("aria-expanded", "false");
const messageEl = document.getElementById("message");
const rotateHint = document.getElementById("rotateHint");
const fireBtn = document.getElementById("fireBtn");
const missileBtn = document.getElementById("missileBtn");
const boostLeverEl = document.getElementById("boostLever");
const crosshairEl = document.getElementById("crosshair");
const missileWarningEl = document.getElementById("missileWarning");
const lockOnCueEl = document.getElementById("lockOnCue");
const lockCancelBtn = document.getElementById("lockCancelBtn");
const buildDebugEl = document.getElementById("buildDebug");
const cockpitOverlayEl = document.getElementById("cockpitOverlay");
const cockpitFrameEl = document.getElementById("cockpitFrame");
const gunsightGlassEl = document.getElementById("gunsightGlass");

function showBootstrapError(err, scope = "bootstrap") {
  console.error(`[skyace:${scope}]`, err);
  if (!messageEl) return;
  const text = String(err?.message || err || "unknown error");
  messageEl.hidden = false;
  messageEl.textContent = `Initialization error (${scope}): ${text}`;
}

let hpPanelReady = false;
const hudCache = {
  healthSignature: null,
  ammoText: null,
  boostText: null,
  missileButtonText: null,
  lockCueText: null,
  lockCueHidden: null,
  lockCancelText: null,
  lockCancelHidden: null,
};

function invalidateHudCache() {
  hudCache.healthSignature = null;
  hudCache.ammoText = null;
  hudCache.boostText = null;
  hudCache.missileButtonText = null;
  hudCache.lockCueText = null;
  hudCache.lockCueHidden = null;
  hudCache.lockCancelText = null;
  hudCache.lockCancelHidden = null;
}

function setHudTextIfChanged(el, cacheKey, nextText) {
  if (!el || hudCache[cacheKey] === nextText) return;
  hudCache[cacheKey] = nextText;
  el.textContent = nextText;
}

function setHudHiddenIfChanged(el, cacheKey, hidden) {
  if (!el || hudCache[cacheKey] === hidden) return;
  hudCache[cacheKey] = hidden;
  el.hidden = hidden;
}

// DEBUG_BUILD_NUMBER block: remove this block to hide the temporary build marker.
const DEBUG_BUILD_NUMBER = 352;
if (buildDebugEl) buildDebugEl.textContent = `BUILD ${DEBUG_BUILD_NUMBER}`;

function parseAutoLevelValue(value) {
  return value !== "off";
}

function mapZoomSliderToTarget(raw) {
  const normalized = clamp(raw, 0, 1);
  const detentStart = 0.88;
  const detentSnap = 0.97;
  const preCockpitCap = 0.86;
  if (normalized <= detentStart) {
    return (normalized / detentStart) * preCockpitCap;
  }

  const push = (normalized - detentStart) / (1 - detentStart);
  if (push < ((detentSnap - detentStart) / (1 - detentStart))) {
    const hold = (push / ((detentSnap - detentStart) / (1 - detentStart)));
    return THREE.MathUtils.lerp(preCockpitCap, 0.91, hold);
  }

  const finalPush = (normalized - detentSnap) / (1 - detentSnap);
  return THREE.MathUtils.lerp(0.91, 1, clamp(finalPush, 0, 1));
}

const initialRawZoom = clamp(Number(zoomSliderEl?.value || 0) / 100, 0, 1);
const cameraZoom = {
  raw: initialRawZoom,
  target: mapZoomSliderToTarget(initialRawZoom),
  value: mapZoomSliderToTarget(initialRawZoom),
};

let cockpitMarkerRatios = null;
const DEFAULT_COCKPIT_MARKER_RATIOS = Object.freeze({
  centerX: 0.5,
  centerY: 0.384,
  width: 0.154,
  height: 0.194,
});
const COCKPIT_VIRTUAL_SHOT_FORWARD = 18.0;
const COCKPIT_VIRTUAL_SHOT_SCREEN_DROP_RATIO = 0.42;
const COCKPIT_VIRTUAL_SHOT_SCREEN_DROP_FALLBACK = 48;
const COCKPIT_CROSSHAIR_CENTER_BLEND_Y = 0.38;
const COCKPIT_CROSSHAIR_DOWN_BIAS_RATIO = 0.04;
const COCKPIT_VIRTUAL_SHOT_SIDE_OFFSET = 0.48;
const COCKPIT_VIRTUAL_SHOT_DOWN_OFFSET = 0.58;

function isValidCockpitRatios(r) {
  if (!r) return false;
  return (
    r.centerX >= 0.42 && r.centerX <= 0.58
    && r.centerY >= 0.3 && r.centerY <= 0.58
    && r.width >= 0.05 && r.width <= 0.42
    && r.height >= 0.08 && r.height <= 0.5
  );
}

function getActiveCockpitRatios() {
  return isValidCockpitRatios(cockpitMarkerRatios) ? cockpitMarkerRatios : DEFAULT_COCKPIT_MARKER_RATIOS;
}
if (zoomSliderEl) {
  zoomSliderEl.addEventListener("input", () => {
    cameraZoom.raw = clamp(Number(zoomSliderEl.value) / 100, 0, 1);
    cameraZoom.target = mapZoomSliderToTarget(cameraZoom.raw);
  });
}

if (cockpitFrameEl) {
  try {
    prepareCockpitOverlay(cockpitFrameEl, cockpitOverlayEl);
  } catch (err) {
    showBootstrapError(err, "cockpit-mask");
    cockpitOverlayEl?.removeAttribute("data-mask-ready");
  }
  cockpitFrameEl.addEventListener("load", () => {
    try {
      updateCockpitOverlayLayout();
    } catch (err) {
      showBootstrapError(err, "cockpit-layout");
    }
  });
}

function getCockpitFrameContentRect() {
  if (!cockpitFrameEl) return null;
  const frameRect = cockpitFrameEl.getBoundingClientRect();
  if (frameRect.width < 20 || frameRect.height < 20) return null;

  const naturalWidth = cockpitFrameEl.naturalWidth;
  const naturalHeight = cockpitFrameEl.naturalHeight;
  if (!naturalWidth || !naturalHeight) return frameRect;

  const imageAspect = naturalWidth / naturalHeight;
  const frameAspect = frameRect.width / frameRect.height;

  if (frameAspect > imageAspect) {
    const height = frameRect.height;
    const width = height * imageAspect;
    return {
      left: frameRect.left + (frameRect.width - width) * 0.5,
      top: frameRect.top,
      width,
      height,
    };
  }

  const width = frameRect.width;
  const height = width / imageAspect;
  return {
    left: frameRect.left,
    top: frameRect.top + (frameRect.height - height),
    width,
    height,
  };
}

function getCockpitCenterRatios() {
  const marker = getActiveCockpitRatios();
  return {
    centerX: marker.centerX,
    centerY: marker.centerY,
  };
}

function updateCockpitOverlayLayout() {
  if (!cockpitFrameEl || !gunsightGlassEl) return;
  const rect = getCockpitFrameContentRect();
  if (!rect) return;

  const marker = getActiveCockpitRatios();
  const x = rect.left + rect.width * marker.centerX;
  const y = rect.top + rect.height * marker.centerY;
  const w = rect.width * marker.width;
  const h = rect.height * marker.height;
  const screenRect = getScreenSpaceRect();
  const screenCenterY = screenRect.top + screenRect.height * 0.5;
  const crosshairY = THREE.MathUtils.lerp(y, screenCenterY, COCKPIT_CROSSHAIR_CENTER_BLEND_Y) + h * COCKPIT_CROSSHAIR_DOWN_BIAS_RATIO;

  document.documentElement.style.setProperty("--gunsight-x", `${x}px`);
  document.documentElement.style.setProperty("--gunsight-y", `${y}px`);
  document.documentElement.style.setProperty("--gunsight-width", `${w}px`);
  document.documentElement.style.setProperty("--gunsight-height", `${h}px`);
  document.documentElement.style.setProperty("--crosshair-x", `${x}px`);
  document.documentElement.style.setProperty("--crosshair-y", `${crosshairY}px`);
}

const isMobile = window.matchMedia?.("(pointer: coarse)")?.matches
  || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
  const preventZoomGesture = (event) => event.preventDefault();
  document.addEventListener("gesturestart", preventZoomGesture, { passive: false });
  document.addEventListener("dblclick", preventZoomGesture, { passive: false });
}

function setupHudHealthPanel() {
  healthEl.innerHTML = "";
  hpPanelReady = true;
  invalidateHudCache();
}

function hpBarClass(ratio) {
  if (ratio > 0.6) return "good";
  if (ratio > 0.3) return "warn";
  return "danger";
}

function hpRowMarkup(label, hp, locked = false, tone = "enemy") {
  const hpInt = Math.max(0, Math.round(hp));
  const ratio = clamp(hpInt / 100, 0, 1);
  const sizeClass = `hp-row is-${tone}${locked ? " is-locked" : ""}`;
  return `
    <div class="${sizeClass}">
      <span class="hp-name">${label}</span>
      <span class="hp-track"><span class="hp-fill ${hpBarClass(ratio)}" style="width:${Math.round(ratio * 100)}%"></span></span>
      <span class="hp-val">${hpInt}</span>
    </div>
  `;
}

function updateHudHealthPanel() {
  if (!hpPanelReady || !game.player) return;

  let signature = `p:${Math.max(0, Math.round(game.player.hp))}`;
  for (const bot of game.bots) {
    signature += `|${bot.callsign || "bot"}:${Math.max(0, Math.round(bot.hp))}:${bot === game.missileLockTarget ? 1 : 0}:${getPlaneHudTone(bot)}`;
  }

  if (hudCache.healthSignature === signature) return;

  let rows = hpRowMarkup(game.player.callsign || "YOU", game.player.hp, false, getPlaneHudTone(game.player));
  for (const bot of game.bots) {
    rows += hpRowMarkup(bot.callsign || "EN", bot.hp, bot === game.missileLockTarget, getPlaneHudTone(bot));
  }

  hudCache.healthSignature = signature;
  healthEl.innerHTML = rows;
}

function createRenderer() {
  const attempts = [
    { canvas, antialias: !isMobile, powerPreference: isMobile ? "low-power" : "high-performance" },
    { canvas, antialias: false, powerPreference: "low-power", precision: "lowp", alpha: false, depth: false, stencil: false },
  ];

  for (const options of attempts) {
    try {
      return new THREE.WebGLRenderer(options);
    } catch {
      // fall through to the next option
    }
  }
  return null;
}

function drawRendererFallback() {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = Math.max(1, window.innerWidth || 1);
  const h = Math.max(1, window.innerHeight || 1);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#5f8fc6");
  sky.addColorStop(0.62, "#3f6ea5");
  sky.addColorStop(1, "#1b2f46");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(16, 36, 58, 0.58)";
  ctx.fillRect(0, h * 0.64, w, h * 0.36);

  ctx.strokeStyle = "rgba(168, 229, 255, 0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.36, h * 0.52);
  ctx.lineTo(w * 0.62, h * 0.5);
  ctx.lineTo(w * 0.72, h * 0.47);
  ctx.lineTo(w * 0.79, h * 0.48);
  ctx.lineTo(w * 0.71, h * 0.52);
  ctx.lineTo(w * 0.62, h * 0.55);
  ctx.lineTo(w * 0.56, h * 0.58);
  ctx.lineTo(w * 0.48, h * 0.58);
  ctx.closePath();
  ctx.stroke();
}

const renderer = createRenderer();
const rendererReady = Boolean(renderer);

function getRenderPixelRatio() {
  const deviceRatio = window.devicePixelRatio || 1;
  const maxRatio = isMobile ? 2.5 : 2;
  return Math.min(deviceRatio, maxRatio);
}

if (rendererReady) {
  renderer.setPixelRatio(getRenderPixelRatio());
  renderer.setClearColor(0x6f9ed4, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

const scene = new THREE.Scene();

const textureLoader = new THREE.TextureLoader();
const textureAnisotropy = rendererReady ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
const textureCache = new Map();
const FIGHTER_TEXTURE_KEYS = Object.freeze([
  "bodyColor",
  "bodyNormal",
  "bodyRoughness",
  "bodyMetalness",
  "trimColor",
  "trimNormal",
  "trimRoughness",
]);
const WORLD_TEXTURE_KEYS = Object.freeze({
  city: [
    "cityGroundColor",
    "cityGroundNormal",
    "cityGroundRoughness",
    "cityRoadColor",
    "cityRoadNormal",
    "cityRoadRoughness",
    "cityBuildingColor",
    "cityBuildingNormal",
    "cityBuildingRoughness",
  ],
  forest: [
    "forestGroundColor",
    "forestGroundNormal",
    "forestGroundRoughness",
    "rockColor",
    "rockNormal",
    "rockRoughness",
    "trunkColor",
    "trunkNormal",
    "trunkRoughness",
  ],
});
const TEXTURE_SLOTS = Object.freeze({
  bodyColor: { basePath: "./assets/polyhaven/textures/metal_plate/metal_plate_diff", repeat: [3.2, 1.1], colorSpace: THREE.SRGBColorSpace, allow1k: false },
  bodyNormal: { basePath: "./assets/polyhaven/textures/metal_plate/metal_plate_nor_gl", repeat: [3.2, 1.1], allow1k: false },
  bodyRoughness: { basePath: "./assets/polyhaven/textures/metal_plate/metal_plate_rough", repeat: [3.2, 1.1], allow1k: false },
  bodyMetalness: { basePath: "./assets/polyhaven/textures/metal_plate/metal_plate_metal", repeat: [3.2, 1.1], allow1k: false },
  trimColor: { basePath: "./assets/polyhaven/textures/corrugated_iron/corrugated_iron_diff", repeat: [1.8, 1], colorSpace: THREE.SRGBColorSpace, allow1k: false },
  trimNormal: { basePath: "./assets/polyhaven/textures/corrugated_iron/corrugated_iron_nor_gl", repeat: [1.8, 1], allow1k: false },
  trimRoughness: { basePath: "./assets/polyhaven/textures/corrugated_iron/corrugated_iron_rough", repeat: [1.8, 1], allow1k: false },
  cityGroundColor: { basePath: "./assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_diff", repeat: [26, 26], colorSpace: THREE.SRGBColorSpace, allow1k: false },
  cityGroundNormal: { basePath: "./assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_nor_gl", repeat: [26, 26], allow1k: true },
  cityGroundRoughness: { basePath: "./assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_rough", repeat: [26, 26], allow1k: true },
  cityRoadColor: { basePath: "./assets/polyhaven/textures/brushed_concrete/brushed_concrete_diff", repeat: [20, 8], colorSpace: THREE.SRGBColorSpace, allow1k: false },
  cityRoadNormal: { basePath: "./assets/polyhaven/textures/brushed_concrete/brushed_concrete_nor_gl", repeat: [20, 8], allow1k: true },
  cityRoadRoughness: { basePath: "./assets/polyhaven/textures/brushed_concrete/brushed_concrete_rough", repeat: [20, 8], allow1k: true },
  cityBuildingColor: { basePath: "./assets/polyhaven/textures/brushed_concrete/brushed_concrete_diff", repeat: [2.4, 3.4], colorSpace: THREE.SRGBColorSpace, allow1k: false },
  cityBuildingNormal: { basePath: "./assets/polyhaven/textures/brushed_concrete/brushed_concrete_nor_gl", repeat: [2.4, 3.4], allow1k: true },
  cityBuildingRoughness: { basePath: "./assets/polyhaven/textures/brushed_concrete/brushed_concrete_rough", repeat: [2.4, 3.4], allow1k: true },
  forestGroundColor: { basePath: "./assets/polyhaven/textures/brushed_concrete/brushed_concrete_diff", repeat: [18, 18], colorSpace: THREE.SRGBColorSpace, allow1k: false },
  forestGroundNormal: { basePath: "./assets/polyhaven/textures/brushed_concrete/brushed_concrete_nor_gl", repeat: [18, 18], allow1k: true },
  forestGroundRoughness: { basePath: "./assets/polyhaven/textures/brushed_concrete/brushed_concrete_rough", repeat: [18, 18], allow1k: true },
  rockColor: { basePath: "./assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_diff", repeat: [1.4, 1.4], colorSpace: THREE.SRGBColorSpace, allow1k: false },
  rockNormal: { basePath: "./assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_nor_gl", repeat: [1.4, 1.4], allow1k: true },
  rockRoughness: { basePath: "./assets/polyhaven/textures/concrete_floor_worn_001/concrete_floor_worn_001_rough", repeat: [1.4, 1.4], allow1k: true },
  trunkColor: { basePath: "./assets/polyhaven/textures/corrugated_iron/corrugated_iron_diff", repeat: [1.1, 3.2], colorSpace: THREE.SRGBColorSpace, allow1k: false },
  trunkNormal: { basePath: "./assets/polyhaven/textures/corrugated_iron/corrugated_iron_nor_gl", repeat: [1.1, 3.2], allow1k: true },
  trunkRoughness: { basePath: "./assets/polyhaven/textures/corrugated_iron/corrugated_iron_rough", repeat: [1.1, 3.2], allow1k: true },
});

function loadManagedTexture(def) {
  const variant = def.allow1k ? "1k" : "2k";
  const tex = textureLoader.load(`${def.basePath}_${variant}.jpg`);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(def.repeat[0], def.repeat[1]);
  tex.colorSpace = def.colorSpace ?? THREE.NoColorSpace;
  tex.anisotropy = textureAnisotropy;
  return tex;
}

function getTextureSlot(slotName) {
  const def = TEXTURE_SLOTS[slotName];
  if (!def) return null;
  if (!textureCache.has(slotName)) {
    textureCache.set(slotName, loadManagedTexture(def));
  }
  return textureCache.get(slotName);
}

function getFighterTextureSet() {
  const set = {};
  FIGHTER_TEXTURE_KEYS.forEach((slotName) => {
    set[slotName] = getTextureSlot(slotName);
  });
  return set;
}

function getWorldTextureSet(mapType) {
  const set = {};
  for (const slotName of WORLD_TEXTURE_KEYS[mapType] || []) {
    set[slotName] = getTextureSlot(slotName);
  }
  return set;
}
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 8000);
const CAMERA_DEFAULT_FOV = 72;
const CAMERA_COCKPIT_FOV = 58;
const CAMERA_DEFAULT_NEAR = 0.1;
const CAMERA_COCKPIT_NEAR = 0.03;
const CAMERA_THIRD_PERSON_OFFSET = new THREE.Vector3(-72, 25, 0);
const CAMERA_COCKPIT_OFFSET = new THREE.Vector3(2.8, 2.45, 0);
const MENU_CAMERA_POSITION = new THREE.Vector3(-360, 290, 240);
const MENU_CAMERA_LOOK_AT = new THREE.Vector3(0, 280, 0);

const GUN_ZERO_DISTANCE_FALLBACK = 1200;
const GUN_ZERO_DISTANCE_MIN = 320;
const GUN_ZERO_DISTANCE_MAX = 2600;
const GUN_BARREL_LENGTH = 3.0;
const GUN_BARREL_RADIUS = 0.082;
const GUN_MUZZLE_LOCAL_LEFT = new THREE.Vector3(13.88, 1.22, 0.86);
const GUN_MUZZLE_LOCAL_RIGHT = new THREE.Vector3(13.88, 1.22, -0.86);

const TRACER_SPEED = 1950;
const TRACER_LENGTH = 18.4;
const TRACER_RADIUS_FRONT = 0.32;
const TRACER_RADIUS_REAR = 0.58;
const MUZZLE_FLASH_LIFE = 0.095;
const MUZZLE_FLASH_SCALE_RATE = 9;
const MUZZLE_FLASH_FORWARD_OFFSET = 1.06;
const MUZZLE_FLASH_BASE_OPACITY = 1.0;

const camForwardVec = new THREE.Vector3();
const camUpVec = new THREE.Vector3();
const camRightVec = new THREE.Vector3();
const camOffsetVec = new THREE.Vector3();
const camPosTarget = new THREE.Vector3();
const camLookTarget = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const camBlendedUp = new THREE.Vector3();
scene.add(new THREE.HemisphereLight(0xdaf2ff, 0x5e8060, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 1.15);
sun.position.set(700, 900, 300);
sun.castShadow = !isMobile;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const world = new THREE.Group();
scene.add(world);

const backdropFollowers = [];

function trackBackdropMesh(mesh) {
  if (!mesh) return mesh;
  backdropFollowers.push({ mesh, offset: mesh.position.clone() });
  return mesh;
}

function updateBackdropFollowers(anchor) {
  if (!anchor || backdropFollowers.length === 0) return;
  for (const entry of backdropFollowers) {
    entry.mesh.position.copy(anchor).add(entry.offset);
  }
}

const staticObstacles = [];
const staticObstacleMeshes = [];
const tmpBox = new THREE.Box3();
const tmpVecA = new THREE.Vector3();
const tmpVecB = new THREE.Vector3();
const tmpVecC = new THREE.Vector3();
const tmpVecD = new THREE.Vector3();
const tmpVecE = new THREE.Vector3();
const playerAimProbe = new THREE.Vector3();
const playerAimDir = new THREE.Vector3();
const bulletAimDir = new THREE.Vector3();
const bulletMuzzlePos = new THREE.Vector3();
const bulletConvergencePos = new THREE.Vector3();
const bulletFlightDir = new THREE.Vector3();
const bulletMuzzleForwardDir = new THREE.Vector3();
const playerReticleScreen = new THREE.Vector2();
const playerReticleRayOrigin = new THREE.Vector3();
const playerCockpitShotProbe = new THREE.Vector3();
const playerCockpitShotDir = new THREE.Vector3();
const playerShotOrigin = new THREE.Vector3();
const playerForwardVec = new THREE.Vector3();
const playerLockAimForwardVec = new THREE.Vector3();
const obstacleThreatProbe = new THREE.Vector3();
const lockAimForwardVec = new THREE.Vector3();
const lockToTargetVec = new THREE.Vector3();
const missileLaunchPos = new THREE.Vector3();
const missileLaunchForward = new THREE.Vector3();
const botToTargetVec = new THREE.Vector3();
const botForwardVec = new THREE.Vector3();
const botLeadVec = new THREE.Vector3();
const botDesiredVec = new THREE.Vector3();
const botAvoidVec = new THREE.Vector3();
const botWallAvoidVec = new THREE.Vector3();
const botCombinedAvoidVec = new THREE.Vector3();
const botTrafficAvoidVec = new THREE.Vector3();
const botSteerVec = new THREE.Vector3();
const botYawCrossVec = new THREE.Vector3();
const botNewForwardVec = new THREE.Vector3();
const botTargetForwardVec = new THREE.Vector3();
const botTargetRightVec = new THREE.Vector3();
const botTargetUpVec = new THREE.Vector3();
const botAimPointVec = new THREE.Vector3();
const botAimDirVec = new THREE.Vector3();
const botRecoveryVec = new THREE.Vector3();
const botProbeSideVec = new THREE.Vector3();
const botProbeUpVec = new THREE.Vector3();
const botProbePointVec = new THREE.Vector3();
const botProgressVec = new THREE.Vector3();
const botCenterBiasVec = new THREE.Vector3();
const botArenaLeashVec = new THREE.Vector3();
const botWallTurnPlan = { wallUnsafe: false, clearance: Infinity, timeToWall: Infinity, timeNeeded: 0, planarSpeed: 0, wallNormal: new THREE.Vector3(), avoidDir: new THREE.Vector3(), faceId: null };
const botTargetWallPlan = { wallUnsafe: false, clearance: Infinity, timeToWall: Infinity, timeNeeded: 0, planarSpeed: 0, wallNormal: new THREE.Vector3(), avoidDir: new THREE.Vector3(), faceId: null };
const botControlState = { roll: 0, pitch: 0, rollIntent: 0, pitchIntent: 0, throttle: 0, boostLevel: 0, autoLevel: false };
const playerControlState = { roll: 0, pitch: 0, rollIntent: 0, pitchIntent: 0, throttle: 0, boostLevel: 0, autoLevel: true };
const missileTargetCenterVec = new THREE.Vector3();
const missileToTargetVec = new THREE.Vector3();
const missileAimPointVec = new THREE.Vector3();
const missileDesiredDirVec = new THREE.Vector3();
const missileCurrentDirVec = new THREE.Vector3();
const missileToPlayerVec = new THREE.Vector3();
const OBSTACLE_THREAT_DISTANCES = Object.freeze([70, 120, 180]);
const OBSTACLE_THREAT_MAX_DISTANCE = 180;
const WALL_THREAT_DISTANCES = Object.freeze([180, 360, 560]);
const WALL_THREAT_MARGIN = 620;
const WALL_AVOID_MARGIN = 700;
const WALL_CONTACT_COOLDOWN = 0.22;

const bulletTracerGeometry = new THREE.CylinderGeometry(TRACER_RADIUS_FRONT, TRACER_RADIUS_REAR, TRACER_LENGTH, 12, 1, false);
bulletTracerGeometry.rotateZ(-Math.PI * 0.5);
bulletTracerGeometry.translate(TRACER_LENGTH * 0.5, 0, 0);
const bulletTracerMaterialPlayer = new THREE.MeshBasicMaterial({
  color: 0xf3fdff,
  transparent: true,
  opacity: 1,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: false,
  toneMapped: false,
  fog: false,
});
const bulletTracerMaterialBot = new THREE.MeshBasicMaterial({
  color: 0xffddb3,
  transparent: true,
  opacity: 1,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  depthTest: false,
  toneMapped: false,
  fog: false,
});
const muzzleFlashCoreGeometry = new THREE.ConeGeometry(0.34, 1.45, 10, 1, true);
muzzleFlashCoreGeometry.rotateZ(-Math.PI * 0.5);
muzzleFlashCoreGeometry.translate(0.72, 0, 0);
const muzzleFlashRingGeometry = new THREE.RingGeometry(0.1, 0.58, 16);
const muzzleFlashStreakGeometry = new THREE.PlaneGeometry(1.45, 0.16);

const muzzleFlashMaterials = {
  player: {
    core: new THREE.MeshBasicMaterial({
      color: 0xfff0e3,
      transparent: true,
      opacity: MUZZLE_FLASH_BASE_OPACITY * 1.34,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    }),
    ring: new THREE.MeshBasicMaterial({
      color: 0xff9e78,
      transparent: true,
      opacity: MUZZLE_FLASH_BASE_OPACITY * 1.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    }),
    streak: new THREE.MeshBasicMaterial({
      color: 0xfff2ea,
      transparent: true,
      opacity: MUZZLE_FLASH_BASE_OPACITY * 0.98,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    }),
  },
  bot: {
    core: new THREE.MeshBasicMaterial({
      color: 0xffead1,
      transparent: true,
      opacity: MUZZLE_FLASH_BASE_OPACITY * 1.2,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    }),
    ring: new THREE.MeshBasicMaterial({
      color: 0xff916c,
      transparent: true,
      opacity: MUZZLE_FLASH_BASE_OPACITY * 0.94,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    }),
    streak: new THREE.MeshBasicMaterial({
      color: 0xffeee3,
      transparent: true,
      opacity: MUZZLE_FLASH_BASE_OPACITY * 0.86,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      fog: false,
    }),
  },
};

const impactFxGeometry = new THREE.SphereGeometry(2.2, 10, 8);
const missileExplosionFlashGeometry = new THREE.SphereGeometry(5, 14, 12);
const missileExplosionSmokeGeometry = new THREE.SphereGeometry(4.2, 10, 8);
const missileTrailJetGeometry = new THREE.SphereGeometry(0.62, 10, 8);
const missileTrailSmokeGeometry = new THREE.SphereGeometry(0.9, 10, 8);
const effectPools = {
  muzzle: { player: [], bot: [] },
  impact: [],
  explosionFlash: [],
  explosionSmoke: [],
  missileJet: [],
  missileSmoke: [],
};

function acquirePooledEffect(pool, factory) {
  const fx = pool.pop() || factory();
  fx.mesh.visible = true;
  fx.mesh.scale.setScalar(fx.spawnScale ?? 1);
  world.add(fx.mesh);
  return fx;
}

function releaseEffect(fx) {
  if (!fx) return;
  world.remove(fx.mesh);
  fx.mesh.visible = false;
  fx.mesh.scale.setScalar(1);
  fx.followOwner = null;
  fx.hasFollowLocal = false;
  fx.pool.push(fx);
}

function clearActiveEffects() {
  for (let i = game.effects.length - 1; i >= 0; i--) {
    releaseEffect(game.effects[i]);
  }
  game.effects = [];
}

const losRaycaster = new THREE.Raycaster();
const bulletRaycaster = new THREE.Raycaster();
const bulletStepRaycaster = new THREE.Raycaster();

const ARENA = 3600;
const FLOOR_Y = 40;
const WORLD_FLIGHT_CEILING_Y = 1560;
const WORLD_COMBAT_GUIDE_CEILING_Y = WORLD_FLIGHT_CEILING_Y - 120;
const WORLD_PROJECTILE_CEILING_Y = 2200;
const worldDetail = isMobile
  ? {
    clouds: 110,
    cloudBands: 16,
    hills: 52,
    forestCenters: 7,
    forestDenseTrees: 61,
    forestSparseTrees: 336,
    forestGrassClusters: 140,
    forestRocks: 170,
    forestShrubs: 240,
    cityBuildings: 380,
    cityWindowBands: 1,
    cityFacadeChance: 0.34,
    cityFacadeMinHeight: 250,
  }
  : {
    clouds: 220,
    cloudBands: 34,
    hills: 120,
    forestCenters: 12,
    forestDenseTrees: 112,
    forestSparseTrees: 840,
    forestGrassClusters: 360,
    forestRocks: 420,
    forestShrubs: 520,
    cityBuildings: 520,
    cityWindowBands: 2,
    cityFacadeChance: 0.58,
    cityFacadeMinHeight: 190,
  };
const MAX_BANK = THREE.MathUtils.degToRad(55);
const MAX_PITCH = THREE.MathUtils.degToRad(35);
const BANK_RATE = 3.0;
const PITCH_RATE = 2.5;
const LEVEL_RATE = 1.2;
const TURN_RATE = 1.0;
const MANUAL_FLIGHT_ASSIST_OFF_CRUISE_SPEED = 370;
const MANUAL_FLIGHT_ASSIST_OFF_MIN_SPEED = 185;
const MANUAL_FLIGHT_ASSIST_OFF_FULL_SPEED = 430;
const MANUAL_FLIGHT_ASSIST_OFF_MIN_AUTHORITY = 0.42;
const MANUAL_FLIGHT_ASSIST_OFF_LOW_SPEED_DRAG = 15;
const MANUAL_FLIGHT_ASSIST_OFF_GRAVITY = 106;
const MANUAL_FLIGHT_ASSIST_OFF_BASE_THRUST = 92;
const MANUAL_FLIGHT_ASSIST_OFF_MAX_THRUST = 170;
const MANUAL_FLIGHT_ASSIST_OFF_BOOST_THRUST = 255;
const MANUAL_FLIGHT_ASSIST_OFF_BASE_LIFT = 88;
const MANUAL_FLIGHT_ASSIST_OFF_PULL_LIFT = 60;
const MANUAL_FLIGHT_ASSIST_OFF_BANK_LIFT_MIN = 0.46;
const MANUAL_FLIGHT_ASSIST_OFF_LIFT_SPEED_EXP = 1.22;
const MANUAL_FLIGHT_ASSIST_OFF_PARASITE_DRAG = 0.00058;
const MANUAL_FLIGHT_ASSIST_OFF_INDUCED_DRAG = 0.082;
const MANUAL_FLIGHT_ASSIST_OFF_BANK_INDUCED_DRAG = 0.052;
const MANUAL_FLIGHT_ASSIST_OFF_PULL_INDUCED_DRAG = 0.15;
const MANUAL_FLIGHT_ASSIST_OFF_ALIGN_YAW_RATE = 1.1;
const MANUAL_FLIGHT_ASSIST_OFF_ALIGN_PITCH_RATE = 0.8;
const MANUAL_FLIGHT_ASSIST_OFF_MAX_ROLL_RATE = THREE.MathUtils.degToRad(118);
const MANUAL_FLIGHT_ASSIST_OFF_MAX_PITCH_RATE = THREE.MathUtils.degToRad(68);
const MANUAL_FLIGHT_ASSIST_OFF_ROLL_RATE_RESPONSE = 3.2;
const MANUAL_FLIGHT_ASSIST_OFF_PITCH_RATE_RESPONSE = 2.8;
const MANUAL_FLIGHT_ASSIST_OFF_RATE_DAMPING = 2.3;
const BOOST_SPEED_BONUS_MAX = 260;
const BOOST_FUEL_BURN_BASE_PER_SEC = 22;
const BOOST_FUEL_BURN_CURVE = 0.48; // Higher boost levels become less fuel-efficient toward 100%.
const BOOST_FUEL_MAX = 130;
const keys = new Set();

const qYaw = new THREE.Quaternion();
const qPitch = new THREE.Quaternion();
const qRoll = new THREE.Quaternion();
const qMove = new THREE.Quaternion();
const qVisual = new THREE.Quaternion();
const qInverse = new THREE.Quaternion();
const qLocalPitch = new THREE.Quaternion();
const qLocalRoll = new THREE.Quaternion();
const qLocalYaw = new THREE.Quaternion();
const qLocalPitchAssist = new THREE.Quaternion();
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);
const planeUpVec = new THREE.Vector3();
const planeRefRightVec = new THREE.Vector3();
const planeRefUpVec = new THREE.Vector3();
const planeBankCrossVec = new THREE.Vector3();

const stickInput = {
  pitch: 0,
  yaw: 0,
  active: false,
};

const input = {
  roll: 0,
  pitch: 0,
  rollIntent: 0,
  pitchIntent: 0,
  yaw: 0,
  throttle: 0,
  boost: false,
  boostLevel: 0,
  fire: false,
  lockToggle: false,
  lockTogglePressed: false,
  missileLaunchPressed: false,
};

const boostLeverState = {
  level: 0,
  pointerId: null,
  applyLevel: null,
};

const game = {
  player: null,
  bots: [],
  bullets: [],
  missiles: [],
  score: 0,
  over: false,
  initialBots: 0,
  initialEnemyCount: 0,
  ammo: 100,
  boostFuel: BOOST_FUEL_MAX,
  effects: [],
  playerHitTimer: 0,
  hitConfirmTimer: 0,
  boostAutoDropAt: null,
  shiftBoostRelatchRequired: false,
  missileLockTarget: null,
  missileLockLostTimer: 0,
  missileIncomingTimer: 0,
  lockToggleButtonLatch: false,
  lockToggleTapQueuedCount: 0,
  missileLaunchTapQueuedCount: 0,
  matchElapsed: 0,
  playerBoostWasActive: false,
  phase: "menu",
  pendingMatchConfig: null,
  activeMatchConfig: null,
};

function getPendingMatchConfig() {
  return selectedMatchMode === MATCH_MODE_TEAM
    ? {
      mode: MATCH_MODE_TEAM,
      allyBotCount: selectedTeamAllyCount,
      enemyBotCount: selectedTeamEnemyCount,
      totalBotCount: selectedTeamAllyCount + selectedTeamEnemyCount,
      mapType: selectedMapType,
      autoLevelEnabled: selectedAutoLevelEnabled,
    }
    : {
      mode: MATCH_MODE_FFA,
      botCount: selectedBotCount,
      totalBotCount: selectedBotCount,
      mapType: selectedMapType,
      autoLevelEnabled: selectedAutoLevelEnabled,
    };
}

function syncPendingMatchConfig() {
  game.pendingMatchConfig = getPendingMatchConfig();
  return game.pendingMatchConfig;
}

function getAllPlanes(includePlayer = true) {
  const planes = [];
  if (includePlayer && game.player) planes.push(game.player);
  for (const bot of game.bots) planes.push(bot);
  return planes;
}

function isSameTeam(a, b) {
  if (!a || !b) return false;
  return a.teamId !== null && a.teamId !== undefined && a.teamId === b.teamId;
}

function isHostilePlane(viewer, target) {
  return Boolean(viewer && target && viewer !== target && !isSameTeam(viewer, target));
}

function isPlayerFriendly(plane) {
  return Boolean(game.player && plane && plane !== game.player && isSameTeam(game.player, plane));
}

function isPlayerHostile(plane) {
  return Boolean(game.player && plane && plane !== game.player && !isSameTeam(game.player, plane));
}

function getHostilePlanes(owner, aliveOnly = true) {
  return getAllPlanes(true).filter((plane) => plane && plane !== owner && (!aliveOnly || plane.alive) && !isSameTeam(owner, plane));
}

function getLockCandidates(owner) {
  return getHostilePlanes(owner, true);
}

function getDamageablePlanes(owner) {
  return getAllPlanes(true).filter((plane) => plane && plane !== owner && plane.alive);
}

function getPlaneHudTone(plane) {
  if (!plane) return "enemy";
  if (plane.isPlayer) return "player";
  return isPlayerFriendly(plane) ? "ally" : "enemy";
}

function getAliveHostileCountForPlayer() {
  if (!game.player) return 0;
  return getHostilePlanes(game.player, true).length;
}

let lastHitVibeAt = 0;

const MISSILE_MAX_AMMO = 2;
const MISSILE_SPEED = 650;
const MISSILE_TURN_RATE = 1.12;
const MISSILE_LOCK_RANGE = 1800;
const MISSILE_LOCK_DOT = 0.58;
const MISSILE_LOCK_DROP_RANGE = 2000;
const MISSILE_LOCK_DROP_DOT = 0.42;
const MISSILE_BODY_COLLISION_RADIUS = 0.5;
const BOT_MODE_INTERCEPT = "intercept";
const BOT_MODE_PURSUIT = "pursuit";
const BOT_MODE_REPOSITION = "reposition";
const BOT_MODE_RECOVER = "recover";
const BOT_MODE_WALL_RETURN = "wallReturn";
const BOT_MODE_REGROUP = "regroup";
const BOT_TARGET_HOLD_TIME = 1.2;
const BOT_COMBAT_RING_SOFT = ARENA * 0.52;
const BOT_COMBAT_RING_HARD = ARENA * 0.64;
const BOT_TARGET_WALL_REJECT = ARENA * 0.7;
const BOT_REGROUP_MIN_TIME = 0.45;
const BOT_REGROUP_MAX_TIME = 0.75;
const BOT_WALL_TARGET_DROP_TIME = 0.35;
const BOT_WALL_RETURN_MIN_TIME = 1.1;
const BOT_WALL_RETURN_MAX_TIME = 1.75;
const BOT_POST_WALL_REGROUP_TIME = 0.28;
const BOT_WALL_UNSAFE_HOLD_TIME = 0.12;
const BOT_WALL_SAFE_EXIT_HOLD_TIME = 0.25;
const BOT_WALL_EXIT_CLEARANCE = 420;
const BOT_WALL_RETURN_RING_INNER = ARENA * 0.24;
const BOT_WALL_RETURN_RING_OUTER = ARENA * 0.32;
const BOT_OBSTACLE_BOUNCE_TRIGGER = 5;
const BOT_OBSTACLE_BOUNCE_WINDOW = 1.15;
const BOT_OBSTACLE_CLIMB_TIME = 0.9;
const BOT_INTERCEPT_RANGE = 1700;
const BOT_HARD_INTERCEPT_RANGE = 2200;
const BOT_PREFERRED_RANGE_MIN = 260;
const BOT_PREFERRED_RANGE_MAX = 700;
const BOT_REPOSITION_STALE_TIME = 1.5;
const BOT_REPOSITION_MIN_TIME = 0.6;
const BOT_REPOSITION_MAX_TIME = 0.9;
const BOT_RECOVER_MIN_TIME = 0.68;
const BOT_RECOVER_MAX_TIME = 0.92;
const BOT_GUN_MIN_RANGE = 160;
const BOT_GUN_MAX_RANGE = 1050;
const BOT_ATTACK_ALIGN_RANGE = 2200;
const BOT_ATTACK_WINDOW_BUILD = 0.12;
const BOT_ATTACK_WINDOW_DECAY = 1.45;
const BOT_BURST_MIN_TIME = 0.3;
const BOT_BURST_MAX_TIME = 0.52;
const BOT_MISSILE_MIN_RANGE = 520;
const BOT_MISSILE_MAX_RANGE = 1600;
const BOT_MISSILE_LOCK_HOLD_MIN = 0.25;
const BOT_MISSILE_LOCK_HOLD_MAX = 0.45;
const BOT_STUCK_PROGRESS_RATIO = 0.28;
const BOT_TEAM_SEPARATION_RADIUS = 280;
const BOT_TEAM_SEPARATION_HEIGHT = 140;
const BOT_TEAM_SEPARATION_WEIGHT = 1.05;
const BOT_FORMATION_SIDE_GAP = 92;
const BOT_FORMATION_VERTICAL_GAP = 20;
const BOT_TARGET_CROWDING_PENALTY = 0.24;


function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function rand(a, b) {
  return a + Math.random() * (b - a);
}

function smoothApproach(current, target, rate, dt) {
  const t = 1 - Math.exp(-rate * dt);
  return current + (target - current) * t;
}

function prepareCockpitOverlay(frameImg, overlayEl) {
  if (!frameImg) return;

  const isPurpleMarker = (r, g, b) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    if (max < 36) return false;

    let hue = 0;
    if (chroma > 0) {
      if (max === r) hue = ((g - b) / chroma) % 6;
      else if (max === g) hue = (b - r) / chroma + 2;
      else hue = (r - g) / chroma + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }

    const sat = max === 0 ? 0 : chroma / max;
    const rbAvg = (r + b) * 0.5;
    const purpleBias = rbAvg - g;
    const huePurple = hue >= 220 && hue <= 340;
    const channelPurple = r > g + 7 && b > g + 7;
    const biasStrong = purpleBias >= 14;
    return biasStrong && (huePurple || channelPurple) && (sat >= 0.08 || purpleBias >= 24);
  };
  const isRedMarker = (r, g, b) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    if (max < 72 || chroma < 38) return false;

    let hue = 0;
    if (chroma > 0) {
      if (max === r) hue = ((g - b) / chroma) % 6;
      else if (max === g) hue = (b - r) / chroma + 2;
      else hue = (r - g) / chroma + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }

    const sat = max === 0 ? 0 : chroma / max;
    const redHue = hue <= 24 || hue >= 336;
    return redHue && sat >= 0.42 && r >= g + 42 && r >= b + 42;
  };

  const detectRedMarkerRatios = (pixels, targetWidth, targetHeight) => {
    const total = targetWidth * targetHeight;
    const redMask = new Uint8Array(total);
    for (let i = 0, px = 0; i < pixels.length; i += 4, px += 1) {
      redMask[px] = isRedMarker(pixels[i], pixels[i + 1], pixels[i + 2]) ? 1 : 0;
    }

    const visited = new Uint8Array(total);
    const stack = [];
    const components = [];

    for (let y = 0; y < targetHeight; y += 1) {
      for (let x = 0; x < targetWidth; x += 1) {
        const start = y * targetWidth + x;
        if (!redMask[start] || visited[start]) continue;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let count = 0;
        visited[start] = 1;
        stack.push(start);

        while (stack.length > 0) {
          const idx = stack.pop();
          const px = idx % targetWidth;
          const py = Math.floor(idx / targetWidth);
          count += 1;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;

          for (let ny = Math.max(0, py - 1); ny <= Math.min(targetHeight - 1, py + 1); ny += 1) {
            for (let nx = Math.max(0, px - 1); nx <= Math.min(targetWidth - 1, px + 1); nx += 1) {
              if (nx === px && ny === py) continue;
              const nIdx = ny * targetWidth + nx;
              if (!redMask[nIdx] || visited[nIdx]) continue;
              visited[nIdx] = 1;
              stack.push(nIdx);
            }
          }
        }

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const centerX = (minX + maxX + 1) * 0.5 / targetWidth;
        const centerY = (minY + maxY + 1) * 0.5 / targetHeight;
        const widthRatio = width / targetWidth;
        const heightRatio = height / targetHeight;

        if (count < 1) continue;
        if (widthRatio > 0.02 || heightRatio > 0.02) continue;
        if (centerX < 0.2 || centerX > 0.8) continue;
        if (centerY < 0.1 || centerY > 0.75) continue;

        components.push({ minX, maxX, minY, maxY, count, centerX, centerY });
      }
    }

    if (components.length < 4) return null;

    const pool = components.sort((a, b) => b.count - a.count).slice(0, 18);
    if (pool.length < 4) return null;

    let best = null;
    let bestScore = -Infinity;

    for (let i = 0; i <= pool.length - 4; i += 1) {
      for (let j = i + 1; j <= pool.length - 3; j += 1) {
        for (let k = j + 1; k <= pool.length - 2; k += 1) {
          for (let l = k + 1; l <= pool.length - 1; l += 1) {
            const set = [pool[i], pool[j], pool[k], pool[l]];
            let minX = targetWidth;
            let minY = targetHeight;
            let maxX = -1;
            let maxY = -1;
            let signal = 0;

            set.forEach((c) => {
              if (c.minX < minX) minX = c.minX;
              if (c.minY < minY) minY = c.minY;
              if (c.maxX > maxX) maxX = c.maxX;
              if (c.maxY > maxY) maxY = c.maxY;
              signal += c.count;
            });

            const midX = (minX + maxX + 1) * 0.5;
            const midY = (minY + maxY + 1) * 0.5;
            let tl = null;
            let tr = null;
            let bl = null;
            let br = null;

            set.forEach((c) => {
              const px = (c.minX + c.maxX + 1) * 0.5;
              const py = (c.minY + c.maxY + 1) * 0.5;
              const point = { x: px, y: py, count: c.count, minX: c.minX, maxX: c.maxX, minY: c.minY, maxY: c.maxY };
              if (px <= midX && py <= midY && (!tl || point.count > tl.count)) tl = point;
              if (px > midX && py <= midY && (!tr || point.count > tr.count)) tr = point;
              if (px <= midX && py > midY && (!bl || point.count > bl.count)) bl = point;
              if (px > midX && py > midY && (!br || point.count > br.count)) br = point;
            });

            if (!(tl && tr && bl && br)) continue;

            const topY = (tl.y + tr.y) * 0.5;
            const bottomY = (bl.y + br.y) * 0.5;
            const topSpan = tr.x - tl.x;
            const bottomSpan = br.x - bl.x;
            const verticalSpan = bottomY - topY;
            if (topSpan <= 2 || bottomSpan <= 2 || verticalSpan <= 2) continue;
            if (topSpan <= bottomSpan * 1.06) continue;

            const widthFromTop = topSpan / 0.82;
            const widthFromBottom = bottomSpan / 0.45;
            const markerWidthPx = (widthFromTop * 0.62) + (widthFromBottom * 0.38);
            const markerHeightPx = verticalSpan / 0.62;
            if (markerWidthPx <= 8 || markerHeightPx <= 8) continue;

            const leftFromTL = tl.x - markerWidthPx * 0.09;
            const leftFromTR = tr.x - markerWidthPx * 0.91;
            const leftFromBL = bl.x - markerWidthPx * 0.275;
            const leftFromBR = br.x - markerWidthPx * 0.725;
            const markerLeft = (leftFromTL + leftFromTR + leftFromBL + leftFromBR) * 0.25;

            const topFromTop = topY - markerHeightPx * 0.27;
            const topFromBottom = bottomY - markerHeightPx * 0.89;
            const markerTop = (topFromTop * 0.65) + (topFromBottom * 0.35);

            const centerX = (markerLeft + markerWidthPx * 0.5) / targetWidth;
            const centerY = (markerTop + markerHeightPx * 0.5) / targetHeight;
            const markerWidthRatio = markerWidthPx / targetWidth;
            const markerHeightRatio = markerHeightPx / targetHeight;

            if (centerX < 0.38 || centerX > 0.62) continue;
            if (centerY < 0.24 || centerY > 0.62) continue;
            if (markerWidthRatio < 0.08 || markerWidthRatio > 0.42) continue;
            if (markerHeightRatio < 0.1 || markerHeightRatio > 0.5) continue;

            const skewPenalty = (
              Math.abs(tl.y - tr.y)
              + Math.abs(bl.y - br.y)
              + Math.abs((tl.x - bl.x) - (tr.x - br.x))
            ) * 1.6;
            const fitPenalty = (
              Math.abs(leftFromTL - leftFromTR)
              + Math.abs(leftFromTL - leftFromBL)
              + Math.abs(leftFromTL - leftFromBR)
              + Math.abs(topFromTop - topFromBottom)
            ) * 0.5;
            const penalty = (
              Math.abs(centerX - 0.5) * 620
              + Math.abs(centerY - DEFAULT_COCKPIT_MARKER_RATIOS.centerY) * 720
              + Math.abs(markerWidthRatio - DEFAULT_COCKPIT_MARKER_RATIOS.width) * 440
              + Math.abs(markerHeightRatio - DEFAULT_COCKPIT_MARKER_RATIOS.height) * 440
            );
            const score = signal - penalty - skewPenalty - fitPenalty;
            if (score > bestScore) {
              bestScore = score;
              best = {
                centerX,
                centerY,
                width: markerWidthRatio,
                height: markerHeightRatio,
              };
            }
          }
        }
      }
    }

    return isValidCockpitRatios(best) ? best : null;
  };
  const applyMask = () => {
    const width = frameImg.naturalWidth;
    const height = frameImg.naturalHeight;
    if (!width || !height) return;

    const upscale = clamp(Math.ceil(window.devicePixelRatio || 1), 1, 3);
    const targetWidth = width * upscale;
    const targetHeight = height * upscale;

    const workCanvas = document.createElement("canvas");
    workCanvas.width = targetWidth;
    workCanvas.height = targetHeight;
    const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
    if (!workCtx) return;

    workCtx.imageSmoothingEnabled = true;
    workCtx.imageSmoothingQuality = "high";
    workCtx.drawImage(frameImg, 0, 0, targetWidth, targetHeight);
    const imageData = workCtx.getImageData(0, 0, targetWidth, targetHeight);
    const pixels = imageData.data;
    const markerMask = new Uint8Array(targetWidth * targetHeight);
    for (let i = 0, px = 0; i < pixels.length; i += 4, px += 1) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      markerMask[px] = isPurpleMarker(r, g, b) ? 1 : 0;
    }
    cockpitMarkerRatios = null;

    const expandedMask = new Uint8Array(markerMask);
    for (let y = 1; y < targetHeight - 1; y += 1) {
      for (let x = 1; x < targetWidth - 1; x += 1) {
        const idx = y * targetWidth + x;
        if (markerMask[idx]) continue;
        if (
          markerMask[idx - 1] || markerMask[idx + 1]
          || markerMask[idx - targetWidth] || markerMask[idx + targetWidth]
          || markerMask[idx - targetWidth - 1] || markerMask[idx - targetWidth + 1]
          || markerMask[idx + targetWidth - 1] || markerMask[idx + targetWidth + 1]
        ) {
          expandedMask[idx] = 1;
        }
      }
    }

    for (let i = 0, px = 0; i < pixels.length; i += 4, px += 1) {
      pixels[i + 3] = expandedMask[px] ? 0 : 255;
    }

    workCtx.putImageData(imageData, 0, 0);
    frameImg.src = workCanvas.toDataURL("image/png");

    if (overlayEl) overlayEl.dataset.maskReady = "true";
    updateCockpitOverlayLayout();
  };

  if (frameImg.complete && frameImg.naturalWidth) {
    applyMask();
  } else {
    frameImg.addEventListener("load", applyMask, { once: true });
  }
}
function addObstacle(mesh, padding = 0) {
  if (!mesh) return;
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3().setFromObject(mesh);
  if (padding > 0) box.expandByScalar(padding);
  staticObstacles.push(box);
  staticObstacleMeshes.push(mesh);
}

function getLockAimPoint(plane, out = tmpVecD) {
  const pos = plane?.mesh?.position;
  if (!pos) return out.set(0, 0, 0);
  out.copy(pos);
  out.y += 14;
  return out;
}

function hasLineOfSight(origin, targetPlane) {
  if (!targetPlane?.mesh || staticObstacleMeshes.length === 0) return true;
  const targetPos = getLockAimPoint(targetPlane, tmpVecD);
  const dir = tmpVecB.copy(targetPos).sub(origin);
  const dist = dir.length();
  if (dist <= 1e-3) return true;

  dir.multiplyScalar(1 / dist);
  losRaycaster.set(origin, dir);
  losRaycaster.near = 0.1;
  losRaycaster.far = dist - 2;

  const hits = losRaycaster.intersectObjects(staticObstacleMeshes, false);
  return hits.length === 0;
}

function intersectsObstacle(position, radius = 0) {
  for (const box of staticObstacles) {
    tmpBox.copy(box).expandByScalar(radius);
    if (tmpBox.containsPoint(position)) return true;
  }
  return false;
}


function obstacleThreat(position, forward, distances = OBSTACLE_THREAT_DISTANCES, radius = 26) {
  const maxDistance = distances === OBSTACLE_THREAT_DISTANCES
    ? OBSTACLE_THREAT_MAX_DISTANCE
    : Math.max(1, distances[distances.length - 1] || 0);

  for (const d of distances) {
    obstacleThreatProbe.copy(forward).multiplyScalar(d).add(position);
    if (intersectsObstacle(obstacleThreatProbe, radius)) return 1 - (d / maxDistance);
  }
  return 0;
}

function obstacleAvoidance(position, forward, lookAhead = 140, sideDir = null, upDir = AXIS_Y) {
  const probeSide = sideDir && sideDir.lengthSq() > 1e-4 ? sideDir : AXIS_Z;
  const probeUp = upDir && upDir.lengthSq() > 1e-4 ? upDir : AXIS_Y;
  const avoid = tmpVecB.set(0, 0, 0);
  let weight = 0;

  const sampleProbe = (sideOffset, upOffset, scale) => {
    botProbePointVec.copy(forward).multiplyScalar(lookAhead).add(position);
    if (sideOffset !== 0) botProbePointVec.addScaledVector(probeSide, sideOffset);
    if (upOffset !== 0) botProbePointVec.addScaledVector(probeUp, upOffset);

    for (const box of staticObstacles) {
      const d = box.distanceToPoint(botProbePointVec);
      if (d > 132) continue;

      box.getCenter(tmpVecC);
      const away = tmpVecD.subVectors(botProbePointVec, tmpVecC);
      const lenSq = away.lengthSq();
      if (lenSq < 1e-4) continue;

      away.multiplyScalar(1 / Math.sqrt(lenSq));
      const sampleWeight = ((132 - d) / 132) * scale;
      avoid.addScaledVector(away, sampleWeight);
      weight += sampleWeight;
    }
  };

  sampleProbe(0, 0, 1.2);
  sampleProbe(56, 0, 0.95);
  sampleProbe(-56, 0, 0.95);
  sampleProbe(0, 34, 0.65);
  sampleProbe(0, -20, 0.55);

  if (weight > 0) avoid.multiplyScalar(1 / weight);
  return avoid;
}

function wallThreat(position, forward, distances = WALL_THREAT_DISTANCES, margin = WALL_THREAT_MARGIN) {
  let best = 0;
  const maxDistance = distances === WALL_THREAT_DISTANCES
    ? WALL_THREAT_DISTANCES[WALL_THREAT_DISTANCES.length - 1]
    : Math.max(1, distances[distances.length - 1] || 0);

  const sampleThreat = (point, scale) => {
    const checkFace = (clearance, heading) => {
      if (clearance >= margin) return;
      const closeness = (margin - clearance) / margin;
      const approach = clamp((heading + 0.2) / 1.2, 0, 1);
      best = Math.max(best, closeness * scale * (0.24 + approach * 0.76));
    };

    checkFace(ARENA - point.x, forward.x);
    checkFace(point.x + ARENA, -forward.x);
    checkFace(ARENA - point.z, forward.z);
    checkFace(point.z + ARENA, -forward.z);
  };

  sampleThreat(position, 0.72);
  for (const d of distances) {
    botProbePointVec.copy(forward).multiplyScalar(d).add(position);
    const rangeScale = clamp(1 - d / (maxDistance + margin * 0.35), 0.28, 1);
    sampleThreat(botProbePointVec, rangeScale);
  }

  return clamp(best, 0, 1);
}

function wallAvoidance(position, forward, lookAhead = 260, sideDir = null, out = tmpVecA) {
  const probeSide = sideDir && sideDir.lengthSq() > 1e-4 ? sideDir : AXIS_Z;
  const avoid = out.set(0, 0, 0);
  let weight = 0;

  const addWallInfluence = (clearance, inwardX, inwardZ, heading, scale) => {
    if (clearance >= WALL_AVOID_MARGIN) return;
    const closeness = (WALL_AVOID_MARGIN - clearance) / WALL_AVOID_MARGIN;
    const approach = clamp((heading + 0.22) / 1.22, 0, 1);
    const sampleWeight = closeness * scale * (0.34 + approach * 0.78);
    avoid.x += inwardX * sampleWeight;
    avoid.z += inwardZ * sampleWeight;
    weight += sampleWeight;
  };

  const addWallProximity = (clearance, inwardX, inwardZ, scale) => {
    const proximityMargin = WALL_AVOID_MARGIN * 0.82;
    if (clearance >= proximityMargin) return;
    const closeness = (proximityMargin - clearance) / proximityMargin;
    const sampleWeight = closeness * scale;
    avoid.x += inwardX * sampleWeight;
    avoid.z += inwardZ * sampleWeight;
    weight += sampleWeight;
  };

  const samplePoint = (distance, sideOffset, scale) => {
    botProbePointVec.copy(position).addScaledVector(forward, distance);
    if (sideOffset !== 0) botProbePointVec.addScaledVector(probeSide, sideOffset);

    addWallInfluence(ARENA - botProbePointVec.x, -1, 0, forward.x, scale);
    addWallInfluence(botProbePointVec.x + ARENA, 1, 0, -forward.x, scale);
    addWallInfluence(ARENA - botProbePointVec.z, 0, -1, forward.z, scale);
    addWallInfluence(botProbePointVec.z + ARENA, 0, 1, -forward.z, scale);
  };

  samplePoint(lookAhead * 0.45, 0, 0.82);
  samplePoint(lookAhead, 0, 1.18);
  samplePoint(lookAhead * 0.82, 84, 0.96);
  samplePoint(lookAhead * 0.82, -84, 0.96);
  samplePoint(lookAhead * 0.58, 148, 0.58);
  samplePoint(lookAhead * 0.58, -148, 0.58);

  addWallProximity(ARENA - position.x, -1, 0, 0.92);
  addWallProximity(position.x + ARENA, 1, 0, 0.92);
  addWallProximity(ARENA - position.z, 0, -1, 0.92);
  addWallProximity(position.z + ARENA, 0, 1, 0.92);

  if (weight > 0) avoid.multiplyScalar(1 / weight);
  return avoid;
}

function getPlaneTravelForward(plane, out = tmpVecA) {
  if (plane?.velocity?.lengthSq?.() > 25) {
    return out.copy(plane.velocity).normalize();
  }
  return out.set(1, 0, 0).applyQuaternion(plane.mesh.quaternion).normalize();
}

function getArenaEdgeDistance(position) {
  return Math.max(Math.abs(position.x), Math.abs(position.z));
}

function getBotSafeAnchor(out = tmpVecA) {
  const angle = rand(0, Math.PI * 2);
  const radius = rand(BOT_COMBAT_RING_SOFT * 0.7, BOT_COMBAT_RING_SOFT * 0.9);
  return out.set(Math.cos(angle) * radius, rand(260, 430), Math.sin(angle) * radius);
}

function getBotAnchorDirection(bot, out = botCenterBiasVec) {
  if (!bot?.mesh?.position) return out.set(0, 0, 0);
  out.set(-bot.mesh.position.x, clamp((290 - bot.mesh.position.y) / 220, -0.2, 0.2), -bot.mesh.position.z);
  if (out.lengthSq() <= 1e-4) return out.set(1, 0, 0);
  return out.normalize();
}

function pickWallReturnSide(bot, wallNormal = null) {
  if (!bot?.mesh?.position) return Math.random() < 0.5 ? -1 : 1;
  getBotAnchorDirection(bot, tmpVecA);
  if (wallNormal?.lengthSq?.() > 1e-4) {
    tmpVecB.crossVectors(AXIS_Y, wallNormal);
    if (tmpVecB.lengthSq() < 1e-4) tmpVecB.set(wallNormal.z, 0, -wallNormal.x);
    else tmpVecB.normalize();
    tmpVecC.copy(tmpVecB).multiplyScalar(-1);
    return tmpVecB.dot(tmpVecA) >= tmpVecC.dot(tmpVecA) ? 1 : -1;
  }
  tmpVecB.set(-tmpVecA.z, 0, tmpVecA.x);
  return tmpVecB.dot(getPlaneTravelForward(bot, tmpVecC).setY(0).normalize()) >= 0 ? 1 : -1;
}

function getBotWallReturnAnchor(bot, out = tmpVecA) {
  if (!bot?.mesh?.position) return out.set(0, 280, 0);
  getBotAnchorDirection(bot, tmpVecB);
  tmpVecB.y = 0;
  if (tmpVecB.lengthSq() < 1e-4) tmpVecB.set(1, 0, 0);
  else tmpVecB.normalize();
  const baseAngle = Math.atan2(tmpVecB.z, tmpVecB.x);
  const offsetAngle = (bot.wallReturnSide || 1) * 0.28;
  const radius = (BOT_WALL_RETURN_RING_INNER + BOT_WALL_RETURN_RING_OUTER) * 0.5;
  out.set(Math.cos(baseAngle + offsetAngle) * radius, 280, Math.sin(baseAngle + offsetAngle) * radius);
  return out;
}

function getWallClearance(position) {
  return ARENA - getArenaEdgeDistance(position);
}

function getWallFaceId(position, threshold = 6) {
  const hitPosX = position.x >= ARENA - threshold;
  const hitNegX = position.x <= -ARENA + threshold;
  const hitPosZ = position.z >= ARENA - threshold;
  const hitNegZ = position.z <= -ARENA + threshold;
  const hitCount = Number(hitPosX) + Number(hitNegX) + Number(hitPosZ) + Number(hitNegZ);
  if (hitCount >= 2) return "corner";
  if (hitPosX) return "posX";
  if (hitNegX) return "negX";
  if (hitPosZ) return "posZ";
  if (hitNegZ) return "negZ";
  return null;
}

function getRequiredWallClearance(speed) {
  return Math.max(260, speed / Math.max(0.001, TURN_RATE) * 1.45 + 120);
}

function chooseWallAvoidDir(bot, wallNormal, desiredDir, out = tmpVecA) {
  tmpVecB.crossVectors(AXIS_Y, wallNormal);
  if (tmpVecB.lengthSq() < 1e-4) tmpVecB.set(wallNormal.z, 0, -wallNormal.x);
  else tmpVecB.normalize();

  tmpVecC.copy(tmpVecB).multiplyScalar(-1);
  getBotAnchorDirection(bot, tmpVecD);
  tmpVecD.y = 0;
  if (tmpVecD.lengthSq() < 1e-4) tmpVecD.set(1, 0, 0);
  else tmpVecD.normalize();

  out.copy(tmpVecB.dot(tmpVecD) >= tmpVecC.dot(tmpVecD) ? tmpVecB : tmpVecC).addScaledVector(wallNormal, 0.45);
  if (out.lengthSq() < 1e-4) out.copy(wallNormal);
  out.y = Math.max(out.y, 0);
  return out.normalize();
}

function computeWallDanger(bot, out = botWallTurnPlan) {
  const pos = bot?.mesh?.position;
  if (!pos) {
    out.wallUnsafe = false;
    out.clearance = Infinity;
    out.timeToWall = Infinity;
    out.timeNeeded = 0;
    out.planarSpeed = 0;
    out.wallNormal.set(0, 0, 0);
    out.avoidDir.set(0, 0, 0);
    out.faceId = null;
    return out;
  }

  const planarSpeed = Math.max(150, Math.hypot(bot.velocity?.x || 0, bot.velocity?.z || 0), bot.speed || 0);
  getPlaneTravelForward(bot, tmpVecA);
  tmpVecA.y = 0;
  if (tmpVecA.lengthSq() < 1e-4) tmpVecA.set(1, 0, 0);
  else tmpVecA.normalize();

  const timeToFullBank = Math.max(0, (MAX_BANK - Math.abs(bot.roll || 0)) / Math.max(0.001, BANK_RATE));
  const timeNeeded = timeToFullBank + 0.9 + 0.18;
  let bestTimeToWall = Infinity;
  let bestClearance = Infinity;
  let bestNormalX = 0;
  let bestNormalZ = 0;
  let bestFaceId = null;

  const considerFace = (clearance, inwardX, inwardZ, faceId) => {
    tmpVecB.set(inwardX, 0, inwardZ);
    const closingSpeed = Math.max(0, -tmpVecA.dot(tmpVecB)) * planarSpeed;
    if (closingSpeed <= 1) return;
    const timeToWall = clearance / Math.max(1, closingSpeed);
    if (timeToWall >= bestTimeToWall) return;
    bestTimeToWall = timeToWall;
    bestClearance = clearance;
    bestNormalX = inwardX;
    bestNormalZ = inwardZ;
    bestFaceId = faceId;
  };

  considerFace(ARENA - pos.x, -1, 0, "posX");
  considerFace(pos.x + ARENA, 1, 0, "negX");
  considerFace(ARENA - pos.z, 0, -1, "posZ");
  considerFace(pos.z + ARENA, 0, 1, "negZ");

  out.wallUnsafe = bestTimeToWall <= timeNeeded;
  out.clearance = bestClearance;
  out.timeToWall = bestTimeToWall;
  out.timeNeeded = timeNeeded;
  out.planarSpeed = planarSpeed;
  out.wallNormal.set(bestNormalX, 0, bestNormalZ);
  out.faceId = bestFaceId;
  if (bestTimeToWall < Infinity && out.wallNormal.lengthSq() > 1e-4) chooseWallAvoidDir(bot, out.wallNormal, tmpVecA, out.avoidDir);
  else out.avoidDir.copy(tmpVecA);
  return out;
}

function getWallTurnPlan(bot, desiredDir, out = botWallTurnPlan) {
  return computeWallDanger(bot, out);
}

function isTargetTooCloseToWall(target, bot = null) {
  if (target?.mesh?.position) {
    return computeWallDanger(target, botTargetWallPlan).wallUnsafe;
  }
  const pos = target?.mesh?.position || target;
  if (!pos) return false;
  const speed = Math.max(bot?.speed || 0, 240);
  return getWallClearance(pos) <= Math.max(260, speed * 0.85 + 140);
}

function getArenaLeash(bot, out = tmpVecA) {
  const anchor = bot?.safeAnchor;
  if (!bot?.mesh?.position || !anchor) return out.set(0, 0, 0);
  const pos = bot.mesh.position;
  const flatDistance = Math.hypot(pos.x, pos.z);
  const leashStart = BOT_COMBAT_RING_HARD * 0.94;
  const leashEnd = BOT_TARGET_WALL_REJECT;
  const t = clamp((flatDistance - leashStart) / Math.max(1, leashEnd - leashStart), 0, 1);
  if (t <= 0) return out.set(0, 0, 0);
  const strength = t * t * (3 - 2 * t);
  out.copy(anchor).sub(pos);
  out.y = clamp(out.y / 260, -0.16, 0.16);
  if (out.lengthSq() <= 1e-4) out.set(-pos.x, 0, -pos.z);
  return out.normalize().multiplyScalar(strength);
}

function projectPointIntoCombatRing(point, radius = BOT_COMBAT_RING_HARD, out = point) {
  out.copy(point);
  const flatLength = Math.hypot(out.x, out.z);
  if (flatLength > radius && flatLength > 1e-4) {
    const overshoot = flatLength - radius;
    const outerLimit = Math.max(radius, BOT_TARGET_WALL_REJECT * 0.98);
    const compressedRadius = Math.min(outerLimit, radius + overshoot * 0.38);
    const scale = compressedRadius / flatLength;
    out.x *= scale;
    out.z *= scale;
  }
  out.y = clamp(out.y, FLOOR_Y + 120, WORLD_COMBAT_GUIDE_CEILING_Y);
  return out;
}

function getBotTrafficAvoidance(bot, out = botTrafficAvoidVec) {
  out.set(0, 0, 0);
  if (!bot?.mesh?.position) return out;

  let weight = 0;
  for (const other of getAllPlanes(true)) {
    if (other === bot || !other?.alive || !other?.mesh) continue;
    if (!isSameTeam(bot, other)) continue;

    const away = tmpVecB.subVectors(bot.mesh.position, other.mesh.position);
    const planarDistance = Math.hypot(away.x, away.z);
    const verticalDistance = Math.abs(away.y);
    if (planarDistance <= 1e-3 || planarDistance > BOT_TEAM_SEPARATION_RADIUS || verticalDistance > BOT_TEAM_SEPARATION_HEIGHT) continue;

    away.x /= planarDistance;
    away.z /= planarDistance;
    away.y = clamp(away.y / BOT_TEAM_SEPARATION_HEIGHT, -0.6, 0.6);
    const sampleWeight = Math.pow(1 - planarDistance / BOT_TEAM_SEPARATION_RADIUS, 2);
    out.addScaledVector(away.normalize(), sampleWeight);
    weight += sampleWeight;
  }

  if (weight > 0) out.multiplyScalar(1 / weight);
  return out;
}

function orientBotTowardDirection(bot, direction, blend = 0.72) {
  if (!bot || bot.isPlayer || !direction?.lengthSq?.() || direction.lengthSq() <= 1e-4) return;
  tmpVecC.copy(direction).normalize();
  const flat = Math.hypot(tmpVecC.x, tmpVecC.z);
  if (flat > 1e-4) {
    const yawTarget = Math.atan2(-tmpVecC.z, tmpVecC.x);
    bot.yaw = THREE.MathUtils.lerp(bot.yaw, yawTarget, blend);
  }
  const pitchTarget = clamp(Math.atan2(tmpVecC.y, Math.max(1e-4, flat)), -MAX_PITCH * 0.82, MAX_PITCH * 0.82);
  bot.pitch = THREE.MathUtils.lerp(bot.pitch, pitchTarget, blend);
  bot.roll = THREE.MathUtils.lerp(bot.roll, 0, Math.min(1, blend * 1.2));
}

function pickBotRepositionSide(bot, targetForward, toTargetDir) {
  if (!bot?.mesh?.position) return Math.random() < 0.5 ? -1 : 1;

  tmpVecC.copy(targetForward);
  if (tmpVecC.lengthSq() < 1e-4) tmpVecC.set(1, 0, 0);
  else tmpVecC.normalize();

  tmpVecD.crossVectors(tmpVecC, AXIS_Y);
  if (tmpVecD.lengthSq() < 1e-4) tmpVecD.set(0, 0, 1);
  else tmpVecD.normalize();

  tmpVecB.set(-bot.mesh.position.x, 0, -bot.mesh.position.z);
  if (tmpVecB.lengthSq() > 1e-4) {
    tmpVecB.normalize();
    const inwardSide = tmpVecD.dot(tmpVecB);
    if (Math.abs(inwardSide) > 0.1) return inwardSide >= 0 ? 1 : -1;
  }

  tmpVecB.copy(toTargetDir);
  tmpVecB.y = 0;
  if (tmpVecB.lengthSq() > 1e-4) {
    tmpVecB.normalize();
    const relativeSide = tmpVecD.dot(tmpVecB);
    if (Math.abs(relativeSide) > 0.08) return relativeSide >= 0 ? 1 : -1;
  }

  return Math.random() < 0.5 ? -1 : 1;
}

function getWallEscapeDirection(position, velocity = null, out = tmpVecA) {
  out.set(0, 0, 0);

  if (position.x >= ARENA - 2) out.x -= 1;
  else if (position.x <= -ARENA + 2) out.x += 1;

  if (position.z >= ARENA - 2) out.z -= 1;
  else if (position.z <= -ARENA + 2) out.z += 1;

  if (out.lengthSq() < 1e-4 && velocity?.lengthSq?.() > 1e-4) {
    if (Math.abs(position.x) > ARENA - 44) out.x = -(Math.sign(velocity.x) || Math.sign(position.x) || 1);
    if (Math.abs(position.z) > ARENA - 44) out.z = -(Math.sign(velocity.z) || Math.sign(position.z) || 1);
  }

  if (out.lengthSq() < 1e-4) {
    if (Math.abs(position.x) >= Math.abs(position.z)) out.x = -(Math.sign(position.x) || 1);
    else out.z = -(Math.sign(position.z) || 1);
  }

  out.y = Math.max(out.y, 0.14);
  return out.normalize();
}

function getWallSlideDirection(position, velocity = null, out = tmpVecA) {
  getWallEscapeDirection(position, velocity, out);

  tmpVecB.set(-position.x, 0, -position.z);
  tmpVecB.addScaledVector(out, -tmpVecB.dot(out));
  if (tmpVecB.lengthSq() < 1e-4 && velocity?.lengthSq?.() > 1e-4) {
    tmpVecB.copy(velocity);
    tmpVecB.y = 0;
    tmpVecB.addScaledVector(out, -tmpVecB.dot(out));
  }
  if (tmpVecB.lengthSq() < 1e-4) {
    if (Math.abs(out.x) >= Math.abs(out.z)) tmpVecB.set(0, 0, Math.sign(position.z || 1) || 1);
    else tmpVecB.set(Math.sign(position.x || 1) || 1, 0, 0);
  }

  tmpVecB.normalize();
  out.multiplyScalar(1.28).addScaledVector(tmpVecB, 0.52);
  out.y = Math.max(out.y, 0.14);
  return out.normalize();
}

function getObstacleEscapeDirection(position, out = tmpVecA) {
  let closestBox = null;
  let closestDist = Infinity;
  for (const box of staticObstacles) {
    const d = box.distanceToPoint(position);
    if (d < closestDist) {
      closestDist = d;
      closestBox = box;
    }
  }

  if (!closestBox) return out.set(0, 0, 0);

  const candidates = [
    { dist: Math.abs(position.x - closestBox.min.x), x: -1, y: 0, z: 0 },
    { dist: Math.abs(closestBox.max.x - position.x), x: 1, y: 0, z: 0 },
    { dist: Math.abs(position.z - closestBox.min.z), x: 0, y: 0, z: -1 },
    { dist: Math.abs(closestBox.max.z - position.z), x: 0, y: 0, z: 1 },
    { dist: Math.abs(position.y - closestBox.min.y), x: 0, y: -1, z: 0 },
    { dist: Math.abs(closestBox.max.y - position.y), x: 0, y: 1, z: 0 },
  ];

  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].dist < best.dist) best = candidates[i];
  }

  return out.set(best.x, best.y, best.z);
}

function resolveObstacleSlide(plane, obstacle, previousPosition, outNormal = tmpVecA) {
  tmpVecB.copy(plane.mesh.position);
  const slideNormal = getObstacleEscapeDirection(tmpVecB, outNormal);
  slideNormal.y = Math.max(slideNormal.y, 0);
  if (slideNormal.lengthSq() < 1e-4) {
    obstacle.getCenter(tmpVecC);
    slideNormal.subVectors(tmpVecB, tmpVecC);
    slideNormal.y = Math.max(slideNormal.y, 0);
  }
  if (slideNormal.lengthSq() < 1e-4) {
    slideNormal.set(Math.random() < 0.5 ? 1 : -1, 0, Math.random() < 0.5 ? 1 : -1);
  }
  slideNormal.normalize();

  tmpVecD.copy(plane.velocity);
  if (tmpVecD.lengthSq() < 25) tmpVecD.copy(getPlaneTravelForward(plane, tmpVecC));
  tmpVecD.addScaledVector(slideNormal, -tmpVecD.dot(slideNormal));
  if (tmpVecD.lengthSq() < 1e-4) tmpVecD.set(-slideNormal.z, 0, slideNormal.x);
  if (tmpVecD.lengthSq() < 1e-4) tmpVecD.crossVectors(slideNormal, AXIS_Y);
  if (tmpVecD.lengthSq() < 1e-4) tmpVecD.set(1, 0, 0);
  tmpVecD.normalize();

  plane.mesh.position.copy(previousPosition);
  if (intersectsObstacle(plane.mesh.position, 12)) {
    plane.mesh.position.copy(tmpVecB);
  }

  for (let i = 0; i < 4 && intersectsObstacle(plane.mesh.position, 12); i++) {
    plane.mesh.position.addScaledVector(slideNormal, 24);
  }
  plane.mesh.position.addScaledVector(slideNormal, 16);

  const slideSpeed = Math.max(110, plane.speed * 0.56);
  plane.velocity.copy(tmpVecD).multiplyScalar(slideSpeed);
  plane.velocity.addScaledVector(slideNormal, 56);
  plane.velocity.y = Math.max(plane.velocity.y, 12);

  return slideNormal;
}

function setBotMode(bot, mode) {
  if (!bot || bot.engagementMode === mode) return;
  bot.engagementMode = mode;
  bot.engagementTimer = 0;
}

function beginBotReposition(bot, side = 0) {
  if (!bot || bot.isPlayer) return;
  bot.repositionSide = side || bot.repositionSide || (Math.random() < 0.5 ? -1 : 1);
  bot.repositionTimer = rand(BOT_REPOSITION_MIN_TIME, BOT_REPOSITION_MAX_TIME);
  bot.attackWindowTimer = 0;
  bot.burstTimer = 0;
  bot.missileTarget = null;
  bot.missileLockHoldTimer = 0;
  bot.missileLockHoldDuration = rand(BOT_MISSILE_LOCK_HOLD_MIN, BOT_MISSILE_LOCK_HOLD_MAX);
  setBotMode(bot, BOT_MODE_REPOSITION);
}

function enterBotWallReturn(bot, source = "near_wall", wallPlan = null, duration = rand(BOT_WALL_RETURN_MIN_TIME, BOT_WALL_RETURN_MAX_TIME)) {
  if (!bot || bot.isPlayer) return;
  const faceId = wallPlan?.faceId || bot.wallFaceId || null;
  if (source !== "hit" && bot.wallState !== "none" && faceId && bot.wallFaceId === faceId) return;

  bot.wallState = source === "hit" ? "postBounce" : "preAvoid";
  bot.wallFaceId = faceId;
  bot.wallUnsafeHoldTimer = 0;
  bot.wallReturnTimer = Math.max(bot.wallReturnTimer || 0, duration);
  bot.wallPostReturnTimer = 0;
  bot.target = null;
  bot.targetHoldTimer = 0;
  bot.wallTargetTimer = 0;
  bot.repositionTimer = 0;
  bot.engagementTimer = 0;
  resetBotAttackState(bot);
  bot.missileTarget = null;
  bot.missileLockHoldTimer = 0;
  bot.wallContactCooldown = Math.max(bot.wallContactCooldown || 0, source === "hit" ? 0.34 : WALL_CONTACT_COOLDOWN);

  if (wallPlan?.wallNormal?.lengthSq?.() > 1e-4) {
    chooseWallAvoidDir(bot, wallPlan.wallNormal, getBotAnchorDirection(bot, tmpVecA), bot.wallEscapeDir);
  } else {
    getBotAnchorDirection(bot, bot.wallEscapeDir);
  }

  bot.wallReturnSide = pickWallReturnSide(bot, wallPlan?.wallNormal || null);
  getBotWallReturnAnchor(bot, bot.wallReturnAnchor);
  setBotMode(bot, BOT_MODE_WALL_RETURN);
}

function startBotWallReturn(bot, source = "near_wall", wallNormal = null, duration = rand(BOT_WALL_RETURN_MIN_TIME, BOT_WALL_RETURN_MAX_TIME)) {
  const faceId = wallNormal?.x < 0 ? "posX" : wallNormal?.x > 0 ? "negX" : wallNormal?.z < 0 ? "posZ" : wallNormal?.z > 0 ? "negZ" : null;
  botWallTurnPlan.wallNormal.copy(wallNormal || AXIS_X);
  botWallTurnPlan.faceId = faceId;
  enterBotWallReturn(bot, source, botWallTurnPlan, duration);
}

function beginBotRecovery(bot, away, duration = rand(BOT_RECOVER_MIN_TIME, BOT_RECOVER_MAX_TIME)) {
  if (!bot || bot.isPlayer) return;

  if (away?.lengthSq?.() > 1e-4) botRecoveryVec.copy(away);
  else getWallSlideDirection(bot.mesh.position, bot.velocity, botRecoveryVec);

  botRecoveryVec.y = Math.max(botRecoveryVec.y, 0.12);
  if (botRecoveryVec.lengthSq() < 1e-4) botRecoveryVec.set(Math.random() < 0.5 ? 1 : -1, 0.18, Math.random() < 0.5 ? 1 : -1);
  botRecoveryVec.normalize();

  bot.wallEscapeDir.copy(botRecoveryVec);
  bot.wallRecoverTimer = Math.max(bot.wallRecoverTimer || 0, duration);
  bot.wallContactCooldown = Math.max(bot.wallContactCooldown || 0, Math.max(WALL_CONTACT_COOLDOWN, duration * 0.55));
  botWallTurnPlan.wallNormal.copy(botRecoveryVec);
  botWallTurnPlan.faceId = bot.wallFaceId;
  enterBotWallReturn(bot, "near_wall", botWallTurnPlan, Math.max(BOT_WALL_RETURN_MIN_TIME, duration * 1.1));
  bot.stuckTimer = 0;

  const velocityMag = Math.max(bot.speed, bot.velocity.length(), 170);
  if (bot.velocity.lengthSq() > 25) tmpVecC.copy(bot.velocity).normalize().lerp(botRecoveryVec, 0.32).normalize();
  else tmpVecC.copy(botRecoveryVec);
  bot.velocity.copy(tmpVecC).multiplyScalar(velocityMag);
  bot.velocity.y = Math.max(bot.velocity.y, 12);
  setBotMode(bot, BOT_MODE_WALL_RETURN);
}

function registerBotObstacleBounce(bot, slideNormal) {
  if (!bot || bot.isPlayer) return;

  if ((bot.obstacleBounceWindow || 0) > 0) {
    bot.obstacleBounceCount = (bot.obstacleBounceCount || 0) + 1;
  } else {
    bot.obstacleBounceCount = 1;
  }
  bot.obstacleBounceWindow = BOT_OBSTACLE_BOUNCE_WINDOW;

  if (bot.obstacleBounceCount < BOT_OBSTACLE_BOUNCE_TRIGGER) return;

  bot.obstacleBounceCount = 0;
  bot.obstacleBounceWindow = 0;
  bot.obstacleClimbTimer = Math.max(bot.obstacleClimbTimer || 0, BOT_OBSTACLE_CLIMB_TIME);
  bot.attackWindowTimer = 0;
  bot.burstTimer = 0;

  tmpVecB.copy(slideNormal);
  tmpVecB.y = 0;
  if (tmpVecB.lengthSq() < 1e-4) tmpVecB.copy(getPlaneTravelForward(bot, tmpVecC));
  else tmpVecB.normalize();

  bot.velocity.addScaledVector(tmpVecB, 36);
  bot.velocity.y = Math.max(bot.velocity.y, 185);
  bot.speed = Math.max(210, bot.speed * 0.88);
}

function snapBotTowardDirection(bot, direction) {
  if (!bot || bot.isPlayer || !direction?.lengthSq?.() || direction.lengthSq() <= 1e-4) return;
  tmpVecC.copy(direction).normalize();
  const flat = Math.hypot(tmpVecC.x, tmpVecC.z);
  if (flat > 1e-4) bot.yaw = Math.atan2(-tmpVecC.z, tmpVecC.x);
  bot.pitch = clamp(Math.atan2(tmpVecC.y, Math.max(1e-4, flat)), -MAX_PITCH * 0.82, MAX_PITCH * 0.82);
  bot.roll = 0;
}

function bounceBotOffWall(bot, inwardNormal, faceId = null) {
  if (!bot || bot.isPlayer) return;

  tmpVecB.copy(bot.velocity);
  if (tmpVecB.lengthSq() < 25) getPlaneTravelForward(bot, tmpVecB).multiplyScalar(Math.max(bot.speed, 220));
  if (tmpVecB.dot(inwardNormal) < 0) tmpVecB.reflect(inwardNormal);

  const bounceSpeed = clamp(Math.max(bot.speed, tmpVecB.length()), 150, 560);
  tmpVecB.normalize().multiplyScalar(bounceSpeed);
  const inwardSpeed = tmpVecB.dot(inwardNormal);
  if (inwardSpeed < bounceSpeed * 0.6) tmpVecB.addScaledVector(inwardNormal, bounceSpeed * 0.6 - inwardSpeed);

  bot.wallFaceId = faceId || bot.wallFaceId;
  bot.wallUnsafeHoldTimer = 0;
  bot.wallReturnSide = pickWallReturnSide(bot, inwardNormal);
  getBotWallReturnAnchor(bot, bot.wallReturnAnchor);
  if (bot.wallReturnAnchor.lengthSq() > 1e-4) {
    tmpVecC.copy(bot.wallReturnAnchor).sub(bot.mesh.position);
    if (tmpVecC.lengthSq() > 1e-4) tmpVecB.lerp(tmpVecC.normalize().multiplyScalar(bounceSpeed), 0.25);
  }

  tmpVecB.y = Math.max(tmpVecB.y, 18);
  bot.velocity.copy(tmpVecB.normalize().multiplyScalar(bounceSpeed));
  bot.speed = bounceSpeed;
  snapBotTowardDirection(bot, bot.velocity);
  bot.roll = 0;
  bot.wallEscapeDir.copy(bot.velocity).normalize();
  bot.wallRecoverTimer = Math.max(bot.wallRecoverTimer || 0, 0.46);
  bot.wallContactCooldown = Math.max(bot.wallContactCooldown || 0, 0.34);
  botWallTurnPlan.wallNormal.copy(inwardNormal);
  botWallTurnPlan.faceId = bot.wallFaceId;
  enterBotWallReturn(bot, "hit", botWallTurnPlan, BOT_WALL_RETURN_MAX_TIME);
  setBotMode(bot, BOT_MODE_WALL_RETURN);
}

const worldGeometryCache = new Map();
const worldPatternTextureCache = new Map();
const FOREST_TRUNK_TAPER_BUCKETS = Object.freeze([0.48, 0.58, 0.68, 0.78]);
const CITY_ANTENNA_TAPER_BUCKETS = Object.freeze([0.65, 0.85, 1.05, 1.25, 1.45]);

function getClosestBucket(value, buckets) {
  let closest = buckets[0];
  let bestDelta = Infinity;
  for (const bucket of buckets) {
    const delta = Math.abs(bucket - value);
    if (delta < bestDelta) {
      bestDelta = delta;
      closest = bucket;
    }
  }
  return closest;
}

function getSharedWorldGeometry(key, factory) {
  if (!worldGeometryCache.has(key)) {
    const geometry = factory();
    geometry.userData = {
      ...(geometry.userData || {}),
      sharedWorldGeometry: true,
    };
    worldGeometryCache.set(key, geometry);
  }
  return worldGeometryCache.get(key);
}

function getSharedWorldPatternTexture(key, factory) {
  if (!worldPatternTextureCache.has(key)) {
    const texture = factory();
    texture.userData = {
      ...(texture.userData || {}),
      sharedWorldPatternTexture: true,
    };
    worldPatternTextureCache.set(key, texture);
  }
  return worldPatternTextureCache.get(key);
}

function createCanvasPatternTexture(key, width, height, drawPattern) {
  return getSharedWorldPatternTexture(key, () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const texture = new THREE.Texture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    ctx.clearRect(0, 0, width, height);
    drawPattern(ctx, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  });
}

function getCityFacadeTexture(variant = "grid") {
  return createCanvasPatternTexture("cityFacade:" + variant, 128, 128, (ctx, width, height) => {
    const windowFill = "rgba(255,255,255,0.82)";
    const warmFill = "rgba(255,246,228,0.78)";
    const coolFill = "rgba(214,235,255,0.74)";

    if (variant === "bands") {
      for (let row = 0; row < 9; row++) {
        const top = 10 + row * 13;
        const lit = row % 3 !== 1;
        ctx.fillStyle = lit ? (row % 4 === 0 ? warmFill : coolFill) : "rgba(255,255,255,0.18)";
        ctx.fillRect(8, top, width - 16, 7);
        for (let x = 18; x < width - 14; x += 18) {
          ctx.clearRect(x, top, 4, 7);
        }
      }
      return;
    }

    if (variant === "slits") {
      for (let col = 0; col < 7; col++) {
        const left = 11 + col * 16;
        const lit = col % 3 !== 0;
        ctx.fillStyle = lit ? (col % 2 === 0 ? coolFill : warmFill) : "rgba(255,255,255,0.16)";
        ctx.fillRect(left, 8, 7, height - 16);
        for (let y = 18; y < height - 14; y += 18) {
          ctx.clearRect(left, y, 7, 5);
        }
      }
      return;
    }

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 6; col++) {
        if ((row * 5 + col * 3) % 7 === 0) continue;
        const left = 10 + col * 18;
        const top = 10 + row * 14;
        ctx.fillStyle = row < 2
          ? warmFill
          : ((row + col) % 4 === 0 ? coolFill : windowFill);
        ctx.fillRect(left, top, 11, 8);
      }
    }
  });
}

function getGrassClusterTexture() {
  return createCanvasPatternTexture("forestGrassCluster", 96, 96, (ctx, width, height) => {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const blades = [
      { x: 18, sway: -10, top: 16, width: 6, alpha: 0.9 },
      { x: 32, sway: -4, top: 10, width: 7, alpha: 0.94 },
      { x: 46, sway: 2, top: 7, width: 8, alpha: 0.98 },
      { x: 60, sway: 8, top: 12, width: 7, alpha: 0.9 },
      { x: 76, sway: 14, top: 20, width: 5, alpha: 0.82 },
    ];

    for (const blade of blades) {
      ctx.strokeStyle = `rgba(255,255,255,${blade.alpha})`;
      ctx.lineWidth = blade.width;
      ctx.beginPath();
      ctx.moveTo(blade.x, height - 4);
      ctx.quadraticCurveTo(blade.x + blade.sway * 0.35, height * 0.56, blade.x + blade.sway, blade.top);
      ctx.stroke();
    }
  });
}

function getSharedUnitSphereGeometry(key, widthSegments = 12, heightSegments = 10) {
  return getSharedWorldGeometry("sphere:" + key + ":" + widthSegments + ":" + heightSegments, () => new THREE.SphereGeometry(1, widthSegments, heightSegments));
}

function getSharedUnitPlaneGeometry(key) {
  return getSharedWorldGeometry("plane:" + key, () => new THREE.PlaneGeometry(1, 1));
}

function getSharedUnitBoxGeometry(key) {
  return getSharedWorldGeometry("box:" + key, () => new THREE.BoxGeometry(1, 1, 1));
}

function getSharedUnitDodecahedronGeometry(key) {
  return getSharedWorldGeometry("dodecahedron:" + key, () => new THREE.DodecahedronGeometry(1, 0));
}

function getSharedUnitConeGeometry(key, radialSegments = 9) {
  return getSharedWorldGeometry("cone:" + key + ":" + radialSegments, () => new THREE.ConeGeometry(1, 1, radialSegments));
}

function getSharedTaperedCylinderGeometry(keyPrefix, taperRatio, radialSegments = 8, buckets = FOREST_TRUNK_TAPER_BUCKETS) {
  const bucket = getClosestBucket(taperRatio, buckets);
  return getSharedWorldGeometry(
    "cylinder:" + keyPrefix + ":" + bucket.toFixed(2) + ":" + radialSegments,
    () => new THREE.CylinderGeometry(bucket, 1, 1, radialSegments)
  );
}

function buildArenaBoundary() {
  const points = [
    new THREE.Vector3(-ARENA, FLOOR_Y + 60, -ARENA),
    new THREE.Vector3(ARENA, FLOOR_Y + 60, -ARENA),
    new THREE.Vector3(ARENA, FLOOR_Y + 60, ARENA),
    new THREE.Vector3(-ARENA, FLOOR_Y + 60, ARENA),
    new THREE.Vector3(-ARENA, FLOOR_Y + 60, -ARENA),
  ];
  const line = new THREE.Line(
    getSharedWorldGeometry("arenaBoundaryLine", () => new THREE.BufferGeometry().setFromPoints(points)),
    new THREE.LineBasicMaterial({ color: 0x9ed6ff, transparent: true, opacity: 0.45 })
  );
  world.add(line);
}

function getSharedSkyDomeGeometry(key, topColor, horizonColor, nadirColor) {
  return getSharedWorldGeometry("skyDome:" + key, () => {
    const geometry = new THREE.SphereGeometry(1, 28, 18);
    const position = geometry.attributes.position;
    const colors = new Float32Array(position.count * 3);
    const top = new THREE.Color(topColor);
    const horizon = new THREE.Color(horizonColor);
    const nadir = new THREE.Color(nadirColor);
    const sample = new THREE.Color();

    for (let i = 0; i < position.count; i++) {
      const t = clamp((position.getY(i) + 1) * 0.5, 0, 1);
      if (t >= 0.58) {
        sample.copy(horizon).lerp(top, (t - 0.58) / 0.42);
      } else {
        sample.copy(nadir).lerp(horizon, t / 0.58);
      }
      const base = i * 3;
      colors[base] = sample.r;
      colors[base + 1] = sample.g;
      colors[base + 2] = sample.b;
    }

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  });
}

function buildHazeRing(color, opacity, y, radius, width, height, segments = 10) {
  const planeGeometry = getSharedUnitPlaneGeometry("backdropHazePlane");
  const hazeMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const panel = new THREE.Mesh(planeGeometry, hazeMaterial);
    panel.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    panel.scale.set(width, height, 1);
    panel.lookAt(0, y, 0);
    world.add(trackBackdropMesh(panel));
  }
}

function buildSkyBackdrop(mapType) {
  const isForest = mapType === "forest";
  const palette = isForest
    ? {
      key: "forest",
      top: 0x88adb8,
      horizon: 0xd4e0d4,
      nadir: 0x456754,
      haze: 0xcfe0d5,
      hazeOpacity: 0.055,
      sun: 0xe3ead4,
      sunOpacity: 0.5,
      halo: 0xd0e1d8,
      haloOpacity: 0.065,
    }
    : {
      key: "city",
      top: 0x5ea7ff,
      horizon: 0xcae6ff,
      nadir: 0x2957ba,
      haze: 0x8fc0f6,
      hazeOpacity: 0.012,
      sun: 0xf4fbff,
      sunOpacity: 0.24,
      halo: 0xaed5ff,
      haloOpacity: 0.018,
    };

  const sky = new THREE.Mesh(
    getSharedSkyDomeGeometry(palette.key, palette.top, palette.horizon, palette.nadir),
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  sky.position.set(0, FLOOR_Y + 1180, 0);
  sky.scale.setScalar(7200);
  world.add(trackBackdropMesh(sky));

  buildHazeRing(palette.haze, palette.hazeOpacity, FLOOR_Y + (isForest ? 540 : 620), ARENA * 1.55, 2400, isForest ? 720 : 840, isForest ? 9 : 10);

  const sun = new THREE.Mesh(
    getSharedUnitSphereGeometry("backdropSun", 18, 14),
    new THREE.MeshBasicMaterial({
      color: palette.sun,
      transparent: true,
      opacity: palette.sunOpacity,
      depthWrite: false,
      fog: false,
    })
  );
  sun.position.set(isForest ? -2000 : -1600, isForest ? 1760 : 1900, isForest ? -2550 : -3000);
  sun.scale.setScalar(isForest ? 120 : 144);
  world.add(sun);

  const halo = new THREE.Mesh(
    getSharedUnitSphereGeometry("backdropSunHalo", 18, 14),
    new THREE.MeshBasicMaterial({
      color: palette.halo,
      transparent: true,
      opacity: palette.haloOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  halo.position.copy(sun.position);
  halo.scale.setScalar(isForest ? 320 : 380);
  world.add(halo);
}

function buildCityBackdrop(unitBoxGeometry) {
  const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x4d6176, transparent: true, opacity: 0.86 });
  const towerMaterial = new THREE.MeshBasicMaterial({ color: 0x748aa1, transparent: true, opacity: 0.68 });
  const baseCount = isMobile ? 12 : 24;
  const towerCount = isMobile ? 4 : 10;

  for (let i = 0; i < baseCount; i++) {
    const angle = (i / baseCount) * Math.PI * 2 + rand(-0.08, 0.08);
    const radius = ARENA * 1.46 + rand(-140, 180);
    const width = rand(160, 340);
    const depth = rand(120, 240);
    const height = rand(180, 380);
    const block = new THREE.Mesh(unitBoxGeometry, baseMaterial);
    block.scale.set(width, height, depth);
    block.position.set(Math.cos(angle) * radius, FLOOR_Y + height / 2, Math.sin(angle) * radius);
    block.rotation.y = angle + Math.PI * 0.5 + rand(-0.14, 0.14);
    world.add(block);
  }

  for (let i = 0; i < towerCount; i++) {
    const angle = (i / towerCount) * Math.PI * 2 + rand(-0.12, 0.12);
    const radius = ARENA * 1.36 + rand(-120, 140);
    const width = rand(90, 180);
    const depth = rand(90, 180);
    const height = rand(320, 620);
    const tower = new THREE.Mesh(unitBoxGeometry, towerMaterial);
    tower.scale.set(width, height, depth);
    tower.position.set(Math.cos(angle) * radius, FLOOR_Y + height / 2, Math.sin(angle) * radius);
    tower.rotation.y = angle + Math.PI * 0.5 + rand(-0.2, 0.2);
    world.add(tower);
  }
}

function buildForestBackdrop(hillGeometry) {
  const nearMaterial = new THREE.MeshBasicMaterial({ color: 0x566d58, transparent: true, opacity: 0.96 });
  const farMaterial = new THREE.MeshBasicMaterial({ color: 0x738672, transparent: true, opacity: 0.78 });
  const nearCount = isMobile ? 10 : 18;
  const farCount = isMobile ? 6 : 12;

  for (let i = 0; i < nearCount; i++) {
    const angle = (i / nearCount) * Math.PI * 2 + rand(-0.08, 0.08);
    const radius = ARENA * 1.42 + rand(-120, 180);
    const width = rand(300, 760);
    const depth = width * rand(1.0, 1.45);
    const height = width * rand(0.14, 0.28);
    const ridge = new THREE.Mesh(hillGeometry, nearMaterial);
    ridge.scale.set(width, height, depth);
    ridge.position.set(Math.cos(angle) * radius, FLOOR_Y + rand(70, 130), Math.sin(angle) * radius);
    world.add(ridge);
  }

  for (let i = 0; i < farCount; i++) {
    const angle = (i / farCount) * Math.PI * 2 + rand(-0.1, 0.1);
    const radius = ARENA * 1.62 + rand(-140, 220);
    const width = rand(480, 980);
    const depth = width * rand(1.1, 1.55);
    const height = width * rand(0.12, 0.24);
    const ridge = new THREE.Mesh(hillGeometry, farMaterial);
    ridge.scale.set(width, height, depth);
    ridge.position.set(Math.cos(angle) * radius, FLOOR_Y + rand(130, 220), Math.sin(angle) * radius);
    world.add(ridge);
  }
}

function createGrassCluster(grassPlaneGeometry, grassMaterials, size = 18, planeCount = 2) {
  const cluster = new THREE.Group();
  const chosenPlanes = Math.max(2, planeCount | 0);

  for (let i = 0; i < chosenPlanes; i++) {
    const blade = new THREE.Mesh(
      grassPlaneGeometry,
      grassMaterials[(Math.random() * grassMaterials.length) | 0]
    );
    const width = size * rand(0.34, 0.58);
    const height = size * rand(0.95, 1.45);
    blade.position.y = height * 0.5;
    blade.scale.set(width, height, 1);
    blade.rotation.y = (Math.PI / chosenPlanes) * i + rand(-0.24, 0.24);
    blade.rotation.z = rand(-0.08, 0.08);
    cluster.add(blade);
  }

  return cluster;
}
function disposeWorldNodes() {
  const geometries = new Set();
  const materials = new Set();

  world.children.forEach((node) => {
    node.traverse((child) => {
      if (child.geometry && !child.geometry.userData?.sharedWorldGeometry) geometries.add(child.geometry);
      if (Array.isArray(child.material)) child.material.forEach((mat) => mat && materials.add(mat));
      else if (child.material) materials.add(child.material);
    });
  });

  world.clear();
  geometries.forEach((geometry) => geometry?.dispose?.());
  materials.forEach((material) => material?.dispose?.());
  staticObstacles.length = 0;
  staticObstacleMeshes.length = 0;
  backdropFollowers.length = 0;
}

function buildWorld(mapType) {
  disposeWorldNodes();

  const worldTextures = getWorldTextureSet(mapType);
  const groundPlaneGeometry = getSharedUnitPlaneGeometry("worldGroundPlane");
  const cloudGeometry = getSharedUnitSphereGeometry("cloudSphere", 12, 10);
  const cirrusGeometry = getSharedUnitPlaneGeometry("cirrusBandPlane");
  const hillGeometry = getSharedUnitSphereGeometry("forestHillSphere", 16, 12);
  const rockGeometry = getSharedUnitDodecahedronGeometry("forestRockDodecahedron");
  const shrubGeometry = getSharedUnitSphereGeometry("forestShrubSphere", 10, 8);
  const crownGeometry = getSharedUnitConeGeometry("forestTreeCrown", 9);
  const unitBoxGeometry = getSharedUnitBoxGeometry("worldUnitBox");
  const grassPlaneGeometry = getSharedUnitPlaneGeometry("forestGrassBladePlane");

  const isForest = mapType === "forest";
  const skyColor = isForest ? 0x97ba9e : 0x8d9db6;
  scene.background = new THREE.Color(skyColor);
  scene.fog = isForest
    ? new THREE.FogExp2(skyColor, 0.000095)
    : new THREE.FogExp2(skyColor, 0.00007);

  buildSkyBackdrop(mapType);
  if (isForest) buildForestBackdrop(hillGeometry);
  else buildCityBackdrop(unitBoxGeometry);
  buildArenaBoundary();

  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xf4fbff,
    transparent: true,
    opacity: isForest ? 0.2 : 0.27,
    depthWrite: false,
    fog: false,
  });
  for (let i = 0; i < worldDetail.clouds; i++) {
    const cloudRadius = rand(26, 68);
    const cloud = new THREE.Mesh(cloudGeometry, cloudMat);
    cloud.scale.set(cloudRadius * rand(2.5, 5.3), cloudRadius * rand(0.38, 0.72), cloudRadius * rand(1.4, 3.0));
    cloud.position.set(rand(-ARENA * 1.2, ARENA * 1.2), rand(980, 1680), rand(-ARENA * 1.2, ARENA * 1.2));
    world.add(cloud);
  }

  const cirrusMat = new THREE.MeshBasicMaterial({
    color: isForest ? 0xe9f6ef : 0xeef6ff,
    transparent: true,
    opacity: isForest ? 0.1 : 0.14,
    depthWrite: false,
    fog: false,
  });
  for (let i = 0; i < worldDetail.cloudBands; i++) {
    const band = new THREE.Mesh(cirrusGeometry, cirrusMat);
    band.scale.set(rand(420, 860), rand(58, 120), 1);
    band.rotation.x = -Math.PI / 2;
    band.rotation.z = rand(-0.45, 0.45);
    band.position.set(rand(-ARENA * 1.25, ARENA * 1.25), rand(1240, 1900), rand(-ARENA * 1.25, ARENA * 1.25));
    world.add(band);
  }

  if (isForest) {
    const hillAnchors = [];
    const grassAnchors = [];
    const ground = new THREE.Mesh(
      groundPlaneGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x5f8550,
        map: worldTextures.forestGroundColor,
        normalMap: worldTextures.forestGroundNormal,
        roughnessMap: worldTextures.forestGroundRoughness,
        roughness: 0.96,
        metalness: 0.02,
      })
    );
    ground.scale.set(ARENA * 3.2, ARENA * 3.2, 1);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_Y;
    ground.receiveShadow = true;
    world.add(ground);

    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x6e9561,
      map: worldTextures.forestGroundColor,
      normalMap: worldTextures.forestGroundNormal,
      roughnessMap: worldTextures.forestGroundRoughness,
      roughness: 0.94,
      metalness: 0.03,
    });
    for (let i = 0; i < worldDetail.hills; i++) {
      const hillRadius = rand(90, 260);
      const hill = new THREE.Mesh(hillGeometry, hillMat);
      hill.scale.set(hillRadius, hillRadius * rand(0.24, 0.55), hillRadius);
      hill.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(8, 32), rand(-ARENA * 1.2, ARENA * 1.2));
      hill.receiveShadow = true;
      world.add(hill);
      hillAnchors.push({ x: hill.position.x, z: hill.position.z, radius: hillRadius * 0.45 });
      grassAnchors.push({ x: hill.position.x, z: hill.position.z, radius: hillRadius * 0.34 });
    }

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x8f9792,
      map: worldTextures.rockColor,
      normalMap: worldTextures.rockNormal,
      roughnessMap: worldTextures.rockRoughness,
      roughness: 0.92,
      metalness: 0.04,
    });
    for (let i = 0; i < worldDetail.forestRocks; i++) {
      const rockRadius = rand(8, 26);
      const rock = new THREE.Mesh(rockGeometry, rockMat);
      rock.scale.set(rockRadius, rockRadius * rand(0.45, 1.0), rockRadius);
      rock.rotation.set(rand(-0.3, 0.3), rand(0, Math.PI), rand(-0.2, 0.2));
      rock.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(4, 15), rand(-ARENA * 1.2, ARENA * 1.2));
      rock.castShadow = true;
      rock.receiveShadow = true;
      world.add(rock);
      addObstacle(rock, 2);
    }

    const shrubMaterials = [
      new THREE.MeshStandardMaterial({ color: 0x567a48, roughness: 0.94 }),
      new THREE.MeshStandardMaterial({ color: 0x628653, roughness: 0.95 }),
      new THREE.MeshStandardMaterial({ color: 0x496d3d, roughness: 0.93 }),
    ];
    for (let i = 0; i < worldDetail.forestShrubs; i++) {
      const shrubRadius = rand(10, 24);
      const shrub = new THREE.Mesh(
        shrubGeometry,
        shrubMaterials[(Math.random() * shrubMaterials.length) | 0]
      );
      shrub.scale.set(shrubRadius, shrubRadius * rand(0.3, 0.7), shrubRadius);
      shrub.position.set(rand(-ARENA * 1.2, ARENA * 1.2), FLOOR_Y + rand(4, 10), rand(-ARENA * 1.2, ARENA * 1.2));
      shrub.receiveShadow = true;
      world.add(shrub);
      if (Math.random() > 0.28) grassAnchors.push({ x: shrub.position.x, z: shrub.position.z, radius: shrubRadius * 2.1 });
    }

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x7d5c3f,
      map: worldTextures.trunkColor,
      normalMap: worldTextures.trunkNormal,
      roughnessMap: worldTextures.trunkRoughness,
      roughness: 0.9,
      metalness: 0.05,
    });
    const leafPalette = [0x2f6f3b, 0x3e8048, 0x4f9259, 0x2d5d37];
    const leafMaterials = leafPalette.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
    const forestCenters = Array.from({ length: worldDetail.forestCenters }, () => new THREE.Vector2(rand(-ARENA * 0.95, ARENA * 0.95), rand(-ARENA * 0.95, ARENA * 0.95)));
    const giantTreeProbe = new THREE.Vector3();
    const titanDenseChance = isMobile ? 0.013 : 0.0195;
    const titanSparseChance = isMobile ? 0.0045 : 0.007;
    const massiveDenseChance = isMobile ? 0.006 : 0.0085;
    const massiveSparseChance = isMobile ? 0.003 : 0.0055;
    const pickTrunkProfile = (dense, treeScale = "normal") => {
      const roll = Math.random();
      if (treeScale === "titan") {
        if (dense) {
          if (roll < 0.28) return { top: [42, 58], base: [68, 92] };
          if (roll < 0.78) return { top: [56, 78], base: [92, 126] };
          return { top: [74, 102], base: [122, 166] };
        }
        if (roll < 0.3) return { top: [38, 52], base: [60, 84] };
        if (roll < 0.78) return { top: [50, 70], base: [82, 116] };
        return { top: [68, 94], base: [108, 150] };
      }
      if (treeScale === "massive") {
        if (dense) {
          if (roll < 0.28) return { top: [24, 32], base: [38, 52] };
          if (roll < 0.78) return { top: [30, 44], base: [48, 70] };
          return { top: [40, 58], base: [64, 92] };
        }
        if (roll < 0.3) return { top: [20, 28], base: [30, 42] };
        if (roll < 0.78) return { top: [26, 38], base: [42, 60] };
        return { top: [36, 52], base: [58, 80] };
      }
      if (dense) {
        if (roll < 0.2) return { top: [3.2, 4.8], base: [4.6, 6.8] };
        if (roll < 0.75) return { top: [4.3, 6.6], base: [6.4, 9.2] };
        return { top: [5.8, 8.8], base: [8.4, 12.2] };
      }
      if (roll < 0.25) return { top: [2.6, 3.8], base: [3.6, 5.2] };
      if (roll < 0.75) return { top: [3.5, 5.3], base: [5.0, 7.5] };
      return { top: [4.8, 7.0], base: [6.8, 10.0] };
    };

    const placeTree = (px, pz, dense = false) => {
      if (Math.abs(px) < 160 && Math.abs(pz) < 160) return;
      let treeScale = "normal";
      if (!(Math.abs(px) < 300 && Math.abs(pz) < 300)) {
        if (Math.random() < (dense ? titanDenseChance : titanSparseChance)) treeScale = "titan";
        else if (Math.random() < (dense ? massiveDenseChance : massiveSparseChance)) treeScale = "massive";
        if (treeScale !== "normal") {
          giantTreeProbe.set(px, FLOOR_Y + 24, pz);
          const giantProbeRadius = treeScale === "titan"
            ? (dense ? 138 : 116)
            : (dense ? 98 : 84);
          if (intersectsObstacle(giantTreeProbe, giantProbeRadius)) treeScale = "normal";
        }
      }

      const h = treeScale === "titan"
        ? (dense ? rand(520, 980) : rand(440, 840))
        : treeScale === "massive"
          ? (dense ? rand(340, 680) : rand(280, 560))
          : (dense ? rand(110, 280) : rand(75, 190));
      const trunkProfile = pickTrunkProfile(dense, treeScale);
      const trunkTopRadius = rand(trunkProfile.top[0], trunkProfile.top[1]);
      const trunkBaseRadius = rand(trunkProfile.base[0], trunkProfile.base[1]);
      const trunk = new THREE.Mesh(
        getSharedTaperedCylinderGeometry("forestTreeTrunk", trunkTopRadius / trunkBaseRadius, 8, FOREST_TRUNK_TAPER_BUCKETS),
        trunkMat
      );
      trunk.scale.set(trunkBaseRadius, h, trunkBaseRadius);
      trunk.position.set(px, FLOOR_Y + h / 2, pz);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      world.add(trunk);
      addObstacle(trunk, treeScale === "titan" ? 28 : treeScale === "massive" ? 18 : 5);

      const crownRadius = treeScale === "titan"
        ? (dense ? rand(150, 260) : rand(128, 220))
        : treeScale === "massive"
          ? (dense ? rand(100, 180) : rand(86, 150))
          : (dense ? rand(30, 56) : rand(20, 38));
      const crownHeight = treeScale === "titan"
        ? (dense ? rand(290, 520) : rand(250, 430))
        : treeScale === "massive"
          ? (dense ? rand(180, 340) : rand(150, 280))
          : (dense ? rand(80, 150) : rand(52, 100));
      const crown = new THREE.Mesh(
        crownGeometry,
        leafMaterials[(Math.random() * leafMaterials.length) | 0]
      );
      crown.scale.set(crownRadius, crownHeight, crownRadius);
      crown.position.set(px, FLOOR_Y + h + crownHeight * 0.42, pz);
      crown.castShadow = true;
      crown.receiveShadow = true;
      world.add(crown);
      addObstacle(crown, treeScale === "titan" ? 16 : treeScale === "massive" ? 10 : 2);
      if (dense || Math.random() > 0.38) {
        grassAnchors.push({
          x: px,
          z: pz,
          radius: treeScale === "titan"
            ? (dense ? 154 : 126)
            : treeScale === "massive"
              ? (dense ? 108 : 86)
              : (dense ? 52 : 36)
        });
      }
    };

    for (const center of forestCenters) {
      for (let i = 0; i < worldDetail.forestDenseTrees; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = rand(0, 260) * Math.sqrt(Math.random());
        placeTree(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, true);
      }
    }

    for (let i = 0; i < worldDetail.forestSparseTrees; i++) {
      placeTree(rand(-ARENA * 1.2, ARENA * 1.2), rand(-ARENA * 1.2, ARENA * 1.2), false);
    }

    const grassMaterials = [
      new THREE.MeshBasicMaterial({
        color: 0x6e9957,
        map: getGrassClusterTexture(),
        transparent: true,
        opacity: 0.9,
        alphaTest: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      new THREE.MeshBasicMaterial({
        color: 0x7cae63,
        map: getGrassClusterTexture(),
        transparent: true,
        opacity: 0.82,
        alphaTest: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    ];
    const grassProbePoint = new THREE.Vector3();
    const placeGrassCluster = (px, pz, dense = false) => {
      if (Math.abs(px) < 190 && Math.abs(pz) < 190) return false;
      grassProbePoint.set(px, FLOOR_Y + 6, pz);
      if (intersectsObstacle(grassProbePoint, dense ? 3.5 : 2.2)) return false;
      const cluster = createGrassCluster(
        grassPlaneGeometry,
        grassMaterials,
        dense ? rand(18, 30) : rand(12, 22),
        isMobile ? 2 : (dense ? 3 : 2)
      );
      cluster.position.set(px, FLOOR_Y + rand(0.4, 1.6), pz);
      cluster.rotation.y = rand(0, Math.PI);
      world.add(cluster);
      return true;
    };

    let placedGrass = 0;
    let grassAttempts = 0;
    const maxGrassAttempts = worldDetail.forestGrassClusters * 6;
    while (placedGrass < worldDetail.forestGrassClusters && grassAttempts < maxGrassAttempts) {
      grassAttempts += 1;
      let px;
      let pz;
      let dense = false;
      if (grassAnchors.length > 0 && Math.random() > 0.16) {
        const anchor = grassAnchors[(Math.random() * grassAnchors.length) | 0];
        const radius = anchor.radius * rand(0.45, 1.2);
        const angle = Math.random() * Math.PI * 2;
        px = anchor.x + Math.cos(angle) * radius;
        pz = anchor.z + Math.sin(angle) * radius;
        dense = radius < 44 || Math.random() > 0.58;
      } else if (hillAnchors.length > 0 && Math.random() > 0.45) {
        const hill = hillAnchors[(Math.random() * hillAnchors.length) | 0];
        const radius = hill.radius * rand(0.35, 1.0);
        const angle = Math.random() * Math.PI * 2;
        px = hill.x + Math.cos(angle) * radius;
        pz = hill.z + Math.sin(angle) * radius;
      } else {
        px = rand(-ARENA * 1.12, ARENA * 1.12);
        pz = rand(-ARENA * 1.12, ARENA * 1.12);
      }

      if (placeGrassCluster(px, pz, dense)) placedGrass += 1;
    }
    return;
  }

  const ground = new THREE.Mesh(
    groundPlaneGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x89909a,
      map: worldTextures.cityGroundColor,
      normalMap: worldTextures.cityGroundNormal,
      roughnessMap: worldTextures.cityGroundRoughness,
      roughness: 0.92,
      metalness: 0.08,
    })
  );
  ground.scale.set(ARENA * 3.2, ARENA * 3.2, 1);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y;
  ground.receiveShadow = true;
  world.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x40464e,
    map: worldTextures.cityRoadColor,
    normalMap: worldTextures.cityRoadNormal,
    roughnessMap: worldTextures.cityRoadRoughness,
    roughness: 0.86,
    metalness: 0.08,
  });
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xa8aeb6, roughness: 0.85 });
  for (let i = -8; i <= 8; i++) {
    const roadX = new THREE.Mesh(unitBoxGeometry, roadMat);
    roadX.scale.set(ARENA * 2.7, 0.2, 42);
    roadX.position.set(0, FLOOR_Y + 0.1, i * 430);
    roadX.receiveShadow = true;
    world.add(roadX);

    const roadZ = new THREE.Mesh(unitBoxGeometry, roadMat);
    roadZ.scale.set(42, 0.2, ARENA * 2.7);
    roadZ.position.set(i * 430, FLOOR_Y + 0.1, 0);
    roadZ.receiveShadow = true;
    world.add(roadZ);

    const laneX = new THREE.Mesh(unitBoxGeometry, laneMat);
    laneX.scale.set(ARENA * 2.7, 0.22, 4);
    laneX.position.set(0, FLOOR_Y + 0.14, i * 430);
    world.add(laneX);

    const laneZ = new THREE.Mesh(unitBoxGeometry, laneMat);
    laneZ.scale.set(4, 0.22, ARENA * 2.7);
    laneZ.position.set(i * 430, FLOOR_Y + 0.14, 0);
    world.add(laneZ);
  }

  const buildingPalette = [0x7f8b98, 0x8e97a5, 0x646f7d, 0x5a6370, 0x9ba4b4];
  const cityTowerMaterials = new Map();
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xcad2dd, roughness: 0.65 });
  const antennaMat = new THREE.MeshStandardMaterial({ color: 0xb9c4d1, roughness: 0.48, metalness: 0.5 });
  const cityWindowBandMaterials = [
    new THREE.MeshBasicMaterial({ color: 0xcde6ff, transparent: true, opacity: 0.16 }),
    new THREE.MeshBasicMaterial({ color: 0xdce9ff, transparent: true, opacity: 0.22 }),
  ];
  const cityFacadeMaterials = [
    new THREE.MeshBasicMaterial({
      color: 0xdcecff,
      map: getCityFacadeTexture("grid"),
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      toneMapped: false,
    }),
    new THREE.MeshBasicMaterial({
      color: 0xe8f3ff,
      map: getCityFacadeTexture("bands"),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      toneMapped: false,
    }),
    new THREE.MeshBasicMaterial({
      color: 0xc7deff,
      map: getCityFacadeTexture("slits"),
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      toneMapped: false,
    }),
  ];
  const citySparseZones = [
    { x: ARENA * 0.45, z: ARENA * 0.24, radius: 430, keepChance: 0.7 },
    { x: -ARENA * 0.4, z: -ARENA * 0.3, radius: 520, keepChance: 0.7 },
    { x: ARENA * 0.2, z: -ARENA * 0.47, radius: 460, keepChance: 0.7 },
  ];

  const getCityTowerMaterial = (baseColor) => {
    const key = String(baseColor);
    if (!cityTowerMaterials.has(key)) {
      cityTowerMaterials.set(key, new THREE.MeshStandardMaterial({
        color: new THREE.Color(baseColor).lerp(new THREE.Color(0xbcc5ce), 0.2),
        map: worldTextures.cityBuildingColor,
        normalMap: worldTextures.cityBuildingNormal,
        roughnessMap: worldTextures.cityBuildingRoughness,
        roughness: 0.72,
        metalness: 0.12,
      }));
    }
    return cityTowerMaterials.get(key);
  };

  for (let i = 0; i < worldDetail.cityBuildings; i++) {
    const px = rand(-ARENA * 1.15, ARENA * 1.15);
    const pz = rand(-ARENA * 1.15, ARENA * 1.15);
    if (Math.abs(px) < 260 && Math.abs(pz) < 260) continue;
    const inCentralLane =
      (Math.abs(px) < 240 && Math.abs(pz) < 1500) ||
      (Math.abs(pz) < 240 && Math.abs(px) < 1500);
    if (inCentralLane && Math.random() > 0.4) continue;
    const sparseZone = citySparseZones.find(({ x, z, radius }) => (px - x) ** 2 + (pz - z) ** 2 < radius ** 2);
    if (sparseZone && Math.random() > sparseZone.keepChance) continue;

    const w = rand(45, 135);
    const d = rand(45, 135);
    const h = rand(90, 520);
    const baseColor = buildingPalette[(Math.random() * buildingPalette.length) | 0];

    const tower = new THREE.Mesh(
      unitBoxGeometry,
      getCityTowerMaterial(baseColor)
    );
    tower.scale.set(w, h, d);
    tower.position.set(px, FLOOR_Y + h / 2, pz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    world.add(tower);
    addObstacle(tower, 3);

    if (h >= worldDetail.cityFacadeMinHeight && Math.random() <= worldDetail.cityFacadeChance) {
      let facadeMaterial = cityFacadeMaterials[0];
      if (h < worldDetail.cityFacadeMinHeight * 1.22) facadeMaterial = cityFacadeMaterials[1];
      else if (Math.max(w, d) < 76 || Math.random() > 0.68) facadeMaterial = cityFacadeMaterials[2];
      const facade = new THREE.Mesh(unitBoxGeometry, facadeMaterial);
      const facadeInset = Math.max(2, Math.min(w, d) * 0.024);
      facade.scale.set(w + facadeInset, h + 2.4, d + facadeInset);
      facade.position.copy(tower.position);
      facade.renderOrder = 2;
      world.add(facade);
    }

    for (let j = 0; j < worldDetail.cityWindowBands; j++) {
      if (h < 140 && j > 0) continue;
      const bandHeight = rand(2.2, 4.6);
      const bandY = FLOOR_Y + h * rand(0.25, 0.86);
      const band = new THREE.Mesh(
        unitBoxGeometry,
        cityWindowBandMaterials[(Math.random() * cityWindowBandMaterials.length) | 0]
      );
      band.scale.set(w * 1.01, bandHeight, d * 1.01);
      band.position.set(px, bandY, pz);
      world.add(band);
    }

    if (Math.random() > 0.55) {
      const roofHeight = rand(12, 28);
      const roof = new THREE.Mesh(unitBoxGeometry, roofMat);
      roof.scale.set(w * 0.7, roofHeight, d * 0.7);
      roof.position.set(px, FLOOR_Y + h + roofHeight / 2, pz);
      roof.castShadow = true;
      world.add(roof);
      addObstacle(roof, 2);

      if (Math.random() > 0.5) {
        const antennaTopRadius = rand(0.6, 1.2);
        const antennaBaseRadius = rand(0.8, 1.4);
        const antennaHeight = rand(18, 42);
        const antenna = new THREE.Mesh(
          getSharedTaperedCylinderGeometry("cityAntenna", antennaTopRadius / antennaBaseRadius, 8, CITY_ANTENNA_TAPER_BUCKETS),
          antennaMat
        );
        antenna.scale.set(antennaBaseRadius, antennaHeight, antennaBaseRadius);
        antenna.position.set(
          px + rand(-w * 0.18, w * 0.18),
          FLOOR_Y + h + roofHeight + antennaHeight / 2,
          pz + rand(-d * 0.18, d * 0.18)
        );
        world.add(antenna);
      }
    }
  }
}

function createFighter(colorOrPalette, isPlayer = false) {
  const g = new THREE.Group();
  const fighterTextures = getFighterTextureSet();

  function buildSurface(points, thickness = 0.24) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1, curveSegments: 8 });
    geo.rotateX(Math.PI * 0.5);
    geo.translate(0, -thickness * 0.5, 0);
    return geo;
  }
  function buildVerticalSurface(points, thickness = 0.24) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1]);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    geo.translate(0, 0, -thickness * 0.5);
    return geo;
  }
  function mirrorPoints(points) {
    return points.map(([x, z]) => [x, -z]).reverse();
  }
  function taperWingThickness(geo, minScale = 0.48, power = 1.35) {
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    const maxSpan = Math.max(Math.abs(box.min.z), Math.abs(box.max.z), 0.001);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const y = pos.getY(i);
      const spanT = clamp(Math.abs(z) / maxSpan, 0, 1);
      const taper = 1 - (1 - minScale) * (spanT ** power);
      pos.setY(i, y * taper);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }
  const botBaseColor = new THREE.Color(typeof colorOrPalette === "number" ? colorOrPalette : 0x48d7ff);
  const playerPalette = {
    body: 0x0b0c10,
    wing: 0x1f4f9a,
    accent: 0xffa13a,
    cockpit: 0x0f1117,
  };
  const enemyPalette = {
    body: botBaseColor.clone().offsetHSL(0.02, 0.32, 0.24).getHex(),
    wing: botBaseColor.clone().offsetHSL(0.1, 0.55, 0.3).getHex(),
    accent: botBaseColor.clone().offsetHSL(-0.14, 0.45, 0.2).getHex(),
    cockpit: botBaseColor.clone().offsetHSL(-0.06, 0.2, 0.36).getHex(),
  };
  const palette = isPlayer
    ? playerPalette
    : (typeof colorOrPalette === "object" && colorOrPalette !== null ? colorOrPalette : enemyPalette);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: palette.body,
    map: fighterTextures.bodyColor,
    normalMap: fighterTextures.bodyNormal,
    roughnessMap: fighterTextures.bodyRoughness,
    metalnessMap: fighterTextures.bodyMetalness,
    normalScale: new THREE.Vector2(0.3, 0.3),
    roughness: 0.3,
    metalness: 0.72,
    clearcoat: 0.44,
    clearcoatRoughness: 0.24,
  });
  const wingMat = new THREE.MeshPhysicalMaterial({
    color: palette.wing,
    map: isPlayer ? fighterTextures.trimColor : null,
    normalMap: isPlayer ? fighterTextures.bodyNormal : null,
    roughnessMap: isPlayer ? fighterTextures.bodyRoughness : null,
    metalnessMap: isPlayer ? fighterTextures.bodyMetalness : null,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughness: isPlayer ? 0.3 : 0.22,
    metalness: isPlayer ? 0.76 : 0.68,
    clearcoat: 0.48,
    clearcoatRoughness: 0.24,
    emissive: isPlayer ? 0x000000 : new THREE.Color(palette.wing).multiplyScalar(0.18),
    emissiveIntensity: isPlayer ? 0 : 0.32,
  });
  const nozzleMetalMat = new THREE.MeshPhysicalMaterial({
    color: 0x5a1a22,
    roughnessMap: fighterTextures.bodyRoughness,
    normalMap: fighterTextures.bodyNormal,
    metalnessMap: fighterTextures.bodyMetalness,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughness: 0.3,
    metalness: 0.9,
    clearcoat: 0.24,
    clearcoatRoughness: 0.34,
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: palette.accent,
    roughnessMap: fighterTextures.trimRoughness,
    normalMap: fighterTextures.trimNormal,
    normalScale: new THREE.Vector2(0.16, 0.16),
    roughness: 0.22,
    metalness: 0.66,
    emissive: isPlayer ? 0x2b1200 : 0x000000,
    emissiveIntensity: isPlayer ? 0.32 : 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.22,
  });

  // Main axis body: extend only the forward side by +10% while keeping rear/wing-side relationship stable.
  const centerSpineLength = 24.6;
  const centerSpineForwardExtend = centerSpineLength * 0.1;
  const centerSpineGeo = new THREE.CylinderGeometry(2.14, 2.28, centerSpineLength + centerSpineForwardExtend, 30);
  // Keep the mesh position unchanged while shortening only the rear side (no front-side shift).
  centerSpineGeo.translate(0, 1.2, 0);
  const centerSpine = new THREE.Mesh(centerSpineGeo, bodyMat);
  centerSpine.rotation.z = -Math.PI * 0.5;
  centerSpine.position.set(-12.2 + centerSpineForwardExtend * 0.5, 0.72, 0);

  const forwardAxisShiftX = centerSpineForwardExtend;

  // Rebuild the front section from the wing-leading-edge area onward with a shorter reach.
  const forwardSpineTaper = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 2.04, 0.2, 28), bodyMat);
  forwardSpineTaper.rotation.z = -Math.PI * 0.5;
  // Make the front taper cross-section a vertically stretched ellipse.
  forwardSpineTaper.scale.set(1, 1.24, 0.78);
  forwardSpineTaper.position.set(2.6 + forwardAxisShiftX, 0.72, 0);

  // Add a little extra bulge on top of the forward taper.
  const forwardTaperTopBulge = new THREE.Mesh(new THREE.SphereGeometry(0.84, 20, 16), bodyMat);
  forwardTaperTopBulge.scale.set(3.4, 1.08, 1.1);
  forwardTaperTopBulge.position.set(5.3 + forwardAxisShiftX, 1.86, 0);

  // Slightly raised streamlined top profile near the cockpit shoulder.
  const dorsalFlowHump = new THREE.Mesh(new THREE.SphereGeometry(1.14, 22, 16), bodyMat);
  dorsalFlowHump.scale.set(4.15, 0.98, 1.24);
  dorsalFlowHump.position.set(4.1 + forwardAxisShiftX, 1.98, 0);

  const cockpitShoulderBulge = new THREE.Mesh(new THREE.SphereGeometry(0.96, 22, 16), bodyMat);
  cockpitShoulderBulge.scale.set(2.95, 1.14, 1.14);
  cockpitShoulderBulge.position.set(2.7 + forwardAxisShiftX, 2.1, 0);

  const upperSpineBlendBulge = new THREE.Mesh(new THREE.SphereGeometry(1.02, 22, 16), bodyMat);
  upperSpineBlendBulge.scale.set(3.2, 1.0, 1.16);
  upperSpineBlendBulge.position.set(1.2 + forwardAxisShiftX, 2.04, 0);

  // Rebuild cockpit/top/nose area from scratch with a slimmer silhouette.
  const cockpitBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.18, 9.8, 18),
    new THREE.MeshPhysicalMaterial({
      color: palette.cockpit,
      roughnessMap: fighterTextures.bodyRoughness,
      normalMap: fighterTextures.bodyNormal,
      normalScale: new THREE.Vector2(0.18, 0.18),
      roughness: 0.33,
      metalness: 0.7,
      clearcoat: 0.24,
      clearcoatRoughness: 0.26,
    })
  );
  cockpitBody.rotation.z = Math.PI * 0.5;
  cockpitBody.scale.set(1, 0.12, 0.14);
  cockpitBody.position.set(2.9 + forwardAxisShiftX, 1.08, 0);

  const cockpitFairing = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 6.8, 20), bodyMat);
  cockpitFairing.rotation.z = -Math.PI * 0.5;
  cockpitFairing.position.set(4.6 + forwardAxisShiftX, 1.18, 0);

  const cockpitBlend = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 5.4, 20), bodyMat);
  cockpitBlend.rotation.z = -Math.PI * 0.5;
  cockpitBlend.position.set(1.9 + forwardAxisShiftX, 1.05, 0);

  const dorsalDeck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 5.6, 18), bodyMat);
  dorsalDeck.rotation.z = -Math.PI * 0.5;
  dorsalDeck.position.set(3.2 + forwardAxisShiftX, 1.3, 0);


  const canopyGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x9cb6e9,
    emissive: 0x0e1d3c,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.7,
    roughness: 0.05,
    metalness: 0.01,
    transmission: 0.82,
    thickness: 0.44,
    ior: 1.36,
  });
  const cockpitGlass = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 18), canopyGlassMat);
  cockpitGlass.scale.set(3.81, 1.67, 1.2);
  cockpitGlass.position.set(2.9 + forwardAxisShiftX, 2.18, 0);

  const noseSection = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.52, 5.8, 24), bodyMat);
  noseSection.rotation.z = -Math.PI * 0.5;
  noseSection.position.set(10.25 + forwardAxisShiftX, 1.66, 0);

  const noseCone = new THREE.Mesh(new THREE.ConeGeometry(0.4, 4.6, 24), wingMat);
  noseCone.rotation.z = -Math.PI * 0.5;
  noseCone.scale.set(1, 0.34, 0.72);
  noseCone.position.set(14.35 + forwardAxisShiftX, 1.52, 0);

  const gunBarrelL = new THREE.Mesh(
    new THREE.CylinderGeometry(GUN_BARREL_RADIUS * 0.78, GUN_BARREL_RADIUS, GUN_BARREL_LENGTH, 12),
    nozzleMetalMat
  );
  gunBarrelL.rotation.z = -Math.PI * 0.5;
  gunBarrelL.position.copy(GUN_MUZZLE_LOCAL_LEFT).addScaledVector(AXIS_X, -GUN_BARREL_LENGTH * 0.5);
  gunBarrelL.position.y -= 0.015;

  const gunBarrelR = gunBarrelL.clone();
  gunBarrelR.position.copy(GUN_MUZZLE_LOCAL_RIGHT).addScaledVector(AXIS_X, -GUN_BARREL_LENGTH * 0.5);
  gunBarrelR.position.y -= 0.015;

  const gunBaseL = new THREE.Mesh(
    new THREE.CylinderGeometry(GUN_BARREL_RADIUS * 1.58, GUN_BARREL_RADIUS * 1.9, GUN_BARREL_LENGTH * 0.95, 12),
    bodyMat
  );
  gunBaseL.rotation.z = -Math.PI * 0.5;
  gunBaseL.position.copy(GUN_MUZZLE_LOCAL_LEFT).addScaledVector(AXIS_X, -GUN_BARREL_LENGTH * 1.42);
  gunBaseL.position.y -= 0.02;

  const gunBaseR = gunBaseL.clone();
  gunBaseR.position.copy(GUN_MUZZLE_LOCAL_RIGHT).addScaledVector(AXIS_X, -GUN_BARREL_LENGTH * 1.42);
  gunBaseR.position.y -= 0.02;

  // Main wing: even shorter fore-aft depth and moved further aft
  const mainWingPoints = [
    [8.6, 0.7],
    [-5.2, 18.8],
    [-10.6, 18.8],
    [-8.0, 0.7],
  ];
  const mainWingL = new THREE.Mesh(taperWingThickness(buildSurface(mainWingPoints, 1.92), 0.42, 1.45), wingMat);
  mainWingL.position.set(-10.7, 2.0, 0);
  mainWingL.rotation.x = 0;
  const mainWingR = new THREE.Mesh(taperWingThickness(buildSurface(mirrorPoints(mainWingPoints), 1.92), 0.42, 1.45), wingMat);
  mainWingR.position.copy(mainWingL.position);
  mainWingR.rotation.x = mainWingL.rotation.x;

  const rootStrakeL = new THREE.Mesh(
    taperWingThickness(buildSurface([[7.4, 0.35], [0.8, 5.9], [-2.6, 4.3], [0.4, 0.18]], 0.86), 0.66, 1.25),
    bodyMat
  );
  rootStrakeL.position.set(0.5 + forwardAxisShiftX, 1.28, 2.18);
  rootStrakeL.rotation.set(0.12, 0, -0.06);
  const rootStrakeR = rootStrakeL.clone();
  rootStrakeR.position.z *= -1;
  rootStrakeR.rotation.x *= -1;

  const intakeShellL = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.18, 4.1, 18), bodyMat);
  intakeShellL.rotation.set(0, 0, -Math.PI * 0.5);
  intakeShellL.scale.set(1, 0.66, 1.26);
  intakeShellL.position.set(4.9 + forwardAxisShiftX, 0.7, 2.28);
  const intakeInnerMat = new THREE.MeshStandardMaterial({ color: 0x232a31, roughness: 0.72, metalness: 0.24 });
  const intakeLipL = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.76, 22), nozzleMetalMat);
  intakeLipL.rotation.set(0, Math.PI * 0.5, 0);
  intakeLipL.position.set(7.06 + forwardAxisShiftX, 0.76, 2.28);
  const intakeInnerL = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 2.55, 16), intakeInnerMat);
  intakeInnerL.rotation.set(0, 0, -Math.PI * 0.5);
  intakeInnerL.position.set(6.06 + forwardAxisShiftX, 0.74, 2.28);

  const intakeShellR = intakeShellL.clone();
  intakeShellR.position.z *= -1;
  const intakeLipR = intakeLipL.clone();
  intakeLipR.position.z *= -1;
  const intakeInnerR = intakeInnerL.clone();
  intakeInnerR.position.z *= -1;

  const wingtipRailL = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.16, 0.22), nozzleMetalMat);
  wingtipRailL.position.set(-18.1, 1.1, 18.78);
  wingtipRailL.rotation.set(0, 0.06, 0.02);
  const wingtipRailR = wingtipRailL.clone();
  wingtipRailR.position.z *= -1;
  wingtipRailR.rotation.y *= -1;

  const chineStripeL = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.07, 0.2), accentMat);
  chineStripeL.position.set(8.8 + forwardAxisShiftX, 1.48, 1.72);
  chineStripeL.rotation.set(0.08, 0, -0.3);
  const chineStripeR = chineStripeL.clone();
  chineStripeR.position.z *= -1;
  chineStripeR.rotation.z *= -1;

  const wingPatternMat = accentMat.clone();
  wingPatternMat.polygonOffset = true;
  wingPatternMat.polygonOffsetFactor = -2;
  wingPatternMat.polygonOffsetUnits = -2;

  const wingPatternL = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.006, 0.42), wingPatternMat);
  wingPatternL.position.set(-6.25, -0.04, 11.8);
  wingPatternL.rotation.set(0, 0, -0.012);
  mainWingL.add(wingPatternL);

  const wingPatternR = wingPatternL.clone();
  wingPatternR.position.z *= -1;
  wingPatternR.rotation.y *= -1;
  mainWingR.add(wingPatternR);


  // Tail section rebuilt from scratch (髣匁E���E�繝ｻ・�E�鬩怜遜・�E�・�E�驍ｵ・�E�繝ｻ・�E�驍ｵ・�E�隴擾�E��E�郢晢�E��E�驍ｵ・�E�繝ｻ・�E�驍ｵ・�E�繝ｻ・�E�): horizontal tailplanes + vertical stabilizers + jet units
  // Horizontal tail is defined independently, but keeps exactly the same shape as the main wing (uniform scale only).
  const tailplaneBaseShape = [
    [8.6, 0.7],
    [-5.2, 18.8],
    [-10.6, 18.8],
    [-8.0, 0.7],
  ];
  const tailplaneScale = 0.44;
  const tailplaneShape = tailplaneBaseShape.map(([x, z]) => [x * tailplaneScale, z * tailplaneScale]);
  const tailplaneLocalMinX = Math.min(...tailplaneShape.map(([x]) => x));
  const jetBodyRearX = -40.7; // rear edge of the physical jet body (nozzle), excluding flame
  const tailJetProtrusion = 3.8; // move horizontal tail further forward while keeping jet-body protrusion
  const tailplaneX = jetBodyRearX - tailplaneLocalMinX + tailJetProtrusion;

  const tailplaneGeo = buildSurface(tailplaneShape, 0.34);
  const tailplaneGeoMirror = buildSurface(mirrorPoints(tailplaneShape), 0.34);
  const tailplaneL = new THREE.Mesh(tailplaneGeo, wingMat);
  tailplaneL.position.set(tailplaneX, 1.15, 2.2);
  tailplaneL.rotation.set(0, 0, 0);
  const tailplaneR = new THREE.Mesh(tailplaneGeoMirror, wingMat);
  tailplaneR.position.set(tailplaneX, 1.15, -2.2);
  tailplaneR.rotation.set(0, 0, 0);

  // Vertical fin: trapezoid planform with a forward-sliding leading edge (髯�E�鬘後＊陝・�E�驍ｵ・�E�隰疲�E��E�竏夐し・�E�繝ｻ・�E�髮玖ｴ具�E��E�・�E�繝ｻ邁E��╂繝ｻ・�E�髯溷私�E�E�・�E�)
  const finShape = [
    [-34.5, 3.4], // moved 1.0 forward; lower edge is horizontal/parallel to upper edge
    [-28.6, 3.4],
    [-31.7, 10.2],
    [-34.5, 10.2],
  ];
  const finCenter = new THREE.Mesh(buildVerticalSurface(finShape, 0.8), wingMat);
  finCenter.position.set(0, 0, 0);
  finCenter.rotation.z = 0;

  // Rebuilt single center jet: smaller and simpler with a clear exhaust hole.
  // Keep engine core from occupying the nozzle opening region so the rear hole remains visually open.
  const engineCore = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.95, 19.8, 24), bodyMat);
  engineCore.rotation.z = -Math.PI * 0.5;
  engineCore.position.set(-23.0, 1.15, 0);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.1, 6.0, 28, 1, true), nozzleMetalMat);
  nozzle.rotation.z = Math.PI * 0.5;
  nozzle.position.set(-32.7, 1.15, 0);

  const nozzleInner = new THREE.Mesh(
    new THREE.CylinderGeometry(2.85, 2.945, 6.0, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xa8b0ba, roughness: 0.24, metalness: 0.95, side: THREE.BackSide })
  );
  nozzleInner.rotation.z = Math.PI * 0.5;
  nozzleInner.position.copy(nozzle.position);

  const nozzleLipLength = 4.0;
  const nozzleLipOuterFrontRadius = 2.85;
  const nozzleLipOuterRearRadius = 2.945;
  const nozzleLipThickness = 1.0;
  const nozzleLipInnerMidRadius = ((nozzleLipOuterFrontRadius + nozzleLipOuterRearRadius) * 0.5) - nozzleLipThickness;
  const nozzleLipInnerFrontRadius = nozzleLipInnerMidRadius * 0.94;
  const nozzleLipInnerRearRadius = nozzleLipInnerMidRadius * 0.8;
  const nozzleLipProfile = [
    new THREE.Vector2(nozzleLipOuterRearRadius, -nozzleLipLength * 0.5),
    new THREE.Vector2(nozzleLipOuterFrontRadius, nozzleLipLength * 0.5),
    new THREE.Vector2(nozzleLipInnerFrontRadius, nozzleLipLength * 0.5),
    new THREE.Vector2(nozzleLipInnerMidRadius, 0),
    new THREE.Vector2(nozzleLipInnerRearRadius, -nozzleLipLength * 0.5),
  ];
  const nozzleLip = new THREE.Mesh(
    new THREE.LatheGeometry(nozzleLipProfile, 36),
    new THREE.MeshStandardMaterial({ color: 0xa8b0ba, roughness: 0.24, metalness: 0.95, side: THREE.DoubleSide })
  );
  nozzleLip.rotation.z = Math.PI * 0.5;
  nozzleLip.position.set(-33.7, 1.15, 0);

  // Afterburner rebuilt from scratch: bright nozzle bloom + dense flame cone + long cool plume + shock-diamond rings.
  const nozzleGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.62, 18, 14),
    new THREE.MeshBasicMaterial({
      color: 0xc5e6ff,
      transparent: true,
      opacity: 0.28,
        depthWrite: false,
    })
  );
  nozzleGlow.position.set(-35.72, 1.15, 0);

  const flameCore = new THREE.Mesh(
    new THREE.CylinderGeometry(1.26, 0.06, 13.4, 30, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x4f8ee8,
      transparent: true,
      opacity: 0.3,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  flameCore.rotation.z = -Math.PI * 0.5;
  flameCore.position.set(-39.8, 1.15, 0);

  const flameOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(1.44, 0.22, 16.8, 34, 1, false),
    new THREE.MeshBasicMaterial({
      color: 0x7fb7ff,
      transparent: true,
      opacity: 0.24,
        depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  flameOuter.rotation.z = -Math.PI * 0.5;
  flameOuter.position.set(-42.4, 1.15, 0);


  const nozzleHeatCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.22, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff6a3a,
      transparent: true,
      opacity: 0.34,
        depthWrite: false,
    })
  );
  nozzleHeatCore.position.set(-35.05, 1.15, 0);

  const nozzleHeatLines = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const streak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.065, 2.3, 8),
      new THREE.MeshBasicMaterial({
        color: 0xff4328,
        transparent: true,
        opacity: 0.62,
            depthWrite: false,
        depthTest: false,
      })
    );
    streak.rotation.x = (Math.PI * i) / 3;
    streak.rotation.z = ((i % 2) - 0.5) * 0.1;
    streak.position.set(0, 0, 0);
    nozzleHeatLines.add(streak);
  }
  nozzleHeatLines.position.set(-34.45, 1.15, 0);

  const shockRings = [];
  const shockRingRadii = [1.45, 1.7];
  const shockRingBaseX = [-37.2, -39.25];
  for (let i = 0; i < shockRingRadii.length; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(shockRingRadii[i], 0.09, 10, 24),
      new THREE.MeshBasicMaterial({
        color: 0x8fc3ff,
        transparent: true,
        opacity: 0.26,
            depthWrite: false,
      })
    );
    ring.rotation.y = Math.PI * 0.5;
    ring.position.set(shockRingBaseX[i], 1.15, 0);
    ring.userData.offset = i;
    shockRings.push(ring);
  }

  nozzleGlow.userData.baseX = nozzleGlow.position.x;
  flameCore.userData.baseX = flameCore.position.x;
  flameOuter.userData.baseX = flameOuter.position.x;
  nozzleHeatCore.userData.baseX = nozzleHeatCore.position.x;
  nozzleHeatLines.userData.baseX = nozzleHeatLines.position.x;
  shockRings.forEach((ring) => { ring.userData.baseX = ring.position.x; });

  const missileBodyGeo = new THREE.CylinderGeometry(0.38, 0.38, 6.6, 12);
  missileBodyGeo.rotateZ(-Math.PI * 0.5);
  const missileNoseGeo = new THREE.ConeGeometry(0.42, 1.3, 12);
  missileNoseGeo.rotateZ(-Math.PI * 0.5);
  missileNoseGeo.translate(3.95, 0, 0);
  const missileMat = new THREE.MeshStandardMaterial({ color: isPlayer ? 0xd6e4f2 : 0xd4d6cf, emissive: isPlayer ? 0x243749 : 0x1f1f1f, emissiveIntensity: 0.2, roughness: 0.34, metalness: 0.72 });

  function buildWingMissile(side = 1) {
    const missileGroup = new THREE.Group();
    const body = new THREE.Mesh(missileBodyGeo, missileMat);
    const nose = new THREE.Mesh(missileNoseGeo, missileMat);
    const finMat = accentMat.clone();
    finMat.emissiveIntensity = 0.1;
    const finGeo = new THREE.BoxGeometry(1.1, 0.06, 0.7);
    const finTop = new THREE.Mesh(finGeo, finMat);
    finTop.position.set(-1.1, 0.38, 0);
    const finBottom = finTop.clone();
    finBottom.position.y = -0.38;
    const finSide = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.06), finMat);
    finSide.position.set(-1.1, 0, 0.34);
    const finSideOpp = finSide.clone();
    finSideOpp.position.z = -0.34;
    missileGroup.add(body, nose, finTop, finBottom, finSide, finSideOpp);
    missileGroup.position.set(-17.2, 1.2, side * 19.2);
    return missileGroup;
  }

  const wingMissileL = buildWingMissile(1);
  const wingMissileR = buildWingMissile(-1);

  g.add(
    centerSpine, forwardSpineTaper, forwardTaperTopBulge, dorsalFlowHump, cockpitShoulderBulge, upperSpineBlendBulge, cockpitBlend, cockpitBody, cockpitFairing, dorsalDeck, cockpitGlass, noseSection, noseCone, gunBaseL, gunBaseR, gunBarrelL, gunBarrelR,
    mainWingL, mainWingR,
    wingMissileL, wingMissileR,
    tailplaneL, tailplaneR, finCenter,
    engineCore, nozzle, nozzleInner, nozzleLip,
    nozzleGlow, flameCore, flameOuter, nozzleHeatCore, nozzleHeatLines, ...shockRings
  );

  // Keep aircraft visually facing gameplay forward (+X). Model itself is built with nose on +Z.
  g.rotation.y = -Math.PI * 0.5;

  g.scale.setScalar(1.24);
  g.position.set(0, 300, 0);
  g.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.frustumCulled = false;
    }
  });
  world.add(g);

  const plane = {
    mesh: g,
    prevPosition: new THREE.Vector3(),
    velocity: new THREE.Vector3(200, 0, 0),
    hp: 100,
    alive: true,
    cooldown: 0,
    speed: 220,
    target: null,
    safeAnchor: getBotSafeAnchor(new THREE.Vector3()),
    wallReturnAnchor: new THREE.Vector3(0, 290, 0),
    wallReturnSide: Math.random() < 0.5 ? -1 : 1,
    engagementMode: BOT_MODE_REGROUP,
    engagementTimer: 0,
    targetHoldTimer: 0,
    regroupTimer: 0,
    wallTargetTimer: 0,
    obstacleBounceCount: 0,
    obstacleBounceWindow: 0,
    obstacleClimbTimer: 0,
    repositionSide: 0,
    formationSlot: 0,
    repositionTimer: 0,
    wallRecoverTimer: 0,
    wallEscapeDir: new THREE.Vector3(1, 0, 0),
    wallContactCooldown: 0,
    wallReturnTimer: 0,
    wallPostReturnTimer: 0,
    wallState: "none",
    wallFaceId: null,
    wallUnsafeHoldTimer: 0,
    wallHitLatch: false,
    stuckTimer: 0,
    attackWindowTimer: 0,
    burstTimer: 0,
    isPlayer,
    isColliding: false,
    yaw: 0,
    pitch: 0,
    roll: 0,
    pitchRate: 0,
    rollRate: 0,
    nextGunSide: 0,
    gunHardpoints: [GUN_MUZZLE_LOCAL_LEFT.clone(), GUN_MUZZLE_LOCAL_RIGHT.clone()],
    hpLabel: null,
    lockOutline: null,
    friendlyMarker: null,
    teamId: null,
    teamRole: isPlayer ? "player" : "enemy",
    callsign: isPlayer ? "YOU" : "EN",
    exhaust: {
      nozzleGlow,
      flameCore,
      flameOuter,
      nozzleHeatCore,
      nozzleHeatLines,
      shockRings,
    },
    missiles: [wingMissileL, wingMissileR],
    missileAmmo: MISSILE_MAX_AMMO,
    missileCooldown: 0,
    missileTarget: null,
    missileLockHoldTimer: 0,
    missileLockHoldDuration: rand(BOT_MISSILE_LOCK_HOLD_MIN, BOT_MISSILE_LOCK_HOLD_MAX),
    boostFuel: BOOST_FUEL_MAX,
    boostWasActive: false,
  };

  return plane;
}

function ensureFriendlyMarker(plane) {
  if (!plane?.mesh) return null;
  if (plane.friendlyMarker) return plane.friendlyMarker;

  const createFriendlyLabelSprite = (labelText) => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const drawRoundRect = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawRoundRect(18, 16, canvas.width - 36, canvas.height - 32, 22);
    ctx.fillStyle = "rgba(8, 32, 52, 0.78)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(123, 236, 255, 0.92)";
    ctx.stroke();

    ctx.font = "700 42px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(129, 236, 255, 0.68)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#effcff";
    ctx.fillText(labelText || "ALLY", canvas.width * 0.5, canvas.height * 0.54);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, 26, 0);
    sprite.renderOrder = 152;
    sprite.userData.baseScale = new THREE.Vector3(15.5, 5.8, 1);
    sprite.scale.copy(sprite.userData.baseScale);
    return sprite;
  };

  const marker = new THREE.Group();
  const chevronGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-4.7, 15.2, 0),
    new THREE.Vector3(0, 20.6, 0),
    new THREE.Vector3(4.7, 15.2, 0),
  ]);
  const chevronMat = new THREE.LineBasicMaterial({
    color: 0xbdf7ff,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const chevron = new THREE.Line(chevronGeo, chevronMat);
  chevron.renderOrder = 151;
  chevron.userData.baseScale = new THREE.Vector3(1, 1, 1);

  const chevronBack = chevron.clone();
  chevronBack.position.y = -3.8;
  chevronBack.scale.setScalar(0.84);
  chevronBack.userData.baseScale = new THREE.Vector3(0.84, 0.84, 0.84);

  const stemGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 10.2, 0),
    new THREE.Vector3(0, 17.2, 0),
  ]);
  const stem = new THREE.Line(
    stemGeo,
    new THREE.LineBasicMaterial({
      color: 0x8feeff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    })
  );
  stem.renderOrder = 150;
  stem.userData.baseScale = new THREE.Vector3(1, 1, 1);

  const label = createFriendlyLabelSprite(plane.callsign || "ALLY");

  marker.add(chevron, chevronBack, stem);
  if (label) marker.add(label);
  marker.visible = false;
  marker.userData = { label };
  plane.mesh.add(marker);
  plane.friendlyMarker = marker;
  return marker;
}

function disposeFriendlyMarker(plane) {
  if (!plane?.friendlyMarker) return;
  const geometries = new Set();
  const materials = new Set();
  plane.friendlyMarker.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (Array.isArray(node.material)) node.material.forEach((mat) => mat && materials.add(mat));
    else if (node.material) materials.add(node.material);
  });
  plane.mesh?.remove?.(plane.friendlyMarker);
  geometries.forEach((geometry) => geometry?.dispose?.());
  materials.forEach((material) => {
    material?.map?.dispose?.();
    material?.dispose?.();
  });
  plane.friendlyMarker = null;
}

function updateFriendlyMarkers() {
  if (!game.player) return;
  const pulse = 1 + Math.sin(performance.now() * 0.0055) * 0.08;
  for (const plane of game.bots) {
    if (!plane?.alive || !isPlayerFriendly(plane) || game.activeMatchConfig?.mode !== MATCH_MODE_TEAM) {
      if (plane?.friendlyMarker) plane.friendlyMarker.visible = false;
      continue;
    }

    const marker = ensureFriendlyMarker(plane);
    if (!marker) continue;
    marker.visible = true;
    marker.quaternion.copy(camera.quaternion);
    const markerDistance = camera.position.distanceTo(plane.mesh.getWorldPosition(tmpVecA));
    const distanceScale = clamp(markerDistance / 170, 1.2, 5.4);
    marker.children.forEach((child) => {
      const baseScale = child.userData?.baseScale;
      if (baseScale) child.scale.copy(baseScale).multiplyScalar(distanceScale * pulse);
    });
    const label = marker.userData?.label;
    if (label?.material) label.material.opacity = clamp(0.9 - markerDistance / 4200, 0.52, 0.95);
  }
}

function ensureLockOutline(plane) {
  if (!plane?.mesh) return null;
  if (plane.lockOutline) return plane.lockOutline;

  const lockOutline = new THREE.Group();
  const lockOutlineMat = new THREE.LineBasicMaterial({
    color: 0xff2c2c,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    depthTest: false,
  });

  plane.mesh.traverse((node) => {
    if (!node.isMesh || !node.geometry) return;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(node.geometry, 30), lockOutlineMat);
    edges.position.copy(node.position);
    edges.quaternion.copy(node.quaternion);
    edges.scale.copy(node.scale).multiplyScalar(1.14);
    edges.renderOrder = 121;
    edges.frustumCulled = false;
    edges.userData.baseScale = edges.scale.clone();
    lockOutline.add(edges);
  });

  lockOutline.visible = false;
  lockOutline.userData = { lineMat: lockOutlineMat };
  plane.mesh.add(lockOutline);
  plane.lockOutline = lockOutline;
  return lockOutline;
}

function disposeLockOutline(plane) {
  if (!plane?.lockOutline) return;
  const geometries = new Set();
  const materials = new Set();
  plane.lockOutline.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (Array.isArray(node.material)) node.material.forEach((mat) => mat && materials.add(mat));
    else if (node.material) materials.add(node.material);
  });
  plane.mesh?.remove?.(plane.lockOutline);
  geometries.forEach((geometry) => geometry?.dispose?.());
  materials.forEach((material) => material?.dispose?.());
  plane.lockOutline = null;
}

function updatePlaneExhaust(plane, boostLevel = 0) {
  if (!plane?.exhaust) return;
  const t = performance.now() * 0.001;
  const pulse = 1 + Math.sin(t * 32 + plane.mesh.id * 0.73) * 0.07;
  const shimmer = Math.sin(t * 21 + plane.mesh.id * 0.31) * 0.05;
  const turbulence = Math.sin(t * 17 + plane.mesh.id * 0.42) * 0.12;
  const boostMix = clamp(boostLevel, 0, 1);

  const coreLengthIdle = (0.84 + boostLevel * 0.42) * pulse;
  const coreLengthBoost = (1.22 + boostLevel * 1.18) * (pulse + 0.03);
  const coreLength = THREE.MathUtils.lerp(coreLengthIdle, coreLengthBoost, Math.pow(boostMix, 0.9));

  const outerLengthIdle = (0.92 + boostLevel * 1.1) * (pulse + 0.02);
  const outerLengthBoost = (1.16 + boostLevel * 1.58) * (pulse + 0.03);
  const outerLength = THREE.MathUtils.lerp(outerLengthIdle, outerLengthBoost, boostMix);

  const coreRadiusIdle = 0.92 + boostLevel * 0.14 + shimmer * 0.45;
  const coreRadiusBoost = 1.52 + boostLevel * 0.4 + shimmer * 0.72;
  const coreRadius = THREE.MathUtils.lerp(coreRadiusIdle, coreRadiusBoost, Math.pow(boostMix, 0.66));

  const outerRadiusIdle = 0.8 + boostLevel * 0.2 + shimmer;
  const outerRadiusBoost = 1.12 + boostLevel * 0.4 + shimmer * 1.35;
  const outerRadius = THREE.MathUtils.lerp(outerRadiusIdle, outerRadiusBoost, boostMix);

  const glowScaleIdle = 0.84 + boostLevel * 0.28 + pulse * 0.03;
  const glowScaleBoost = 0.98 + boostLevel * 0.56 + pulse * 0.05;
  plane.exhaust.nozzleGlow.scale.setScalar(THREE.MathUtils.lerp(glowScaleIdle, glowScaleBoost, boostMix));

  const glowOpacityIdle = clamp(0.18 + boostLevel * 0.38 + pulse * 0.03, 0.1, 0.56);
  const glowOpacityBoost = clamp(0.56 + boostLevel * 0.46 + pulse * 0.06, 0.3, 1.0);
  plane.exhaust.nozzleGlow.material.opacity = THREE.MathUtils.lerp(glowOpacityIdle, glowOpacityBoost, boostMix);

  const innerFlameRadiusScale = 1 - boostMix * 0.1;
  plane.exhaust.flameCore.scale.set(coreRadius * innerFlameRadiusScale, coreLength, coreRadius * innerFlameRadiusScale);
  const coreBaseX = plane.exhaust.flameCore.userData.baseX ?? plane.exhaust.flameCore.position.x;
  const coreShiftIdle = (coreLength - 1) * 3.5;
  const coreShiftBoost = (coreLength - 1) * 7.2;
  plane.exhaust.flameCore.position.x = coreBaseX - THREE.MathUtils.lerp(coreShiftIdle, coreShiftBoost, boostMix);
  const coreOpacityIdle = clamp(0.24 + boostLevel * 0.3 + pulse * 0.03, 0.16, 0.62);
  const coreOpacityBoost = clamp(0.62 + boostLevel * 0.58 + pulse * 0.05, 0.46, 1.0);
  plane.exhaust.flameCore.material.opacity = THREE.MathUtils.lerp(coreOpacityIdle, coreOpacityBoost, Math.pow(boostMix, 0.72));

  plane.exhaust.flameOuter.scale.set(outerRadius, outerLength, outerRadius);
  const outerBaseX = plane.exhaust.flameOuter.userData.baseX ?? plane.exhaust.flameOuter.position.x;
  const outerShiftIdle = (outerLength - 1) * 4.9;
  const outerShiftBoost = (outerLength - 1) * 6.3;
  plane.exhaust.flameOuter.position.x = outerBaseX - THREE.MathUtils.lerp(outerShiftIdle, outerShiftBoost, boostMix);
  plane.exhaust.flameOuter.position.z = THREE.MathUtils.lerp(turbulence * 0.34, turbulence * 0.42, boostMix);
  const outerOpacityIdle = clamp(0.16 + boostLevel * 0.2 + pulse * 0.03, 0.08, 0.5);
  const outerOpacityBoost = clamp(0.34 + boostLevel * 0.2 + pulse * 0.04, 0.22, 0.62);
  plane.exhaust.flameOuter.material.opacity = THREE.MathUtils.lerp(outerOpacityIdle, outerOpacityBoost, Math.pow(boostMix, 0.86));

  const innerBlueDepth = clamp(0.82 + boostMix * 0.06 + pulse * 0.02, 0.8, 1.0 + boostMix * 0.5);
  const innerWarm = clamp(0.34 + boostMix * 0.86 + pulse * 0.03, 0.32, 1.0 + boostMix * 0.5);
  const innerGreen = clamp(0.44 + boostMix * 0.76 + pulse * 0.03, 0.42, 1.0 + boostMix * 0.5);
  plane.exhaust.flameCore.material.color.setRGB(innerWarm, innerGreen, innerBlueDepth);

  const outerBlueGlow = clamp(0.9 + boostMix * 0.08 + pulse * 0.015, 0.86, 1.0);
  plane.exhaust.flameOuter.material.color.setRGB(0.12, 0.34 + boostMix * 0.06, outerBlueGlow);

  const nozzleHeatPulse = 0.86 + Math.sin(t * 24 + plane.mesh.id * 0.57) * 0.14;
  const heatCoreScale = THREE.MathUtils.lerp(0.82, 0.98 + boostMix * 0.2, boostMix) * nozzleHeatPulse;
  plane.exhaust.nozzleHeatCore.scale.setScalar(heatCoreScale);
  const heatCoreBaseX = plane.exhaust.nozzleHeatCore.userData.baseX ?? plane.exhaust.nozzleHeatCore.position.x;
  plane.exhaust.nozzleHeatCore.position.x = heatCoreBaseX - THREE.MathUtils.lerp(0.25, 1.6, boostMix);
  plane.exhaust.nozzleHeatCore.material.opacity = clamp(0.2 + boostMix * 0.18 + nozzleHeatPulse * 0.08, 0.14, 0.46);
  plane.exhaust.nozzleHeatCore.material.color.setRGB(
    clamp(0.84 + boostMix * 0.16, 0.72, 1.0),
    clamp(0.2 + boostMix * 0.24, 0.14, 0.56),
    clamp(0.12 + boostMix * 0.06, 0.08, 0.22)
  );

  const heatLinesBaseX = plane.exhaust.nozzleHeatLines.userData.baseX ?? plane.exhaust.nozzleHeatLines.position.x;
  plane.exhaust.nozzleHeatLines.position.x = heatLinesBaseX - THREE.MathUtils.lerp(0.2, 1.35, boostMix);
  plane.exhaust.nozzleHeatLines.rotation.x = Math.PI * 0.5 + Math.sin(t * 4.2 + plane.mesh.id * 0.19) * 0.1;
  plane.exhaust.nozzleHeatLines.rotation.z = Math.sin(t * 2.8 + plane.mesh.id * 0.13) * 0.12;
  plane.exhaust.nozzleHeatLines.children.forEach((streak, index) => {
    const streakPulse = 0.9 + Math.sin(t * 7.2 + index * 0.9 + plane.mesh.id * 0.17) * 0.1;
    streak.material.opacity = clamp(0.74 + streakPulse * 0.4, 0.72, 1.0);
    streak.material.color.setRGB(
      2.0,
      0.16,
      0.08
    );
  });

  const shockRingBoostScaleByOffset = {
    0: (2.45 * 0.85 * 1.1) / 1.45,
    1: (2.88 * 0.85) / 1.7,
  };
  const shockRingSizeMultiplier = 1.2;
  plane.exhaust.shockRings.forEach((ring) => {
    const offset = ring.userData.offset ?? 0;
    const boostPulseMix = Math.pow(boostMix, 0.72);
    const phaseSpeed = THREE.MathUtils.lerp(2.4, 7.0, boostPulseMix);
    const pulseSpeedA = THREE.MathUtils.lerp(4.1, 10.8, boostPulseMix);
    const pulseSpeedB = THREE.MathUtils.lerp(1.9, 5.6, boostPulseMix);
    const opacityWaveSpeed = THREE.MathUtils.lerp(2.1, 7.4, boostPulseMix);
    const ringState = ring.userData;
    const phaseDt = clamp(t - (ringState.phaseLastT ?? t), 0, 0.05);
    ringState.phaseLastT = t;
    ringState.phaseAcc = (ringState.phaseAcc ?? 0) + phaseDt * phaseSpeed;
    ringState.pulseAAcc = (ringState.pulseAAcc ?? 0) + phaseDt * pulseSpeedA;
    ringState.pulseBAcc = (ringState.pulseBAcc ?? 0) + phaseDt * pulseSpeedB;
    ringState.opacityAcc = (ringState.opacityAcc ?? 0) + phaseDt * opacityWaveSpeed;

    const phase = ringState.phaseAcc - offset * 0.72 + plane.mesh.id * 0.05;
    const travel = (Math.sin(phase) + 1) * 0.5;
    const baseX = ringState.baseX ?? ring.position.x;
    const ringPulse = 0.94
      + Math.sin(ringState.pulseAAcc + offset * 1.2 + plane.mesh.id * 0.11) * 0.08
      + Math.sin(ringState.pulseBAcc + offset * 0.7 + plane.mesh.id * 0.03) * 0.03;
    const boostScaleTarget = shockRingBoostScaleByOffset[offset] ?? 1.1;
    const boostScale = THREE.MathUtils.lerp(0.9, boostScaleTarget, Math.pow(boostMix, 0.68));
    const boostBackShift = THREE.MathUtils.lerp(0.04, 0.35, boostMix);
    ring.position.x = baseX - travel * THREE.MathUtils.lerp(0.32, 1.30, boostMix) - boostBackShift;
    ring.scale.setScalar(shockRingSizeMultiplier * boostScale * ringPulse);
    const ringOpacityBase = 0.14 + boostMix * 0.22;
    ring.material.opacity = clamp(ringOpacityBase + Math.sin(ringState.opacityAcc + offset * 0.9) * 0.04, 0.08, 0.5);
    ring.material.color.setRGB(0.52 + boostMix * 0.2, 0.74 + boostMix * 0.12, 1.0);
  });

  plane.exhaust.nozzleGlow.material.color.setHex(0xbfe7ff);

}

function isCockpitViewActive() {
  return document.body.classList.contains("cockpit-active");
}

function getScreenSpaceRect() {
  const rect = canvas?.getBoundingClientRect?.();
  if (rect && rect.width > 4 && rect.height > 4) return rect;

  const viewport = window.visualViewport;
  return {
    left: 0,
    top: 0,
    width: Math.max(1, viewport?.width || window.innerWidth || 1),
    height: Math.max(1, viewport?.height || window.innerHeight || 1),
  };
}

function screenPointToWorldRay(screenX, screenY, outDirection = playerAimDir, outOrigin = playerReticleRayOrigin) {
  const rect = getScreenSpaceRect();
  const localX = clamp(screenX - rect.left, 0, rect.width);
  const localY = clamp(screenY - rect.top, 0, rect.height);
  const ndcX = (localX / rect.width) * 2 - 1;
  const ndcY = -(localY / rect.height) * 2 + 1;
  outOrigin.copy(camera.position);
  playerAimProbe.set(ndcX, ndcY, 0.25).unproject(camera);
  return outDirection.copy(playerAimProbe).sub(outOrigin).normalize();
}

function getPlayerReticleScreenPosition(out = playerReticleScreen) {
  const screenRect = getScreenSpaceRect();
  let aimX = screenRect.left + screenRect.width * 0.5;
  let aimY = screenRect.top + screenRect.height * 0.5;
  if (isCockpitViewActive()) {
    const crosshairRect = crosshairEl?.getBoundingClientRect?.();
    if (crosshairRect && crosshairRect.width > 4 && crosshairRect.height > 4) {
      aimX = crosshairRect.left + crosshairRect.width * 0.5;
      aimY = crosshairRect.top + crosshairRect.height * 0.5;
    } else {
      const glassRect = gunsightGlassEl?.getBoundingClientRect?.();
      if (glassRect && glassRect.width > 4 && glassRect.height > 4) {
        aimX = glassRect.left + glassRect.width * 0.5;
        aimY = glassRect.top + glassRect.height * 0.5;
      } else if (cockpitFrameEl) {
        const frameRect = getCockpitFrameContentRect();
        if (frameRect) {
          const center = getCockpitCenterRatios();
          aimX = frameRect.left + frameRect.width * center.centerX;
          aimY = frameRect.top + frameRect.height * center.centerY;
        }
      }
    }
  }

  return out.set(aimX, aimY);
}

function getPlayerReticleRay(outDirection = playerAimDir, outOrigin = playerReticleRayOrigin) {
  getPlayerReticleScreenPosition(playerReticleScreen);
  return screenPointToWorldRay(playerReticleScreen.x, playerReticleScreen.y, outDirection, outOrigin);
}

function getPlayerShotOrigin(owner, muzzleLocal, reticleDir, out = playerShotOrigin) {
  if (isCockpitViewActive()) {
    const sideSign = muzzleLocal && Number.isFinite(muzzleLocal.z)
      ? (muzzleLocal.z < 0 ? 1 : -1)
      : -1;
    playerCockpitShotProbe.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    playerCockpitShotDir.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    return out.copy(camera.position)
      .addScaledVector(reticleDir, COCKPIT_VIRTUAL_SHOT_FORWARD)
      .addScaledVector(playerCockpitShotProbe, sideSign * COCKPIT_VIRTUAL_SHOT_SIDE_OFFSET)
      .addScaledVector(playerCockpitShotDir, -COCKPIT_VIRTUAL_SHOT_DOWN_OFFSET);
  }

  let muzzleResolved = false;
  if (owner?.mesh?.localToWorld && muzzleLocal) {
    out.copy(muzzleLocal);
    owner.mesh.localToWorld(out);
    muzzleResolved = Number.isFinite(out.x) && Number.isFinite(out.y) && Number.isFinite(out.z);
  }

  if (!muzzleResolved) {
    out.copy(owner.mesh.position).addScaledVector(reticleDir, 20);
  }

  return out;
}

function resolvePlayerShotTarget(out = bulletConvergencePos, rayDirection = null, shotOrigin = null) {
  const dir = rayDirection || getPlayerReticleRay(playerAimDir, playerReticleRayOrigin);
  playerReticleRayOrigin.copy(camera.position);

  let aimDistance = GUN_ZERO_DISTANCE_FALLBACK;
  let hitObstacle = false;

  if (staticObstacleMeshes.length > 0) {
    bulletRaycaster.set(playerReticleRayOrigin, dir);
    bulletRaycaster.near = 1;
    bulletRaycaster.far = GUN_ZERO_DISTANCE_MAX;
    const hits = bulletRaycaster.intersectObjects(staticObstacleMeshes, false);
    if (hits.length > 0) {
      aimDistance = hits[0].distance;
      hitObstacle = true;
    }
  }

  if (hitObstacle) {
    aimDistance = clamp(aimDistance, 6, GUN_ZERO_DISTANCE_MAX);
  } else {
    aimDistance = clamp(aimDistance, GUN_ZERO_DISTANCE_MIN, GUN_ZERO_DISTANCE_MAX);
  }

  out.copy(playerReticleRayOrigin).addScaledVector(dir, aimDistance);

  if (!shotOrigin) return out;

  const forwardDistance = tmpVecB.copy(out).sub(shotOrigin).dot(dir);
  if (forwardDistance < 1) {
    out.copy(shotOrigin).addScaledVector(dir, 8);
  }

  if (staticObstacleMeshes.length > 0) {
    bulletFlightDir.copy(out).sub(shotOrigin);
    const pathDistance = bulletFlightDir.length();
    if (pathDistance > 1e-4) {
      bulletFlightDir.multiplyScalar(1 / pathDistance);
      bulletRaycaster.set(shotOrigin, bulletFlightDir);
      bulletRaycaster.near = 0.15;
      bulletRaycaster.far = pathDistance;
      const pathHits = bulletRaycaster.intersectObjects(staticObstacleMeshes, false);
      if (pathHits.length > 0) out.copy(pathHits[0].point);
    }
  }

  return out;
}

function spawnBullet(owner, color) {
  if (!owner?.mesh) return;

  const visualTeam = owner.isPlayer ? "player" : "bot";
  const b = new THREE.Mesh(
    bulletTracerGeometry,
    visualTeam === "player" ? bulletTracerMaterialPlayer : bulletTracerMaterialBot
  );

  const useRightGun = owner.nextGunSide === 1;
  if (typeof owner.nextGunSide === "number") {
    owner.nextGunSide = useRightGun ? 0 : 1;
  }

  const muzzleLocal = owner.gunHardpoints?.[useRightGun ? 1 : 0]
    || (useRightGun ? GUN_MUZZLE_LOCAL_RIGHT : GUN_MUZZLE_LOCAL_LEFT);

  if (owner === game.player) {
    getPlayerReticleRay(bulletAimDir, playerReticleRayOrigin);
    getPlayerShotOrigin(owner, muzzleLocal, bulletAimDir, bulletMuzzlePos);
    b.position.copy(bulletMuzzlePos);
    resolvePlayerShotTarget(bulletConvergencePos, bulletAimDir, b.position);
  } else {
    getBotAimPoint(owner, bulletConvergencePos);
    bulletAimDir.copy(bulletConvergencePos).sub(owner.mesh.position);
    if (bulletAimDir.lengthSq() <= 1e-6) {
      bulletAimDir.set(1, 0, 0).applyQuaternion(owner.mesh.quaternion).normalize();
    } else {
      bulletAimDir.normalize();
    }

    let muzzleResolved = false;
    if (owner.mesh.localToWorld && muzzleLocal) {
      bulletMuzzlePos.copy(muzzleLocal);
      owner.mesh.localToWorld(bulletMuzzlePos);
      if (Number.isFinite(bulletMuzzlePos.x) && Number.isFinite(bulletMuzzlePos.y) && Number.isFinite(bulletMuzzlePos.z)) {
        b.position.copy(bulletMuzzlePos);
        muzzleResolved = true;
      }
    }

    if (!muzzleResolved) {
      b.position.copy(owner.mesh.position).addScaledVector(bulletAimDir, 28);
    }
  }

  bulletFlightDir.copy(bulletConvergencePos).sub(b.position);
  if (bulletFlightDir.lengthSq() <= 1e-6) {
    bulletFlightDir.copy(bulletAimDir);
  } else {
    bulletFlightDir.normalize();
  }

  b.quaternion.setFromUnitVectors(AXIS_X, bulletFlightDir);
  b.frustumCulled = false;
  b.renderOrder = 130;

  bulletMuzzleForwardDir.set(1, 0, 0).applyQuaternion(owner.mesh.quaternion).normalize();
  spawnMuzzleFlash(b.position, bulletMuzzleForwardDir, visualTeam, owner, muzzleLocal);

  // Temporary aiming vectors must not be stored in bullet state.
  b.userData = {
    owner,
    vel: new THREE.Vector3().copy(bulletFlightDir).multiplyScalar(TRACER_SPEED),
    life: 2.05,
    teamId: owner.teamId,
    visualTeam,
  };
  world.add(b);
  game.bullets.push(b);
}

function getPlayerAimDirection(out = playerAimDir) {
  return getPlayerReticleRay(out, playerReticleRayOrigin);
}

function getPlayerAimPoint(out = bulletConvergencePos, direction = null, shotOrigin = null) {
  const rayDirection = direction || getPlayerReticleRay(playerAimDir, playerReticleRayOrigin);
  return resolvePlayerShotTarget(out, rayDirection, shotOrigin);
}

function getBotAimPoint(owner, out = bulletConvergencePos) {
  if (owner?.target?.alive) {
    const targetPos = getLockAimPoint(owner.target, tmpVecA);
    const dist = owner.mesh.position.distanceTo(targetPos);
    const leadTime = clamp(dist / TRACER_SPEED, 0.04, 1.1);
    return out.copy(targetPos).addScaledVector(owner.target.velocity, leadTime * 0.9);
  }

  bulletAimDir.set(1, 0, 0).applyQuaternion(owner.mesh.quaternion).normalize();
  return out.copy(owner.mesh.position).addScaledVector(bulletAimDir, GUN_ZERO_DISTANCE_FALLBACK);
}

function createPooledMuzzleFlash(team = "player") {
  const preset = muzzleFlashMaterials[team] || muzzleFlashMaterials.bot;
  const coreMat = preset.core.clone();
  const ringMat = preset.ring.clone();
  const streakMatA = preset.streak.clone();
  const streakMatB = preset.streak.clone();

  const flash = new THREE.Group();

  const core = new THREE.Mesh(muzzleFlashCoreGeometry, coreMat);
  core.renderOrder = 132;

  const ring = new THREE.Mesh(muzzleFlashRingGeometry, ringMat);
  ring.rotation.y = Math.PI * 0.5;
  ring.renderOrder = 133;

  const streakA = new THREE.Mesh(muzzleFlashStreakGeometry, streakMatA);
  streakA.rotation.y = Math.PI * 0.5;
  streakA.renderOrder = 134;

  const streakB = new THREE.Mesh(muzzleFlashStreakGeometry, streakMatB);
  streakB.rotation.set(Math.PI * 0.5, Math.PI * 0.5, 0);
  streakB.renderOrder = 134;

  ring.position.x = 0.24;
  streakA.position.x = 0.52;
  streakB.position.x = 0.52;

  flash.add(core, ring, streakA, streakB);
  flash.visible = false;

  return {
    kind: "muzzle",
    mesh: flash,
    pool: effectPools.muzzle[team] || effectPools.muzzle.bot,
    materials: [coreMat, ringMat, streakMatA, streakMatB],
    materialOpacityScales: [1, 0.6, 0.52, 0.52],
    spawnScale: team === "player" ? 0.82 : 0.78,
    baseOpacity: MUZZLE_FLASH_BASE_OPACITY,
    followOwner: null,
    followLocal: new THREE.Vector3(),
    hasFollowLocal: false,
    followForwardOffset: MUZZLE_FLASH_FORWARD_OFFSET,
  };
}

function spawnMuzzleFlash(position, direction, team = "player", owner = null, muzzleLocal = null) {
  if (team === "player" && document.body.classList.contains("cockpit-active")) return;

  const pool = effectPools.muzzle[team] || effectPools.muzzle.bot;
  const fx = acquirePooledEffect(pool, () => createPooledMuzzleFlash(team));
  fx.mesh.position.copy(position).addScaledVector(direction, MUZZLE_FLASH_FORWARD_OFFSET);
  fx.mesh.quaternion.setFromUnitVectors(AXIS_X, direction);
  fx.life = MUZZLE_FLASH_LIFE;
  fx.maxLife = MUZZLE_FLASH_LIFE;
  fx.scaleRate = MUZZLE_FLASH_SCALE_RATE;
  fx.baseOpacity = MUZZLE_FLASH_BASE_OPACITY;
  fx.followOwner = owner?.mesh ? owner : null;
  fx.followForwardOffset = MUZZLE_FLASH_FORWARD_OFFSET;
  if (muzzleLocal) {
    fx.followLocal.copy(muzzleLocal);
    fx.hasFollowLocal = true;
  } else {
    fx.hasFollowLocal = false;
  }
  fx.materials.forEach((mat, index) => {
    mat.opacity = MUZZLE_FLASH_BASE_OPACITY * (fx.materialOpacityScales[index] ?? 1);
  });
  game.effects.push(fx);
}

function createImpactEffect() {
  const mesh = new THREE.Mesh(
    impactFxGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
  );
  mesh.visible = false;
  return { kind: "impact", mesh, pool: effectPools.impact, spawnScale: 1 };
}

function spawnImpactFx(position, color) {
  const fx = acquirePooledEffect(effectPools.impact, createImpactEffect);
  fx.mesh.position.copy(position);
  fx.mesh.material.color.setHex(color);
  fx.mesh.material.opacity = 0.85;
  fx.baseOpacity = 0.85;
  fx.life = 0.24;
  fx.maxLife = 0.24;
  fx.scaleRate = 13;
  game.effects.push(fx);
}

function createMissileExplosionFlashEffect() {
  const mesh = new THREE.Mesh(
    missileExplosionFlashGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffd58e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.visible = false;
  return { kind: "explosionFlash", mesh, pool: effectPools.explosionFlash, spawnScale: 1 };
}

function createMissileExplosionSmokeEffect() {
  const mesh = new THREE.Mesh(
    missileExplosionSmokeGeometry,
    new THREE.MeshBasicMaterial({ color: 0x6d7988, transparent: true, opacity: 0.52, depthWrite: false })
  );
  mesh.visible = false;
  return { kind: "explosionSmoke", mesh, pool: effectPools.explosionSmoke, spawnScale: 1 };
}

function createMissileJetEffect() {
  const mesh = new THREE.Mesh(
    missileTrailJetGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffb86d, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  mesh.visible = false;
  return { kind: "missileJet", mesh, pool: effectPools.missileJet, spawnScale: 1 };
}

function createMissileSmokeEffect() {
  const mesh = new THREE.Mesh(
    missileTrailSmokeGeometry,
    new THREE.MeshBasicMaterial({ color: 0x768190, transparent: true, opacity: 0.56, depthWrite: false })
  );
  mesh.visible = false;
  return { kind: "missileSmoke", mesh, pool: effectPools.missileSmoke, spawnScale: 1 };
}

function spawnMissileJetTrail(position, velocity) {
  const fx = acquirePooledEffect(effectPools.missileJet, createMissileJetEffect);
  tmpVecA.copy(velocity).normalize();
  fx.mesh.position.copy(position).addScaledVector(tmpVecA, -2.9);
  fx.mesh.material.opacity = 0.95;
  fx.baseOpacity = 0.95;
  fx.life = 0.2;
  fx.maxLife = 0.2;
  fx.scaleRate = 8.8;
  game.effects.push(fx);
}

function spawnMissileSmokeTrail(position, velocity) {
  const fx = acquirePooledEffect(effectPools.missileSmoke, createMissileSmokeEffect);
  tmpVecA.copy(velocity).normalize();
  fx.mesh.position.copy(position).addScaledVector(tmpVecA, -2.4);
  fx.mesh.material.opacity = 0.56;
  fx.baseOpacity = 0.56;
  fx.life = 0.52;
  fx.maxLife = 0.52;
  fx.scaleRate = 4.4;
  game.effects.push(fx);
}

function spawnMissileExplosion(position) {
  const flash = acquirePooledEffect(effectPools.explosionFlash, createMissileExplosionFlashEffect);
  flash.mesh.position.copy(position);
  flash.mesh.material.opacity = 0.9;
  flash.baseOpacity = 0.9;
  flash.life = 0.34;
  flash.maxLife = 0.34;
  flash.scaleRate = 11;
  game.effects.push(flash);

  const smoke = acquirePooledEffect(effectPools.explosionSmoke, createMissileExplosionSmokeEffect);
  smoke.mesh.position.copy(position);
  smoke.mesh.material.opacity = 0.52;
  smoke.baseOpacity = 0.52;
  smoke.life = 0.62;
  smoke.maxLife = 0.62;
  smoke.scaleRate = 5.4;
  game.effects.push(smoke);
}

function getBestLockTarget(shooter, lockRange = MISSILE_LOCK_RANGE, lockDot = MISSILE_LOCK_DOT) {
  const candidates = getLockCandidates(shooter);
  const lockOrigin = shooter.isPlayer ? camera.position : shooter.mesh.position;
  const aimForward = shooter.isPlayer
    ? lockAimForwardVec.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize()
    : lockAimForwardVec.set(1, 0, 0).applyQuaternion(shooter.mesh.quaternion).normalize();
  let best = null;
  let bestScore = -Infinity;

  for (const target of candidates) {
    if (!target || !target.alive || target === shooter) continue;
    const targetPos = getLockAimPoint(target, tmpVecA);
    const toTarget = lockToTargetVec.copy(targetPos).sub(lockOrigin);
    const dist = toTarget.length();
    if (dist <= 1e-3 || dist > lockRange) continue;
    const dot = aimForward.dot(toTarget.multiplyScalar(1 / dist));
    if (dot < lockDot) continue;
    if (!hasLineOfSight(lockOrigin, target)) continue;
    const centerBias = (1 - dot) * 0.9;
    const score = dot * 5.1 - dist / lockRange - centerBias;
    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }
  return best;
}

function spawnMissile(owner, target) {
  if (!owner.alive || owner.missileAmmo <= 0 || !target?.alive) return false;
  const index = owner.missiles.findIndex((m) => m.visible);
  if (index < 0) return false;
  const attachedMesh = owner.missiles[index];
  attachedMesh.visible = false;

  const missile = attachedMesh.clone(true);
  attachedMesh.getWorldPosition(missileLaunchPos);
  missileLaunchForward.set(1, 0, 0).applyQuaternion(owner.mesh.quaternion).normalize();
  missile.position.copy(missileLaunchPos).addScaledVector(missileLaunchForward, 3.2);
  missile.quaternion.copy(owner.mesh.quaternion);
  const cruiseSpeed = MISSILE_SPEED;
  missile.userData = {
    owner,
    teamId: owner.teamId,
    visualTeam: owner.isPlayer ? "player" : "bot",
    target,
    velocity: new THREE.Vector3().copy(missileLaunchForward).multiplyScalar(cruiseSpeed),
    cruiseSpeed,
    life: 10.5,
    smokeTick: 0,
    motorTick: 0,
    prevPosition: new THREE.Vector3().copy(missile.position),
  };
  world.add(missile);
  game.missiles.push(missile);
  owner.missileAmmo -= 1;
  owner.missileCooldown = 0.32;
  return true;
}

function updateEffects(dt) {
  game.playerHitTimer = Math.max(0, game.playerHitTimer - dt);
  game.hitConfirmTimer = Math.max(0, game.hitConfirmTimer - dt);
  game.missileIncomingTimer = Math.max(0, game.missileIncomingTimer - dt);
  healthEl.classList.toggle("flash", game.playerHitTimer > 0);
  crosshairEl.classList.toggle("hit", game.hitConfirmTimer > 0);
  if (missileWarningEl) missileWarningEl.hidden = game.missileIncomingTimer <= 0;

  for (let i = game.effects.length - 1; i >= 0; i--) {
    const fx = game.effects[i];
    fx.life -= dt;
    fx.mesh.scale.multiplyScalar(1 + (fx.scaleRate ?? 0) * dt);

    if (fx.kind === "muzzle" && fx.followOwner?.mesh && fx.hasFollowLocal) {
      tmpVecA.copy(fx.followLocal);
      fx.followOwner.mesh.localToWorld(tmpVecA);
      tmpVecB.set(1, 0, 0).applyQuaternion(fx.followOwner.mesh.quaternion).normalize();
      fx.mesh.position.copy(tmpVecA).addScaledVector(tmpVecB, fx.followForwardOffset ?? MUZZLE_FLASH_FORWARD_OFFSET);
      fx.mesh.quaternion.setFromUnitVectors(AXIS_X, tmpVecB);
    }

    const maxLife = Math.max(0.001, fx.maxLife ?? 0.24);
    const lifeRatio = Math.max(0, Math.min(1, fx.life / maxLife));

    if (fx.kind === "muzzle") {
      const baseOpacity = fx.baseOpacity ?? MUZZLE_FLASH_BASE_OPACITY;
      if (Array.isArray(fx.materials) && fx.materials.length > 0) {
        const scales = fx.materialOpacityScales || [];
        for (let m = 0; m < fx.materials.length; m++) {
          const mat = fx.materials[m];
          if (!mat) continue;
          mat.opacity = baseOpacity * lifeRatio * (scales[m] ?? 1);
        }
      } else if (fx.mesh.material) {
        fx.mesh.material.opacity = baseOpacity * lifeRatio;
      }
    } else if (fx.mesh.material) {
      fx.mesh.material.opacity = (fx.baseOpacity ?? 1) * lifeRatio;
    }

    if (fx.life <= 0) {
      releaseEffect(fx);
      game.effects.splice(i, 1);
    }
  }
}

function keepInArena(plane) {
  const p = plane.mesh.position;
  let hitBoundary = false;
  let hitX = 0;
  let hitZ = 0;

  if (p.x > ARENA) {
    p.x = ARENA;
    plane.velocity.x = Math.min(plane.velocity.x, 0) * 0.35;
    hitBoundary = true;
    hitX = -1;
  } else if (p.x < -ARENA) {
    p.x = -ARENA;
    plane.velocity.x = Math.max(plane.velocity.x, 0) * 0.35;
    hitBoundary = true;
    hitX = 1;
  }

  if (p.z > ARENA) {
    p.z = ARENA;
    plane.velocity.z = Math.min(plane.velocity.z, 0) * 0.35;
    hitBoundary = true;
    hitZ = -1;
  } else if (p.z < -ARENA) {
    p.z = -ARENA;
    plane.velocity.z = Math.max(plane.velocity.z, 0) * 0.35;
    hitBoundary = true;
    hitZ = 1;
  }

  if (hitBoundary) {
    if (plane.isPlayer) {
      plane.speed = Math.max(150, plane.speed * 0.9);
    } else {
      tmpVecD.set(hitX, 0, hitZ);
      if (tmpVecD.lengthSq() < 1e-4) getWallEscapeDirection(p, plane.velocity, tmpVecD);
      else tmpVecD.normalize();
      const faceId = hitX !== 0 && hitZ !== 0 ? "corner" : hitX < 0 ? "posX" : hitX > 0 ? "negX" : hitZ < 0 ? "posZ" : "negZ";
      p.addScaledVector(tmpVecD, 26);
      if (!plane.wallHitLatch) {
        plane.wallHitLatch = true;
        bounceBotOffWall(plane, tmpVecD, faceId);
      }
    }
  } else if (!plane.isPlayer) {
    plane.wallHitLatch = false;
  }
  p.y = clamp(p.y, FLOOR_Y + 90, WORLD_FLIGHT_CEILING_Y);
}

function collidePlaneWithObstacles(plane, previousPosition) {
  if (!intersectsObstacle(plane.mesh.position, 12)) {
    plane.isColliding = false;
    return false;
  }

  if (plane.isPlayer) {
    plane.mesh.position.copy(previousPosition);

    let closestBox = null;
    let closestDist = Infinity;
    for (const box of staticObstacles) {
      const d = box.distanceToPoint(plane.mesh.position);
      if (d < closestDist) {
        closestDist = d;
        closestBox = box;
      }
    }

    if (closestBox) {
      closestBox.getCenter(tmpVecC);
      const away = tmpVecA.subVectors(plane.mesh.position, tmpVecC);
      away.y = 0;
      if (away.lengthSq() < 1e-4) away.set(Math.sign(Math.random() - 0.5), 0, Math.sign(Math.random() - 0.5));
      away.normalize();
      plane.mesh.position.addScaledVector(away, 22);
      plane.velocity.addScaledVector(away, 180);
    }

    plane.velocity.multiplyScalar(0.35);
    plane.speed = Math.max(150, plane.speed * 0.9);
    plane.isColliding = true;
    return true;
  }

  let closestBox = null;
  let closestDist = Infinity;
  for (const box of staticObstacles) {
    const d = box.distanceToPoint(plane.mesh.position);
    if (d < closestDist) {
      closestDist = d;
      closestBox = box;
    }
  }

  if (closestBox) {
    resolveObstacleSlide(plane, closestBox, previousPosition, tmpVecA);
    registerBotObstacleBounce(plane, tmpVecA);
  } else {
    plane.mesh.position.copy(previousPosition);
  }

  plane.speed = Math.max(150, plane.speed * 0.82);
  plane.isColliding = true;
  return true;
}

function applyPlaneFlightControls(plane, controls, dt, outForward = tmpVecA) {
  const rollInput = clamp(controls.roll || 0, -1, 1);
  const pitchInput = clamp(controls.pitch || 0, -1, 1);
  const rollIntent = clamp(controls.rollIntent ?? rollInput, -1, 1);
  const pitchIntent = clamp(controls.pitchIntent ?? pitchInput, -1, 1);
  const throttleInput = clamp(controls.throttle || 0, -1, 1);
  const boostLevel = clamp(controls.boostLevel || 0, 0, 1);
  const realismAssistOff = plane.isPlayer && !controls.autoLevel;
  const referenceSpeed = realismAssistOff
    ? Math.max(plane.velocity.length(), plane.speed || MANUAL_FLIGHT_ASSIST_OFF_CRUISE_SPEED)
    : plane.speed;
  const controlAuthority = realismAssistOff
    ? clamp(
      (referenceSpeed - MANUAL_FLIGHT_ASSIST_OFF_MIN_SPEED)
      / Math.max(1, MANUAL_FLIGHT_ASSIST_OFF_FULL_SPEED - MANUAL_FLIGHT_ASSIST_OFF_MIN_SPEED),
      0,
      1
    )
    : 1;
  const rollResponse = realismAssistOff
    ? THREE.MathUtils.lerp(MANUAL_FLIGHT_ASSIST_OFF_MIN_AUTHORITY, 1, controlAuthority)
    : 1;
  const pitchResponse = realismAssistOff
    ? THREE.MathUtils.lerp(MANUAL_FLIGHT_ASSIST_OFF_MIN_AUTHORITY + 0.08, 1, controlAuthority)
    : 1;

  if (realismAssistOff) {
    if (plane.velocity.lengthSq() < 1e-6) {
      outForward.set(1, 0, 0).applyQuaternion(plane.mesh.quaternion).normalize();
      plane.velocity.copy(outForward).multiplyScalar(Math.max(referenceSpeed, MANUAL_FLIGHT_ASSIST_OFF_CRUISE_SPEED));
    }

    const targetRollRate = rollIntent * MANUAL_FLIGHT_ASSIST_OFF_MAX_ROLL_RATE * rollResponse;
    const targetPitchRate = pitchIntent * MANUAL_FLIGHT_ASSIST_OFF_MAX_PITCH_RATE * pitchResponse;
    const rateBlendRoll = clamp(MANUAL_FLIGHT_ASSIST_OFF_ROLL_RATE_RESPONSE * dt, 0, 1);
    const rateBlendPitch = clamp(MANUAL_FLIGHT_ASSIST_OFF_PITCH_RATE_RESPONSE * dt, 0, 1);
    plane.rollRate = THREE.MathUtils.lerp(plane.rollRate || 0, targetRollRate, rateBlendRoll);
    plane.pitchRate = THREE.MathUtils.lerp(plane.pitchRate || 0, targetPitchRate, rateBlendPitch);
    const rollDamping = Math.max(
      0,
      1 - MANUAL_FLIGHT_ASSIST_OFF_RATE_DAMPING * dt * (Math.abs(rollIntent) < 0.04 ? 1 : 0.28)
    );
    const pitchDamping = Math.max(
      0,
      1 - MANUAL_FLIGHT_ASSIST_OFF_RATE_DAMPING * dt * (Math.abs(pitchIntent) < 0.04 ? 1 : 0.32)
    );
    plane.rollRate *= rollDamping;
    plane.pitchRate *= pitchDamping;

    qLocalPitch.setFromAxisAngle(AXIS_Z, plane.pitchRate * dt);
    qLocalRoll.setFromAxisAngle(AXIS_X, -plane.rollRate * dt);
    plane.mesh.quaternion.multiply(qLocalPitch).multiply(qLocalRoll).normalize();
    syncPlaneAnglesFromQuaternion(plane);

    outForward.set(1, 0, 0).applyQuaternion(plane.mesh.quaternion).normalize();
    planeUpVec.set(0, 1, 0).applyQuaternion(plane.mesh.quaternion).normalize();

    const bankRatio = clamp(Math.sqrt(Math.max(0, 1 - planeUpVec.y * planeUpVec.y)), 0, 1);
    const pullLoad = clamp(
      Math.max(pitchIntent, 0) * 0.62
      + (Math.max(plane.pitchRate, 0) / Math.max(0.001, MANUAL_FLIGHT_ASSIST_OFF_MAX_PITCH_RATE)) * 0.38,
      0,
      1
    );
    const currentSpeed = Math.max(plane.velocity.length(), 1);
    const speedSqFactor = clamp(
      Math.pow(currentSpeed / Math.max(1, MANUAL_FLIGHT_ASSIST_OFF_CRUISE_SPEED), MANUAL_FLIGHT_ASSIST_OFF_LIFT_SPEED_EXP),
      0.22,
      1.65
    );
    const bankLiftRetention = THREE.MathUtils.lerp(
      MANUAL_FLIGHT_ASSIST_OFF_BANK_LIFT_MIN,
      1,
      clamp(Math.max(planeUpVec.y, 0), 0, 1)
    );
    const liftAccel = (
      MANUAL_FLIGHT_ASSIST_OFF_BASE_LIFT * speedSqFactor
      + pullLoad * MANUAL_FLIGHT_ASSIST_OFF_PULL_LIFT * THREE.MathUtils.lerp(0.74, 1.08, speedSqFactor / 1.65)
    ) * bankLiftRetention;
    const engineThrottle = clamp((throttleInput + 1) * 0.5, 0, 1);
    const thrustAccel = THREE.MathUtils.lerp(
      MANUAL_FLIGHT_ASSIST_OFF_BASE_THRUST,
      MANUAL_FLIGHT_ASSIST_OFF_MAX_THRUST,
      engineThrottle
    ) + boostLevel * MANUAL_FLIGHT_ASSIST_OFF_BOOST_THRUST;

    tmpVecB.copy(plane.velocity).normalize();
    const parasiteDragAccel = currentSpeed * currentSpeed * MANUAL_FLIGHT_ASSIST_OFF_PARASITE_DRAG;
    const inducedDragAccel = liftAccel * (
      MANUAL_FLIGHT_ASSIST_OFF_INDUCED_DRAG
      + bankRatio * MANUAL_FLIGHT_ASSIST_OFF_BANK_INDUCED_DRAG
      + pullLoad * MANUAL_FLIGHT_ASSIST_OFF_PULL_INDUCED_DRAG
    );

    // OFF mode uses one consistent velocity integration path: thrust, lift, gravity, then drag.
    tmpVecC.set(0, 0, 0);
    tmpVecC.addScaledVector(outForward, thrustAccel);
    tmpVecC.addScaledVector(planeUpVec, liftAccel);
    tmpVecC.addScaledVector(WORLD_UP, -MANUAL_FLIGHT_ASSIST_OFF_GRAVITY);
    tmpVecC.addScaledVector(
      tmpVecB,
      -(parasiteDragAccel + inducedDragAccel + (1 - controlAuthority) * MANUAL_FLIGHT_ASSIST_OFF_LOW_SPEED_DRAG)
    );

    plane.velocity.addScaledVector(tmpVecC, dt);

    const nextSpeed = plane.velocity.length();
    if (nextSpeed > 1e-4) {
      tmpVecB.copy(plane.velocity).multiplyScalar(1 / nextSpeed);
      qInverse.copy(plane.mesh.quaternion).invert();
      tmpVecE.copy(tmpVecB).applyQuaternion(qInverse);

      const yawSlip = Math.atan2(tmpVecE.z, Math.max(1e-4, tmpVecE.x));
      const pitchSlip = Math.atan2(tmpVecE.y, Math.max(1e-4, Math.hypot(tmpVecE.x, tmpVecE.z)));
      qLocalYaw.setFromAxisAngle(AXIS_Y, -clamp(yawSlip, -0.55, 0.55) * MANUAL_FLIGHT_ASSIST_OFF_ALIGN_YAW_RATE * dt);
      qLocalPitchAssist.setFromAxisAngle(AXIS_Z, clamp(pitchSlip, -0.45, 0.45) * MANUAL_FLIGHT_ASSIST_OFF_ALIGN_PITCH_RATE * dt);
      plane.mesh.quaternion.multiply(qLocalYaw).multiply(qLocalPitchAssist).normalize();
      syncPlaneAnglesFromQuaternion(plane);
      outForward.set(1, 0, 0).applyQuaternion(plane.mesh.quaternion).normalize();
    }

    plane.speed = clamp(plane.velocity.length(), 0, 560 + BOOST_SPEED_BONUS_MAX);
    updatePlaneExhaust(plane, boostLevel);
    return outForward;
  }

  plane.speed = clamp(plane.speed + throttleInput * dt * 170, 150, 560);

  const rollNeutral = Math.abs(rollIntent) < 0.06;
  const rollTarget = rollInput * MAX_BANK;
  const pitchTarget = pitchInput * MAX_PITCH;
  plane.roll = smoothApproach(plane.roll, rollTarget, BANK_RATE * rollResponse, dt);
  plane.pitch = smoothApproach(plane.pitch, pitchTarget, PITCH_RATE * pitchResponse, dt);

  if (controls.autoLevel && rollNeutral) {
    plane.roll = smoothApproach(plane.roll, 0, LEVEL_RATE, dt);
  }
  plane.rollRate = 0;
  plane.pitchRate = 0;
  plane.roll = clamp(plane.roll, -MAX_BANK, MAX_BANK);
  plane.pitch = clamp(plane.pitch, -MAX_PITCH, MAX_PITCH);

  const bankRatio = Math.abs(plane.roll) / MAX_BANK;
  const yawRate = TURN_RATE * (plane.roll / MAX_BANK);
  plane.yaw += yawRate * dt;

  qYaw.setFromAxisAngle(AXIS_Y, plane.yaw);
  qPitch.setFromAxisAngle(AXIS_Z, plane.pitch);
  qRoll.setFromAxisAngle(AXIS_X, -plane.roll);

  qMove.copy(qYaw).multiply(qPitch);
  qVisual.copy(qMove).multiply(qRoll);
  plane.mesh.quaternion.copy(qVisual);

  outForward.set(1, 0, 0).applyQuaternion(qMove).normalize();
  const targetSpeed = plane.speed + boostLevel * BOOST_SPEED_BONUS_MAX;
  updatePlaneExhaust(plane, boostLevel);
  tmpVecD.copy(outForward).multiplyScalar(targetSpeed);
  plane.velocity.lerp(tmpVecD, 0.08);
  return outForward;
}

function getBotControlInputs(bot, mode, desiredDir, distToTarget = 0, out = botControlState) {
  tmpVecA.set(1, 0, 0).applyQuaternion(bot.mesh.quaternion).normalize();
  tmpVecB.copy(desiredDir);
  if (tmpVecB.lengthSq() < 1e-6) tmpVecB.copy(tmpVecA);
  else tmpVecB.normalize();

  out.roll = clamp(-tmpVecC.copy(tmpVecA).cross(tmpVecB).y, -1, 1);
  out.pitch = clamp(tmpVecB.y - tmpVecA.y, -1, 1);
  out.rollIntent = out.roll;
  out.pitchIntent = out.pitch;

  let throttle = 0.35;
  let boostLevel = 0;
  if (mode === BOT_MODE_INTERCEPT) {
    throttle = 1;
    boostLevel = distToTarget > 1500 ? 1 : distToTarget > 950 ? 0.68 : 0.18;
  } else if (mode === BOT_MODE_PURSUIT) {
    throttle = distToTarget > BOT_PREFERRED_RANGE_MAX ? 0.82 : distToTarget < BOT_PREFERRED_RANGE_MIN ? 0.12 : 0.45;
    boostLevel = distToTarget > 980 ? 0.44 : 0;
  } else if (mode === BOT_MODE_REPOSITION) {
    throttle = 0.58;
    boostLevel = distToTarget > 760 ? 0.3 : 0;
  } else if (mode === BOT_MODE_REGROUP) {
    throttle = 0.42;
    boostLevel = 0;
  } else if (mode === BOT_MODE_WALL_RETURN) {
    throttle = 0.72;
    boostLevel = 0.58;
  }

  if ((bot.speed || 0) < 185) throttle = Math.max(throttle, 0.72);
  out.throttle = clamp(throttle, 0, 1);
  out.boostLevel = clamp(boostLevel, 0, 1);
  out.autoLevel = false;
  return out;
}

function updateBotBoostState(bot, controls, dt) {
  const requestedBoost = clamp(controls.boostLevel || 0, 0, 1);
  const currentFuel = bot.boostFuel ?? BOOST_FUEL_MAX;
  const boostLevel = requestedBoost > 0 && currentFuel > 0.01 ? requestedBoost : 0;
  const boostJustEnded = !!bot.boostWasActive && boostLevel <= 0;
  bot.boostWasActive = boostLevel > 0;

  if (boostJustEnded) {
    const speedAfterBoost = Math.min(560, bot.velocity.length());
    bot.speed = Math.max(bot.speed, speedAfterBoost);
  }

  if (boostLevel > 0) {
    const burnRate = BOOST_FUEL_BURN_BASE_PER_SEC * boostLevel * (1 + BOOST_FUEL_BURN_CURVE * boostLevel * boostLevel);
    bot.boostFuel = Math.max(0, currentFuel - burnRate * dt);
  } else {
    bot.boostFuel = Math.min(BOOST_FUEL_MAX, currentFuel + 12 * dt);
  }

  controls.boostLevel = boostLevel;
  return boostLevel;
}

function clearBotCombatTarget(bot) {
  bot.target = null;
  bot.targetHoldTimer = 0;
  bot.wallTargetTimer = 0;
  bot.repositionTimer = 0;
  bot.attackWindowTimer = 0;
  bot.burstTimer = 0;
  resetBotAttackState(bot);
}

function shouldExitWallReturn(bot, wallPlan, dt) {
  if (!bot || bot.wallState === "none") return false;
  if (wallPlan.wallUnsafe) {
    bot.wallUnsafeHoldTimer = Math.max(0, bot.wallUnsafeHoldTimer) + dt;
    return false;
  }
  bot.wallUnsafeHoldTimer = Math.min(0, bot.wallUnsafeHoldTimer) - dt;
  return (
    wallPlan.clearance >= BOT_WALL_EXIT_CLEARANCE
    && wallPlan.timeToWall > wallPlan.timeNeeded * 1.6
    && bot.wallUnsafeHoldTimer <= -BOT_WALL_SAFE_EXIT_HOLD_TIME
  );
}


function updatePlayer(dt) {
  const p = game.player;
  if (!p) return;
  if (!p.alive || game.over) {
    updateCamera(dt);
    return;
  }

  p.cooldown -= dt;
  p.missileCooldown -= dt;

  if (
    game.boostAutoDropAt != null
    && performance.now() >= game.boostAutoDropAt
  ) {
    boostLeverState.applyLevel?.(0);
    game.boostAutoDropAt = null;
  }

  const boostAllowed = game.boostAutoDropAt == null && game.boostFuel > 0.01;
  const boostLevel = input.boostLevel > 0 && boostAllowed ? input.boostLevel : 0;
  const boostJustEnded = game.playerBoostWasActive && boostLevel <= 0;
  game.playerBoostWasActive = boostLevel > 0;

  if (boostJustEnded) {
    const speedAfterBoost = Math.min(560, p.velocity.length());
    p.speed = Math.max(p.speed, speedAfterBoost);
  }

  if (boostLevel > 0) {
    const boostFuelBurnRate = BOOST_FUEL_BURN_BASE_PER_SEC * boostLevel * (1 + BOOST_FUEL_BURN_CURVE * boostLevel * boostLevel);
    game.boostFuel = Math.max(0, game.boostFuel - boostFuelBurnRate * dt);
    if (game.boostFuel <= 0.01) {
      game.boostFuel = 0;
      if (!isMobile && (keys.has("ShiftLeft") || keys.has("ShiftRight"))) {
        game.shiftBoostRelatchRequired = true;
      }
      if (boostLeverState.level > 0 && game.boostAutoDropAt == null) {
        game.boostAutoDropAt = performance.now() + 1000;
      }
    }
  } else if (game.boostAutoDropAt == null) {
    game.boostFuel = Math.min(BOOST_FUEL_MAX, game.boostFuel + 12 * dt);
  } else {
    game.boostFuel = 0;
  }

  playerControlState.roll = input.roll;
  playerControlState.pitch = input.pitch;
  playerControlState.rollIntent = input.rollIntent;
  playerControlState.pitchIntent = input.pitchIntent;
  playerControlState.throttle = input.throttle;
  playerControlState.boostLevel = boostLevel;

  playerControlState.autoLevel = game.activeMatchConfig?.autoLevelEnabled ?? selectedAutoLevelEnabled;
  applyPlaneFlightControls(p, playerControlState, dt, playerForwardVec);

  const prevPos = p.prevPosition;
  prevPos.copy(p.mesh.position);
  p.mesh.position.addScaledVector(p.velocity, dt);

  if (p.mesh.position.y < FLOOR_Y + 92) {
    p.mesh.position.y = FLOOR_Y + 92;
    p.velocity.y = Math.abs(p.velocity.y) * 0.2;
  }

  keepInArena(p);
  collidePlaneWithObstacles(p, prevPos);
  updateCamera(dt);

  if (!input.fire) game.ammo = Math.min(100, game.ammo + 9 * dt);

  if (input.fire && p.cooldown <= 0 && game.ammo >= 1) {
    spawnBullet(p, 0x95efff);
    game.ammo = Math.max(0, game.ammo - 1);
    p.cooldown = 0.095;
  }

  if (game.missileLockTarget?.alive) {
    const lockTargetPos = getLockAimPoint(game.missileLockTarget, tmpVecA);
    const toTarget = lockTargetPos.sub(camera.position);
    const dist = toTarget.length();
    const aimForward = playerLockAimForwardVec.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const dot = aimForward.dot(toTarget.normalize());
    const inRange = dist <= MISSILE_LOCK_DROP_RANGE;
    const inSight = dot >= MISSILE_LOCK_DROP_DOT && hasLineOfSight(camera.position, game.missileLockTarget);

    if (!inRange) {
      game.missileLockTarget = null;
      game.missileLockLostTimer = 0;
    } else if (inSight) {
      game.missileLockLostTimer = 0;
    } else {
      game.missileLockLostTimer += dt;
      if (game.missileLockLostTimer >= 1) {
        game.missileLockTarget = null;
        game.missileLockLostTimer = 0;
      }
    }
  } else {
    game.missileLockLostTimer = 0;
  }

  if (input.lockTogglePressed) {
    if (!game.missileLockTarget) {
      game.missileLockTarget = getBestLockTarget(p);
      game.missileLockLostTimer = 0;
    } else {
      game.missileLockTarget = null;
      game.missileLockLostTimer = 0;
    }
  }

  if (input.missileLaunchPressed && game.missileLockTarget && p.missileAmmo > 0 && p.missileCooldown <= 0) {
    if (spawnMissile(p, game.missileLockTarget)) {
      game.missileLockTarget = null;
      game.missileLockLostTimer = 0;
    }
  }
}

function resetBotAttackState(bot) {
  bot.attackWindowTimer = 0;
  bot.burstTimer = 0;
  bot.missileTarget = null;
  bot.missileLockHoldTimer = 0;
  bot.missileLockHoldDuration = rand(BOT_MISSILE_LOCK_HOLD_MIN, BOT_MISSILE_LOCK_HOLD_MAX);
}

function getFriendlyTargetPressure(bot, target) {
  if (!bot || !target) return 0;

  let pressure = 0;
  for (const mate of game.bots) {
    if (mate === bot || !mate?.alive || !mate?.mesh) continue;
    if (!isSameTeam(mate, bot)) continue;
    if (mate.target !== target) continue;

    const distSq = mate.mesh.position.distanceToSquared(target.mesh.position);
    pressure += distSq < 1200 * 1200 ? 1 : 0.45;
  }
  return pressure;
}

function scoreBotCombatTarget(bot, target, targetWallUnsafe = false) {
  const toTarget = tmpVecA.subVectors(target.mesh.position, bot.mesh.position);
  const dist = toTarget.length();
  if (dist <= 1e-3) return -Infinity;
  if (targetWallUnsafe && target !== bot.target) return -Infinity;

  const dir = toTarget.multiplyScalar(1 / dist);
  const forward = tmpVecB.set(1, 0, 0).applyQuaternion(bot.mesh.quaternion).normalize();
  let score = 1.9 - dist / 900;
  score += forward.dot(dir) * 0.9;
  score += hasLineOfSight(bot.mesh.position, target) ? 0.65 : -0.35;
  if (target === bot.target) score += 0.35;
  score -= getFriendlyTargetPressure(bot, target) * BOT_TARGET_CROWDING_PENALTY;
  return score;
}

function selectBotCombatTarget(bot, dt) {
  bot.targetHoldTimer = Math.max(0, (bot.targetHoldTimer || 0) - dt);

  if (bot.wallState !== "none" || bot.wallPostReturnTimer > 0) {
    clearBotCombatTarget(bot);
    return null;
  }

  let currentTargetUnsafe = false;
  if (bot.target?.alive) {
    currentTargetUnsafe = computeWallDanger(bot.target, botTargetWallPlan).wallUnsafe;
    if (currentTargetUnsafe) {
      bot.wallTargetTimer = Math.min(BOT_WALL_TARGET_DROP_TIME * 2, (bot.wallTargetTimer || 0) + dt);
    } else {
      bot.wallTargetTimer = Math.max(0, (bot.wallTargetTimer || 0) - dt * 3.4);
    }
  } else {
    bot.wallTargetTimer = 0;
  }

  const currentRejected = !bot.target?.alive || bot.wallTargetTimer >= BOT_WALL_TARGET_DROP_TIME;
  if (currentRejected) {
    clearBotCombatTarget(bot);
  } else if (bot.target?.alive && bot.targetHoldTimer > 0) {
    return bot.target;
  }

  const candidates = getHostilePlanes(bot, true);

  let best = null;
  let bestScore = -Infinity;
  for (const target of candidates) {
    const targetWallUnsafe = computeWallDanger(target, botTargetWallPlan).wallUnsafe;
    const score = scoreBotCombatTarget(bot, target, targetWallUnsafe);
    if (score > bestScore) {
      bestScore = score;
      best = target;
    }
  }
  if (!Number.isFinite(bestScore) || bestScore === -Infinity) best = null;

  if (best !== bot.target) {
    bot.target = best;
    bot.targetHoldTimer = best ? BOT_TARGET_HOLD_TIME : 0;
    bot.wallTargetTimer = 0;
    bot.engagementTimer = 0;
    bot.repositionTimer = 0;
    bot.repositionSide = 0;
    resetBotAttackState(bot);
    bot.regroupTimer = best ? 0 : Math.max(bot.regroupTimer || 0, rand(BOT_REGROUP_MIN_TIME, BOT_REGROUP_MAX_TIME));
  } else if (!best && bot.regroupTimer <= 0) {
    bot.regroupTimer = rand(BOT_REGROUP_MIN_TIME, BOT_REGROUP_MAX_TIME);
  }

  return best;
}

function updateBots(dt) {
  for (const b of game.bots) {
    if (!b.alive) continue;

    b.cooldown -= dt;
    b.missileCooldown -= dt;
    b.wallRecoverTimer = Math.max(0, (b.wallRecoverTimer || 0) - dt);
    b.wallContactCooldown = Math.max(0, (b.wallContactCooldown || 0) - dt);
    b.wallReturnTimer = Math.max(0, (b.wallReturnTimer || 0) - dt);
    b.wallPostReturnTimer = Math.max(0, (b.wallPostReturnTimer || 0) - dt);
    b.repositionTimer = Math.max(0, (b.repositionTimer || 0) - dt);
    b.regroupTimer = Math.max(0, (b.regroupTimer || 0) - dt);
    b.obstacleBounceWindow = Math.max(0, (b.obstacleBounceWindow || 0) - dt);
    b.obstacleClimbTimer = Math.max(0, (b.obstacleClimbTimer || 0) - dt);
    if (b.obstacleBounceWindow <= 0) b.obstacleBounceCount = 0;

    computeWallDanger(b, botWallTurnPlan);
    if (botWallTurnPlan.wallUnsafe) {
      b.wallUnsafeHoldTimer = Math.max(0, b.wallUnsafeHoldTimer || 0) + dt;
      if (b.wallState === "none" && b.wallUnsafeHoldTimer >= BOT_WALL_UNSAFE_HOLD_TIME) {
        enterBotWallReturn(b, "unsafe", botWallTurnPlan, BOT_WALL_RETURN_MAX_TIME);
      }
    } else if (b.wallState === "none") {
      b.wallUnsafeHoldTimer = 0;
    }

    if (shouldExitWallReturn(b, botWallTurnPlan, dt)) {
      b.wallState = "none";
      b.wallFaceId = null;
      b.wallReturnTimer = 0;
      b.wallRecoverTimer = 0;
      b.wallPostReturnTimer = Math.max(b.wallPostReturnTimer || 0, BOT_POST_WALL_REGROUP_TIME);
      b.regroupTimer = Math.max(b.regroupTimer || 0, BOT_POST_WALL_REGROUP_TIME);
      b.wallUnsafeHoldTimer = 0;
    }

    const wallReturnActive = b.wallState !== "none" || b.wallRecoverTimer > 0 || b.wallReturnTimer > 0;

    botForwardVec.set(1, 0, 0).applyQuaternion(b.mesh.quaternion).normalize();
    botProbeSideVec.crossVectors(botForwardVec, AXIS_Y);
    if (botProbeSideVec.lengthSq() < 1e-4) botProbeSideVec.set(0, 0, 1);
    else botProbeSideVec.normalize();
    botProbeUpVec.crossVectors(botProbeSideVec, botForwardVec).normalize();
    if (botProbeUpVec.lengthSq() < 1e-4) botProbeUpVec.copy(AXIS_Y);

    if (wallReturnActive || b.wallPostReturnTimer > 0) clearBotCombatTarget(b);
    else b.target = selectBotCombatTarget(b, dt);

    const hasTarget = !!b.target;
    const stillRegrouping = b.regroupTimer > 0 || b.wallPostReturnTimer > 0;
    const shouldRegroup = !hasTarget || stillRegrouping;
    let canFightTarget = hasTarget && !shouldRegroup && !wallReturnActive;

    if (canFightTarget) {
      getLockAimPoint(b.target, botAimPointVec);
    } else if (wallReturnActive) {
      botAimPointVec.copy(b.wallReturnAnchor);
    } else {
      projectPointIntoCombatRing(b.safeAnchor, BOT_COMBAT_RING_SOFT * 0.94, botAimPointVec);
    }

    botToTargetVec.copy(botAimPointVec).sub(b.mesh.position);
    const dist = Math.max(1, botToTargetVec.length());
    if (botToTargetVec.lengthSq() > 1e-6) botDesiredVec.copy(botToTargetVec).multiplyScalar(1 / dist);
    else botDesiredVec.copy(botForwardVec);

    if (canFightTarget) getPlaneTravelForward(b.target, botTargetForwardVec);
    else if (botDesiredVec.lengthSq() > 1e-4) botTargetForwardVec.copy(botDesiredVec);
    else botTargetForwardVec.copy(botForwardVec);

    botTargetRightVec.crossVectors(botTargetForwardVec, AXIS_Y);
    if (botTargetRightVec.lengthSq() < 1e-4) botTargetRightVec.set(0, 0, 1);
    else botTargetRightVec.normalize();
    botTargetUpVec.crossVectors(botTargetRightVec, botTargetForwardVec).normalize();
    if (botTargetUpVec.lengthSq() < 1e-4) botTargetUpVec.copy(AXIS_Y);

    if (canFightTarget && !b.repositionSide) {
      b.repositionSide = pickBotRepositionSide(b, botTargetForwardVec, botDesiredVec);
    }

    let losToTarget = false;
    let rearScore = 0;
    let leadAimDot = 0;
    botLeadVec.set(0, 0, 0);
    if (canFightTarget) {
      losToTarget = hasLineOfSight(b.mesh.position, b.target);
      const leadTime = clamp(dist / 780, 0.14, 0.55);
      botLeadVec.copy(b.target.velocity).multiplyScalar(leadTime);
      botAimDirVec.copy(botAimPointVec).add(botLeadVec).sub(b.mesh.position);
      if (botAimDirVec.lengthSq() > 1e-6) botAimDirVec.normalize();
      else botAimDirVec.copy(botDesiredVec);
      rearScore = clamp(botTargetForwardVec.dot(botDesiredVec), -1, 1);
      leadAimDot = clamp(botForwardVec.dot(botAimDirVec), -1, 1);
      const attackOpportunity = losToTarget && dist < BOT_ATTACK_ALIGN_RANGE && leadAimDot > 0.28 && rearScore > -0.7;
      if (attackOpportunity) {
        b.attackWindowTimer = Math.min(1.35, (b.attackWindowTimer || 0) + dt * 1.2);
      } else {
        b.attackWindowTimer = Math.max(0, (b.attackWindowTimer || 0) - dt * BOT_ATTACK_WINDOW_DECAY);
        b.burstTimer = Math.max(0, (b.burstTimer || 0) - dt * BOT_ATTACK_WINDOW_DECAY);
      }
    } else {
      b.attackWindowTimer = 0;
      b.burstTimer = 0;
      botAimDirVec.copy(botDesiredVec);
    }

    botAvoidVec.copy(obstacleAvoidance(b.mesh.position, botForwardVec, 150, botProbeSideVec, botProbeUpVec)).multiplyScalar(1.85);
    botSteerVec.copy(obstacleAvoidance(b.mesh.position, botForwardVec, 235, botProbeSideVec, botProbeUpVec));
    botAvoidVec.addScaledVector(botSteerVec, 0.9);
    botTrafficAvoidVec.copy(getBotTrafficAvoidance(b, botTrafficAvoidVec));
    if (botTrafficAvoidVec.lengthSq() > 1e-4) {
      const trafficWeight = shouldRegroup ? 1.18 : canFightTarget ? 0.88 : 1.02;
      botAvoidVec.addScaledVector(botTrafficAvoidVec, BOT_TEAM_SEPARATION_WEIGHT * trafficWeight);
    }
    const obstacleThreatLevel = obstacleThreat(b.mesh.position, botForwardVec);
    const obstacleClimbLevel = clamp((b.obstacleClimbTimer || 0) / BOT_OBSTACLE_CLIMB_TIME, 0, 1);

    if (canFightTarget && !wallReturnActive && b.repositionTimer <= 0) {
      const poorShot = !losToTarget || leadAimDot < 0.5 || rearScore < -0.24;
      if (dist < 1150 && poorShot) b.engagementTimer += dt;
      else b.engagementTimer = Math.max(0, b.engagementTimer - dt * 1.9);

      if (!isTargetTooCloseToWall(b.target, b) && (dist < BOT_PREFERRED_RANGE_MIN || (b.engagementTimer > BOT_REPOSITION_STALE_TIME && dist < 1100))) {
        beginBotReposition(b, pickBotRepositionSide(b, botTargetForwardVec, botDesiredVec));
      }
    }

    let mode = BOT_MODE_PURSUIT;
    if (wallReturnActive) mode = BOT_MODE_WALL_RETURN;
    else if (shouldRegroup) mode = BOT_MODE_REGROUP;
    else if (b.repositionTimer > 0) mode = BOT_MODE_REPOSITION;
    else if (dist > BOT_INTERCEPT_RANGE) mode = BOT_MODE_INTERCEPT;
    setBotMode(b, mode);

    const formationSlot = b.formationSlot || 0;
    const formationSideBias = clamp(formationSlot * BOT_FORMATION_SIDE_GAP, -220, 220);
    const formationVerticalBias = clamp(formationSlot * BOT_FORMATION_VERTICAL_GAP, -48, 48);
    const altitudeErr = clamp((botAimPointVec.y - b.mesh.position.y) / 260, -1, 1);

    if (mode === BOT_MODE_WALL_RETURN) {
      botSteerVec.copy(b.wallReturnAnchor).sub(b.mesh.position);
      if (botWallTurnPlan.avoidDir.lengthSq() > 1e-4) botSteerVec.addScaledVector(botWallTurnPlan.avoidDir, 1.05);
      if (botAvoidVec.lengthSq() > 1e-4) botSteerVec.addScaledVector(botAvoidVec, 0.35);
      botSteerVec.y += clamp((b.wallReturnAnchor.y - b.mesh.position.y) / 220, -0.2, 0.2);
      if (botSteerVec.lengthSq() < 1e-6) botSteerVec.copy(botForwardVec);
      else botSteerVec.normalize();
    } else if (mode === BOT_MODE_REGROUP) {
      projectPointIntoCombatRing(b.safeAnchor, BOT_COMBAT_RING_SOFT * 0.94, botSteerVec);
      botSteerVec.sub(b.mesh.position);
      if (botAvoidVec.lengthSq() > 1e-4) botSteerVec.addScaledVector(botAvoidVec, 0.7);
      botSteerVec.y += clamp((b.safeAnchor.y - b.mesh.position.y) / 220, -0.2, 0.2);
      if (obstacleClimbLevel > 0) botSteerVec.y = Math.max(botSteerVec.y, 0.34 + obstacleClimbLevel * 0.52);
      if (botSteerVec.lengthSq() < 1e-6) botSteerVec.copy(botForwardVec);
      else botSteerVec.normalize();
    } else {
      let rearOffset = clamp(dist * 0.24, 140, 240);
      let sideOffset = b.repositionSide * clamp(45 + (1 - Math.max(0, rearScore)) * 120, 45, 180) + formationSideBias;
      let verticalOffset = clamp((botAimPointVec.y - b.mesh.position.y) * 0.22, -60, 60) + formationVerticalBias;

      if (mode === BOT_MODE_INTERCEPT) {
        if (dist > BOT_HARD_INTERCEPT_RANGE) {
          rearOffset = 0;
          sideOffset = formationSideBias * 0.82;
          verticalOffset = clamp((botAimPointVec.y - b.mesh.position.y) * 0.1 + formationVerticalBias, -35, 45);
          botLeadVec.copy(b.target.velocity).multiplyScalar(clamp(dist / 920, 0.1, 0.35));
        } else {
          rearOffset = clamp(dist * 0.12, 60, 120);
          sideOffset = b.repositionSide * clamp(dist * 0.07, 80, 160) + formationSideBias * 0.78;
        }
      } else if (mode === BOT_MODE_REPOSITION) {
        rearOffset = clamp(dist * 0.18, 100, 170);
        sideOffset = b.repositionSide * clamp(dist * 0.18, 180, 320) + formationSideBias * 0.55;
        verticalOffset = clamp(verticalOffset + 55, -40, 110);
      }

      botSteerVec.copy(botAimPointVec).add(botLeadVec);
      botSteerVec.addScaledVector(botTargetForwardVec, -rearOffset);
      botSteerVec.addScaledVector(botTargetRightVec, sideOffset);
      botSteerVec.addScaledVector(botTargetUpVec, verticalOffset);
      botSteerVec.sub(b.mesh.position);
      botSteerVec.addScaledVector(botAvoidVec, (mode === BOT_MODE_REPOSITION ? 1.18 : 0.92) + obstacleThreatLevel * 1.05);
      botSteerVec.y += altitudeErr * (mode === BOT_MODE_REPOSITION ? 0.3 : 0.22);
      if (obstacleThreatLevel > 0.01) botSteerVec.y = Math.max(botSteerVec.y, 0.12 + obstacleThreatLevel * 0.34);
      if (obstacleClimbLevel > 0) botSteerVec.y = Math.max(botSteerVec.y, 0.28 + obstacleClimbLevel * 0.56);
      if (botSteerVec.lengthSq() < 1e-6) botSteerVec.copy(botForwardVec);
      else botSteerVec.normalize();
      if (mode === BOT_MODE_INTERCEPT && dist > BOT_HARD_INTERCEPT_RANGE) {
        botSteerVec.lerp(botDesiredVec, 0.46).normalize();
      }
      if (b.attackWindowTimer > BOT_ATTACK_WINDOW_BUILD && mode !== BOT_MODE_REPOSITION) {
        const attackBlend = clamp((mode === BOT_MODE_INTERCEPT ? 0.24 : 0.36) + Math.max(0, rearScore) * 0.14 - obstacleThreatLevel * 0.1, 0.16, 0.42);
        botSteerVec.lerp(botAimDirVec, attackBlend).normalize();
      }
    }

    getBotControlInputs(b, mode, botSteerVec, dist, botControlState);
    updateBotBoostState(b, botControlState, dt);
    applyPlaneFlightControls(b, botControlState, dt, botNewForwardVec);

    const prevPos = b.prevPosition;
    prevPos.copy(b.mesh.position);
    b.mesh.position.addScaledVector(b.velocity, dt);
    if (b.mesh.position.y < FLOOR_Y + 110) b.mesh.position.y += 120 * dt;

    keepInArena(b);
    collidePlaneWithObstacles(b, prevPos);

    botProgressVec.copy(b.mesh.position).sub(prevPos);
    const movedDist = botProgressVec.length();
    const expectedDist = Math.max(1, b.speed * dt);
    if (botWallTurnPlan.wallUnsafe && movedDist < expectedDist * BOT_STUCK_PROGRESS_RATIO) {
      b.stuckTimer += dt;
    } else {
      b.stuckTimer = Math.max(0, b.stuckTimer - dt * 1.8);
    }
    if (b.stuckTimer > 0.55) {
      getWallSlideDirection(b.mesh.position, b.velocity, botRecoveryVec);
      beginBotRecovery(b, botRecoveryVec, rand(BOT_RECOVER_MIN_TIME, BOT_RECOVER_MAX_TIME));
    }

    if (!canFightTarget || mode === BOT_MODE_WALL_RETURN || mode === BOT_MODE_REGROUP) {
      b.burstTimer = 0;
      if (b.missileTarget) {
        b.missileTarget = null;
        b.missileLockHoldTimer = 0;
      }
      continue;
    }

    const firingPoint = getBotAimPoint(b, botAimPointVec);
    botAimDirVec.copy(firingPoint).sub(b.mesh.position);
    if (botAimDirVec.lengthSq() <= 1e-6) {
      botAimDirVec.copy(botNewForwardVec);
    } else {
      botAimDirVec.normalize();
    }
    const aimDot = clamp(botNewForwardVec.dot(botAimDirVec), -1, 1);
    botToTargetVec.copy(b.target.mesh.position).sub(b.mesh.position);
    const fireDist = Math.max(1, botToTargetVec.length());
    botDesiredVec.copy(botToTargetVec).normalize();
    getPlaneTravelForward(b.target, botTargetForwardVec);
    const fireRearScore = clamp(botTargetForwardVec.dot(botDesiredVec), -1, 1);
    const fireLos = hasLineOfSight(b.mesh.position, b.target);
    const rearFireWindow = fireRearScore > -0.04 && aimDot > 0.66;
    const sideFireWindow = fireRearScore > -0.45 && aimDot > 0.76 && fireDist < 620;
    const incidentalFrontWindow = fireRearScore < -0.75 && aimDot > 0.97 && fireDist < 240;
    const interceptSnapWindow = mode === BOT_MODE_INTERCEPT && fireDist < 420 && aimDot > 0.86;
    const canOpenBurst = fireDist >= BOT_GUN_MIN_RANGE
      && fireDist <= BOT_GUN_MAX_RANGE
      && fireLos
      && (rearFireWindow || sideFireWindow || incidentalFrontWindow || interceptSnapWindow);
    if (canOpenBurst && (b.attackWindowTimer > BOT_ATTACK_WINDOW_BUILD || b.burstTimer > 0)) {
      if (b.burstTimer <= 0) b.burstTimer = rand(BOT_BURST_MIN_TIME, BOT_BURST_MAX_TIME);
    }
    if (b.burstTimer > 0) b.burstTimer = Math.max(0, b.burstTimer - dt);
    if (b.cooldown <= 0 && b.burstTimer > 0 && canOpenBurst) {
      spawnBullet(b, 0xffb67e);
      b.cooldown = mode === BOT_MODE_PURSUIT ? 0.07 : 0.085;
    }

    if (b.missileAmmo > 0 && b.missileCooldown <= 0) {
      const noLaunchPhase = game.matchElapsed < 5;
      const targetWallSafe = !isTargetTooCloseToWall(b.target, b);
      const missileWindow = !noLaunchPhase
        && (mode === BOT_MODE_INTERCEPT || mode === BOT_MODE_PURSUIT)
        && targetWallSafe
        && fireLos
        && fireDist >= BOT_MISSILE_MIN_RANGE
        && fireDist <= BOT_MISSILE_MAX_RANGE
        && b.attackWindowTimer > BOT_ATTACK_WINDOW_BUILD
        && aimDot > 0.76
        && fireRearScore > -0.32;

      if (missileWindow) {
        if (b.missileTarget !== b.target) {
          b.missileTarget = b.target;
          b.missileLockHoldTimer = 0;
          b.missileLockHoldDuration = rand(BOT_MISSILE_LOCK_HOLD_MIN, BOT_MISSILE_LOCK_HOLD_MAX);
        } else {
          b.missileLockHoldTimer += dt;
        }

        if (b.missileLockHoldTimer >= b.missileLockHoldDuration) {
          spawnMissile(b, b.missileTarget);
          b.missileLockHoldTimer = 0;
          b.missileTarget = null;
          b.missileLockHoldDuration = rand(BOT_MISSILE_LOCK_HOLD_MIN, BOT_MISSILE_LOCK_HOLD_MAX);
        }
      } else if (b.missileTarget) {
        b.missileTarget = null;
        b.missileLockHoldTimer = 0;
      }
    }
  }
}

function vibrateOnHit() {
  const vib = navigator.vibrate;
  if (typeof vib !== "function") return;
  const now = performance.now();
  if (now - lastHitVibeAt < 90) return;
  lastHitVibeAt = now;
  navigator.vibrate(18);
}

function hitPlane(plane, dmg, attackerTeam = null, attacker = null) {
  if (!plane.alive) return;
  plane.hp -= dmg;
  const impactColor = plane.isPlayer ? 0xff7a6e : (isPlayerFriendly(plane) ? 0x7beaff : 0xffc17d);
  spawnImpactFx(plane.mesh.position, impactColor);
  if (plane.isPlayer && attacker) game.playerHitTimer = 0.18;
  if (!plane.isPlayer && attacker?.isPlayer && !isSameTeam(plane, attacker)) {
    game.hitConfirmTimer = 0.16;
    vibrateOnHit();
  }
  if (plane.hp <= 0) {
    plane.alive = false;
    plane.mesh.visible = false;
    if (!plane.isPlayer && attacker?.isPlayer && !isSameTeam(plane, attacker)) game.score += 100;
  }
}

function updateBullets(dt) {
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    const prevPos = tmpVecC.copy(b.position);
    b.position.addScaledVector(b.userData.vel, dt);
    b.userData.life -= dt;

    let hitObstacle = false;
    if (staticObstacleMeshes.length > 0) {
      const stepDistance = tmpVecD.copy(b.position).sub(prevPos).length();
      if (stepDistance > 1e-4) {
        const stepDir = tmpVecB.copy(b.position).sub(prevPos).normalize();
        bulletStepRaycaster.set(prevPos, stepDir);
        bulletStepRaycaster.near = 0;
        bulletStepRaycaster.far = stepDistance + 1.6;
        const obstacleHits = bulletStepRaycaster.intersectObjects(staticObstacleMeshes, false);
        if (obstacleHits.length > 0) {
          const hitPos = obstacleHits[0].point;
          b.position.copy(hitPos);
          spawnImpactFx(hitPos, 0xffee9a);
          b.userData.life = -1;
          hitObstacle = true;
        }
      }
    }

    if (!hitObstacle && intersectsObstacle(b.position, 2.5)) {
      spawnImpactFx(b.position, 0xffee9a);
      b.userData.life = -1;
    }

    const targets = getDamageablePlanes(b.userData.owner);
    for (const t of targets) {
      if (!t || !t.alive || t === b.userData.owner) continue;
      if (b.position.distanceToSquared(t.mesh.position) < 23 * 23) {
        hitPlane(t, 3, b.userData.teamId, b.userData.owner);
        b.userData.life = -1;
        break;
      }
    }

    if (b.userData.life <= 0 || Math.abs(b.position.x) > ARENA * 1.3 || Math.abs(b.position.z) > ARENA * 1.3 || b.position.y < FLOOR_Y - 20 || b.position.y > WORLD_PROJECTILE_CEILING_Y) {
      world.remove(b);
      game.bullets.splice(i, 1);
    }
  }
}
function updateMissiles(dt) {
  const playerPos = game.player?.mesh?.position;

  for (let i = game.missiles.length - 1; i >= 0; i--) {
    const m = game.missiles[i];
    const data = m.userData;
    data.life -= dt;
    const prevPos = data.prevPosition;
    prevPos.copy(m.position);

    const target = data.target;
    if (target?.alive) {
      getLockAimPoint(target, missileTargetCenterVec);
      missileToTargetVec.copy(missileTargetCenterVec).sub(m.position);
      const dist = Math.max(1, missileToTargetVec.length());
      const leadTime = clamp(dist / Math.max(data.cruiseSpeed, 1), 0.08, 0.8);
      missileAimPointVec.copy(missileTargetCenterVec).addScaledVector(target.velocity, leadTime * 0.88);
      missileDesiredDirVec.copy(missileAimPointVec).sub(m.position);
      if (missileDesiredDirVec.lengthSq() > 1e-6) {
        missileDesiredDirVec.normalize();
        missileCurrentDirVec.copy(data.velocity).normalize();
        missileCurrentDirVec.lerp(missileDesiredDirVec, clamp(MISSILE_TURN_RATE * dt, 0, 0.27)).normalize();
        data.velocity.copy(missileCurrentDirVec).multiplyScalar(data.cruiseSpeed);
        m.quaternion.setFromUnitVectors(AXIS_X, missileCurrentDirVec);
      }
    }

    m.position.addScaledVector(data.velocity, dt);

    data.motorTick += dt;
    if (data.motorTick > 0.03) {
      data.motorTick = 0;
      spawnMissileJetTrail(m.position, data.velocity);
    }

    data.smokeTick += dt;
    if (data.smokeTick > 0.06) {
      data.smokeTick = 0;
      spawnMissileSmokeTrail(m.position, data.velocity);
    }

    let exploded = false;
    const targets = getDamageablePlanes(data.owner);
    for (const t of targets) {
      if (!t?.alive || t === data.owner) continue;
      const seg = tmpVecA.subVectors(m.position, prevPos);
      const segLenSq = Math.max(1e-6, seg.lengthSq());
      const targetCenter = getLockAimPoint(t, tmpVecB);
      const toCenter = tmpVecC.subVectors(targetCenter, prevPos);
      const proj = clamp(toCenter.dot(seg) / segLenSq, 0, 1);
      const closest = tmpVecD.copy(prevPos).addScaledVector(seg, proj);
      if (closest.distanceToSquared(targetCenter) < 30 * 30) {
        hitPlane(t, 30, data.teamId, data.owner);
        exploded = true;
        break;
      }
    }

    if (!exploded && intersectsObstacle(m.position, MISSILE_BODY_COLLISION_RADIUS)) {
      if (target?.alive && target !== data.owner && m.position.distanceToSquared(getLockAimPoint(target, tmpVecA)) < 95 * 95) {
        hitPlane(target, 30, data.teamId, data.owner);
      }
      exploded = true;
    }

    if (!exploded && (Math.abs(m.position.x) > ARENA * 1.02 || Math.abs(m.position.z) > ARENA * 1.02 || m.position.y < FLOOR_Y + 4 || m.position.y > WORLD_PROJECTILE_CEILING_Y)) {
      exploded = true;
    }

    if (!exploded && playerPos && data.owner && isHostilePlane(data.owner, game.player)) {
      const distPlayer = missileToPlayerVec.copy(playerPos).sub(m.position).length();
      if (distPlayer > 1e-4) {
        missileToPlayerVec.multiplyScalar(1 / distPlayer);
        const facingPlayer = missileCurrentDirVec.copy(data.velocity).normalize().dot(missileToPlayerVec);
        if (facingPlayer > 0.66 && distPlayer < 760) game.missileIncomingTimer = 0.24;
      }
    }

    if (exploded || data.life <= 0) {
      spawnMissileExplosion(m.position);
      world.remove(m);
      game.missiles.splice(i, 1);
    }
  }
}

function updateCamera(dt) {
  cameraZoom.value = smoothApproach(cameraZoom.value, cameraZoom.target, 7.5, dt);

  const p = game.player;
  if (!p) {
    if (cockpitOverlayEl) cockpitOverlayEl.classList.remove("is-active");
    document.body.classList.remove("cockpit-active");
    camera.position.lerp(MENU_CAMERA_POSITION, 1 - Math.exp(-dt * 2.2));
    updateBackdropFollowers(camera.position);
    camera.up.copy(WORLD_UP);
    camera.lookAt(MENU_CAMERA_LOOK_AT);
    if (Math.abs(camera.fov - CAMERA_DEFAULT_FOV) > 0.01 || Math.abs(camera.near - CAMERA_DEFAULT_NEAR) > 0.001) {
      camera.fov = CAMERA_DEFAULT_FOV;
      camera.near = CAMERA_DEFAULT_NEAR;
      camera.updateProjectionMatrix();
    }
    return;
  }

  if (cockpitOverlayEl) {
    const cockpitReady = cockpitOverlayEl.dataset.maskReady === "true";
    const cockpitBlend = cameraZoom.target;
    const cockpitActive = cockpitReady && cockpitBlend >= 0.965;
    cockpitOverlayEl.classList.toggle("is-active", cockpitActive);
    document.body.classList.toggle("cockpit-active", cockpitActive);
    if (cockpitActive) updateCockpitOverlayLayout();
  }

  camForwardVec.set(1, 0, 0).applyQuaternion(p.mesh.quaternion).normalize();
  camUpVec.set(0, 1, 0).applyQuaternion(p.mesh.quaternion).normalize();
  camRightVec.crossVectors(camForwardVec, camUpVec).normalize();

  camOffsetVec.copy(CAMERA_THIRD_PERSON_OFFSET).lerp(CAMERA_COCKPIT_OFFSET, cameraZoom.value);

  camPosTarget.copy(p.mesh.position)
    .addScaledVector(camForwardVec, camOffsetVec.x)
    .addScaledVector(camUpVec, camOffsetVec.y)
    .addScaledVector(camRightVec, camOffsetVec.z);

  const lookAhead = THREE.MathUtils.lerp(208, 320, cameraZoom.value);
  const lookUp = THREE.MathUtils.lerp(18, 4.5, cameraZoom.value);
  camLookTarget.copy(p.mesh.position)
    .addScaledVector(camForwardVec, lookAhead)
    .addScaledVector(camUpVec, lookUp);

  camera.position.lerp(camPosTarget, 1 - Math.exp(-dt * 9.5));
  updateBackdropFollowers(camera.position);
  const cockpitImmersion = clamp((cameraZoom.value - 0.9) / 0.1, 0, 1);
  camBlendedUp.copy(WORLD_UP).lerp(camUpVec, cockpitImmersion).normalize();
  camera.up.copy(camBlendedUp);
  camera.lookAt(camLookTarget);

  const nextFov = THREE.MathUtils.lerp(CAMERA_DEFAULT_FOV, CAMERA_COCKPIT_FOV, cameraZoom.value);
  const nextNear = THREE.MathUtils.lerp(CAMERA_DEFAULT_NEAR, CAMERA_COCKPIT_NEAR, cameraZoom.value);
  if (Math.abs(camera.fov - nextFov) > 0.01 || Math.abs(camera.near - nextNear) > 0.001) {
    camera.fov = nextFov;
    camera.near = nextNear;
    camera.updateProjectionMatrix();
  }

  p.mesh.visible = p.alive && cameraZoom.value < 0.985;
}

function updateState() {
  const player = game.player;
  if (!player) return;

  const aliveHostiles = getAliveHostileCountForPlayer();
  const lockTarget = game.missileLockTarget;

  game.bots.forEach((bot) => {
    const visible = bot === lockTarget && bot.alive && isPlayerHostile(bot);
    if (visible && !bot.lockOutline) ensureLockOutline(bot);
    if (!bot.lockOutline) return;

    bot.lockOutline.visible = visible;
    if (!visible) return;

    const dist = player.mesh.position.distanceTo(bot.mesh.position);
    const emphasis = clamp((dist - 220) / 1500, 0, 1);
    const lineOpacity = clamp((0.58 + emphasis * 0.26) * 1.8, 0, 0.70);
    const scaleMul = 1.08 + emphasis * 0.16;
    const lineMat = bot.lockOutline.userData?.lineMat;
    if (lineMat) lineMat.opacity = lineOpacity;

    bot.lockOutline.children.forEach((child) => {
      const base = child.userData.baseScale;
      if (base) child.scale.copy(base).multiplyScalar(scaleMul);
    });
  });

  updateFriendlyMarkers();
  updateHudHealthPanel();
  setHudTextIfChanged(ammoEl, "ammoText", `MSL ${player.missileAmmo} | AMMO ${Math.round(game.ammo)}`);
  setHudTextIfChanged(boostStatEl, "boostText", `BOOST ${Math.round((game.boostFuel / BOOST_FUEL_MAX) * 100)}%`);
  setHudTextIfChanged(missileBtn, "missileButtonText", lockTarget && isPlayerHostile(lockTarget) ? "LOCK OFF" : "LOCK ON");

  if (lockTarget?.alive && isPlayerHostile(lockTarget)) {
    setHudTextIfChanged(lockOnCueEl, "lockCueText", `LOCK ON ${lockTarget.callsign || "EN"}`);
    setHudHiddenIfChanged(lockOnCueEl, "lockCueHidden", false);
  } else {
    setHudHiddenIfChanged(lockOnCueEl, "lockCueHidden", true);
  }

  setHudTextIfChanged(lockCancelBtn, "lockCancelText", "LAUNCH");
  setHudHiddenIfChanged(lockCancelBtn, "lockCancelHidden", !(lockTarget && isPlayerHostile(lockTarget)));

  if (!player.alive && !game.over) {
    game.over = true;
    messageEl.hidden = false;
    messageEl.textContent = "YOU LOSE";
  }

  if (game.initialEnemyCount > 0 && aliveHostiles === 0 && player.alive && !game.over) {
    game.over = true;
    messageEl.hidden = false;
    messageEl.textContent = "YOU WIN";
  }
}

function clearPlaneHpLabel(plane) {
  if (plane?.hpLabel) {
    world.remove(plane.hpLabel);
    plane.hpLabel = null;
  }
  disposeLockOutline(plane);
  disposeFriendlyMarker(plane);
}

function clearMatchEntities() {
  for (const b of game.bullets) world.remove(b);
  game.bullets = [];
  for (const m of game.missiles) world.remove(m);
  game.missiles = [];
  if (game.player) {
    clearPlaneHpLabel(game.player);
    world.remove(game.player.mesh);
    game.player = null;
  }
  for (const b of game.bots) {
    clearPlaneHpLabel(b);
    world.remove(b.mesh);
  }
  game.bots = [];
  clearActiveEffects();
  invalidateHudCache();
}

function resetMatchState() {
  game.score = 0;
  game.ammo = 100;
  game.boostFuel = BOOST_FUEL_MAX;
  game.playerHitTimer = 0;
  game.hitConfirmTimer = 0;
  game.boostAutoDropAt = null;
  game.missileLockTarget = null;
  game.missileIncomingTimer = 0;
  game.missileLockLostTimer = 0;
  game.shiftBoostRelatchRequired = false;
  game.lockToggleButtonLatch = false;
  game.lockToggleTapQueuedCount = 0;
  game.missileLaunchTapQueuedCount = 0;
  game.matchElapsed = 0;
  game.playerBoostWasActive = false;
  game.over = false;
  game.initialBots = 0;
  game.initialEnemyCount = 0;
  game.activeMatchConfig = null;
  healthEl.classList.remove("flash");
  crosshairEl.classList.remove("hit");
  messageEl.hidden = true;
  messageEl.textContent = "";
  invalidateHudCache();
  boostLeverState.applyLevel?.(0);
  keys.clear();
  stickInput.pitch = 0;
  stickInput.yaw = 0;
  stickInput.active = false;
  input.roll = 0;
  input.pitch = 0;
  input.rollIntent = 0;
  input.pitchIntent = 0;
  input.yaw = 0;
  input.throttle = 0;
  input.boost = false;
  input.boostLevel = 0;
  input.fire = false;
  input.lockToggle = false;
  input.lockTogglePressed = false;
  input.missileLaunchPressed = false;
}

function setMenuCameraPose() {
  camera.position.copy(MENU_CAMERA_POSITION);
  camera.up.copy(WORLD_UP);
  camera.lookAt(MENU_CAMERA_LOOK_AT);
  updateBackdropFollowers(camera.position);
}

function setPlaneFacingDirection(plane, direction) {
  if (!plane?.mesh || !direction?.lengthSq?.() || direction.lengthSq() <= 1e-6) return;
  tmpVecA.copy(direction).normalize();
  const flat = Math.hypot(tmpVecA.x, tmpVecA.z);
  if (flat > 1e-4) plane.yaw = Math.atan2(-tmpVecA.z, tmpVecA.x);
  plane.pitch = clamp(Math.atan2(tmpVecA.y, Math.max(1e-4, flat)), -MAX_PITCH * 0.82, MAX_PITCH * 0.82);
  plane.roll = 0;
  plane.rollRate = 0;
  plane.pitchRate = 0;
  qYaw.setFromAxisAngle(AXIS_Y, plane.yaw);
  qPitch.setFromAxisAngle(AXIS_Z, plane.pitch);
  qRoll.setFromAxisAngle(AXIS_X, 0);
  qMove.copy(qYaw).multiply(qPitch);
  qVisual.copy(qMove).multiply(qRoll);
  plane.mesh.quaternion.copy(qVisual);
  plane.velocity.copy(tmpVecA).multiplyScalar(Math.max(plane.speed || 220, 200));
}

function trimPlayerIntoAssistOffFlight(plane) {
  if (!plane?.mesh) return;
  tmpVecA.set(1, 0, 0).applyQuaternion(plane.mesh.quaternion).normalize();
  const carrySpeed = clamp(
    Math.min(
      Math.max(plane.velocity.length(), plane.speed || MANUAL_FLIGHT_ASSIST_OFF_CRUISE_SPEED),
      MANUAL_FLIGHT_ASSIST_OFF_CRUISE_SPEED + 22
    ),
    MANUAL_FLIGHT_ASSIST_OFF_CRUISE_SPEED * 0.94,
    MANUAL_FLIGHT_ASSIST_OFF_CRUISE_SPEED + 22
  );
  tmpVecB.copy(tmpVecA).multiplyScalar(carrySpeed);
  const maxUpwardCarry = carrySpeed * 0.04;
  tmpVecB.y = clamp(tmpVecB.y, -carrySpeed * 0.18, maxUpwardCarry);
  plane.velocity.copy(tmpVecB);
  plane.speed = carrySpeed;
}

function syncPlaneAnglesFromQuaternion(plane) {
  if (!plane?.mesh) return;
  tmpVecA.set(1, 0, 0).applyQuaternion(plane.mesh.quaternion).normalize();
  const flat = Math.hypot(tmpVecA.x, tmpVecA.z);
  if (flat > 1e-4) plane.yaw = Math.atan2(-tmpVecA.z, tmpVecA.x);
  plane.pitch = Math.atan2(tmpVecA.y, Math.max(1e-4, flat));

  planeUpVec.set(0, 1, 0).applyQuaternion(plane.mesh.quaternion).normalize();
  planeRefRightVec.crossVectors(tmpVecA, WORLD_UP);
  if (planeRefRightVec.lengthSq() <= 1e-6) {
    plane.roll = 0;
    return;
  }
  planeRefRightVec.normalize();
  planeRefUpVec.crossVectors(planeRefRightVec, tmpVecA).normalize();
  const bankSin = planeBankCrossVec.crossVectors(planeRefUpVec, planeUpVec).dot(tmpVecA);
  const bankCos = clamp(planeRefUpVec.dot(planeUpVec), -1, 1);
  plane.roll = -Math.atan2(bankSin, bankCos);
}

function findSpawnPosition(basePosition, spreadXZ = 140, spreadY = 70, minDistanceFromPlayer = 0) {
  const out = new THREE.Vector3().copy(basePosition);
  for (let tries = 0; tries < 40; tries++) {
    out.set(
      clamp(basePosition.x + rand(-spreadXZ, spreadXZ), -ARENA * 0.78, ARENA * 0.78),
      clamp(basePosition.y + rand(-spreadY, spreadY), 220, 860),
      clamp(basePosition.z + rand(-spreadXZ, spreadXZ), -ARENA * 0.78, ARENA * 0.78)
    );
    if (intersectsObstacle(out, 26)) continue;
    if (game.player && minDistanceFromPlayer > 0 && out.distanceToSquared(game.player.mesh.position) < minDistanceFromPlayer * minDistanceFromPlayer) continue;
    return out.clone();
  }
  return out.clone();
}

const EDGE_SPAWN_INSET = 340;
const EDGE_SPAWN_ALTITUDE = 330;
const EDGE_SPAWN_LANE_LIMIT = ARENA - EDGE_SPAWN_INSET - 340;
const FFA_EDGE_SPAWN_SLOTS = [
  { faceId: "negX", laneOffset: 0 },
  { faceId: "posX", laneOffset: 0 },
  { faceId: "negZ", laneOffset: 0 },
  { faceId: "posZ", laneOffset: 0 },
  { faceId: "negZ", laneOffset: 980 },
  { faceId: "posZ", laneOffset: -980 },
];

function getCombatCenterPoint(out = tmpVecA) {
  return out.set(0, EDGE_SPAWN_ALTITUDE, 0);
}

function getEdgeSpawnBase(faceId, laneOffset = 0, altitude = EDGE_SPAWN_ALTITUDE, inwardOffset = 0, out = tmpVecA) {
  const edge = ARENA - EDGE_SPAWN_INSET - inwardOffset;
  const lane = clamp(laneOffset, -EDGE_SPAWN_LANE_LIMIT, EDGE_SPAWN_LANE_LIMIT);
  switch (faceId) {
    case "posX":
      return out.set(edge, altitude, lane);
    case "negX":
      return out.set(-edge, altitude, lane);
    case "posZ":
      return out.set(lane, altitude, edge);
    case "negZ":
    default:
      return out.set(lane, altitude, -edge);
  }
}

function findEdgeSpawnPosition(faceId, laneOffset = 0, altitude = EDGE_SPAWN_ALTITUDE, minDistanceFromPlayer = 0, lateralJitter = 90, altitudeJitter = 30) {
  const out = new THREE.Vector3();
  for (let tries = 0; tries < 40; tries++) {
    getEdgeSpawnBase(
      faceId,
      laneOffset + rand(-lateralJitter, lateralJitter),
      clamp(altitude + rand(-altitudeJitter, altitudeJitter), 240, 760),
      rand(0, 54),
      out
    );
    if (intersectsObstacle(out, 26)) continue;
    if (game.player && minDistanceFromPlayer > 0 && out.distanceToSquared(game.player.mesh.position) < minDistanceFromPlayer * minDistanceFromPlayer) continue;
    return out.clone();
  }
  return getEdgeSpawnBase(faceId, laneOffset, altitude, 18, out).clone();
}

function getBotIngressAnchor(spawnPos, out = tmpVecA) {
  out.copy(spawnPos).multiplyScalar(0.4);
  out.y = clamp(spawnPos.y + rand(-18, 18), 260, 420);
  return projectPointIntoCombatRing(out, BOT_COMBAT_RING_SOFT * 0.88, out);
}

function getTeamEdgeLaneOffsets(count, spacing = 420, avoidCenter = false) {
  if (count <= 0) return [];
  if (count === 1) return [avoidCenter ? spacing * 1.15 : 0];
  const base = Array.from({ length: count }, (_, i) => (i - (count - 1) * 0.5) * spacing);
  if (!avoidCenter || count % 2 === 0) return base;
  return base.map((offset) => (offset < 0 ? offset - spacing * 0.5 : offset + spacing * 0.5));
}

function assignPlaneIdentity(plane, teamId, teamRole, callsign) {
  plane.teamId = teamId;
  plane.teamRole = teamRole;
  plane.callsign = callsign;
}

function updateTeamEnemyButtons() {
  const maxEnemyCount = Math.max(1, MAX_MATCH_BOTS - selectedTeamAllyCount);
  selectedTeamEnemyCount = clamp(selectedTeamEnemyCount, 1, maxEnemyCount);

  startTeamEnemyButtons.forEach((btn) => {
    const count = Number(btn.dataset.teamEnemies);
    btn.disabled = !Number.isFinite(count) || count > maxEnemyCount;
  });

  const activeEnemyBtn = startTeamEnemyButtons.find((btn) => Number(btn.dataset.teamEnemies) === selectedTeamEnemyCount);
  if (activeEnemyBtn) setActiveTapButton(startTeamEnemyButtons, activeEnemyBtn);
}

function syncStartMenuUiLegacyDoNotUse() {
  syncSelectionButtons();
  updateTeamEnemyButtons();
  if (startSoloWrapEl) startSoloWrapEl.hidden = selectedMatchMode !== MATCH_MODE_FFA;
  if (startTeamWrapEl) startTeamWrapEl.hidden = selectedMatchMode !== MATCH_MODE_TEAM;
  const hudBotWrapEl = botCountEl?.closest?.(".menu-control");
  if (hudBotWrapEl) hudBotWrapEl.hidden = selectedMatchMode !== MATCH_MODE_FFA;
  if (startMenuNoteEl) {
    startMenuNoteEl.textContent = selectedMatchMode === MATCH_MODE_TEAM
      ? `チーム戦: 味方 bot ${selectedTeamAllyCount} 機 / 敵 bot ${selectedTeamEnemyCount} 機。味方は狙わないが、通常弾もミサイルも当たります。`
      : `個人戦: プレイヤーも bot 同士も全員が敵です。bot 数は ${selectedBotCount} 機。`;
  }
  syncPendingMatchConfig();
}

function getStartMenuNoteTextLegacyDoNotUse() {
  const modeText = selectedMatchMode === MATCH_MODE_TEAM
    ? `チーム戦: 味方 bot ${selectedTeamAllyCount} 機 / 敵 bot ${selectedTeamEnemyCount} 機。同チームは狙わないが、通常弾もミサイルも当たります。`
    : `個人戦: プレイヤーも bot 同士も全員が敵です。bot 数は ${selectedBotCount} 機。`;
  const autoLevelText = selectedAutoLevelEnabled
    ? "水平補正 ON: ロール入力を離すと機体が自然に水平へ戻ります。"
    : "水平補正 OFF: 自動で水平に戻らず、傾きが残る難しい操作になります。";
  return `${modeText} ${autoLevelText}`;
}

function getStartMenuNoteText() {
  const modeText = selectedMatchMode === MATCH_MODE_TEAM
    ? `チーム戦: 味方 bot ${selectedTeamAllyCount} 機 / 敵 bot ${selectedTeamEnemyCount} 機。同チームは狙わないが、通常弾もミサイルも当たります。`
    : `個人戦: プレイヤーも bot 同士も全員が敵です。bot 数は ${selectedBotCount} 機。`;
  const autoLevelText = selectedAutoLevelEnabled
    ? "水平補正 ON: ロール入力を離すと機体が自然に水平へ戻ります。"
    : "水平補正 OFF: バンクが残り、旋回中は沈みやすく、強く引くと減速しやすくなります。";
  return `${modeText} ${autoLevelText}`;
}

function syncSelectionButtons() {
  const activeSoloBtn = botCountButtons.find((btn) => Number(btn.dataset.botCount) === selectedBotCount);
  if (activeSoloBtn) setActiveTapButton(botCountButtons, activeSoloBtn);

  const activeHudMapBtn = mapTypeButtons.find((btn) => btn.dataset.mapType === selectedMapType);
  if (activeHudMapBtn) setActiveTapButton(mapTypeButtons, activeHudMapBtn);

  const activeModeBtn = startModeButtons.find((btn) => btn.dataset.matchMode === selectedMatchMode);
  if (activeModeBtn) setActiveTapButton(startModeButtons, activeModeBtn);

  const activeStartSoloBtn = startSoloBotButtons.find((btn) => Number(btn.dataset.soloBotCount) === selectedBotCount);
  if (activeStartSoloBtn) setActiveTapButton(startSoloBotButtons, activeStartSoloBtn);

  const activeAllyBtn = startTeamAllyButtons.find((btn) => Number(btn.dataset.teamAllies) === selectedTeamAllyCount);
  if (activeAllyBtn) setActiveTapButton(startTeamAllyButtons, activeAllyBtn);

  const activeStartMapBtn = startMapButtons.find((btn) => btn.dataset.startMapType === selectedMapType);
  if (activeStartMapBtn) setActiveTapButton(startMapButtons, activeStartMapBtn);

  const activeStartAutoLevelBtn = startAutoLevelButtons.find((btn) => parseAutoLevelValue(btn.dataset.autoLevel) === selectedAutoLevelEnabled);
  if (activeStartAutoLevelBtn) setActiveTapButton(startAutoLevelButtons, activeStartAutoLevelBtn);

  const activeAutoLevelBtn = autoLevelButtons.find((btn) => parseAutoLevelValue(btn.dataset.autoLevel) === selectedAutoLevelEnabled);
  if (activeAutoLevelBtn) setActiveTapButton(autoLevelButtons, activeAutoLevelBtn);
}

function syncStartMenuUi() {
  syncSelectionButtons();
  updateTeamEnemyButtons();
  if (startSoloWrapEl) startSoloWrapEl.hidden = selectedMatchMode !== MATCH_MODE_FFA;
  if (startTeamWrapEl) startTeamWrapEl.hidden = selectedMatchMode !== MATCH_MODE_TEAM;
  const hudBotWrapEl = botCountEl?.closest?.(".menu-control");
  if (hudBotWrapEl) hudBotWrapEl.hidden = selectedMatchMode !== MATCH_MODE_FFA;
  if (startMenuNoteEl) {
    startMenuNoteEl.textContent = getStartMenuNoteText();
  }
  syncPendingMatchConfig();
}

function hideStartMenu() {
  if (startMenuOverlayEl) startMenuOverlayEl.hidden = true;
  document.body.classList.remove("start-menu-active");
}

function closeMenuPanel() {
  menuPanel.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
}

function showStartMenu() {
  clearMatchEntities();
  resetMatchState();
  game.phase = "menu";
  syncStartMenuUi();
  if (startMenuOverlayEl) startMenuOverlayEl.hidden = false;
  document.body.classList.add("start-menu-active");
  closeMenuPanel();
  setMenuCameraPose();
}

function spawnFreeForAllBots(botCount) {
  const botPalettes = [
    { body: 0xff8a3d, wing: 0x2ff7ff, accent: 0xff2fb3, cockpit: 0x12314c },
    { body: 0x7cff4c, wing: 0xff5de4, accent: 0x3d8bff, cockpit: 0x1a2340 },
    { body: 0xfff04a, wing: 0x32ff9f, accent: 0xff4c4c, cockpit: 0x35214d },
    { body: 0x57d0ff, wing: 0xff8c42, accent: 0xa14dff, cockpit: 0x1c2f45 },
    { body: 0xff62a8, wing: 0x6aff55, accent: 0x32a0ff, cockpit: 0x2b2648 },
    { body: 0x3effd5, wing: 0xff6a3d, accent: 0xd85dff, cockpit: 0x1e3243 },
  ];

  game.bots = Array.from({ length: botCount }, (_, i) => {
    const bot = createFighter(botPalettes[i % botPalettes.length]);
    const slot = FFA_EDGE_SPAWN_SLOTS[Math.min(i + 1, FFA_EDGE_SPAWN_SLOTS.length - 1)];
    const spawnPos = findEdgeSpawnPosition(slot.faceId, slot.laneOffset, EDGE_SPAWN_ALTITUDE + rand(-16, 16), 540, 70, 22);
    bot.mesh.position.copy(spawnPos);
    bot.safeAnchor.copy(getBotIngressAnchor(spawnPos, bot.safeAnchor));
    assignPlaneIdentity(bot, `ffa-bot-${i + 1}`, "enemy", `EN${i + 1}`);
    setPlaneFacingDirection(bot, getCombatCenterPoint(tmpVecB).sub(bot.mesh.position));
    bot.prevPosition.copy(bot.mesh.position);
    return bot;
  });

  game.initialEnemyCount = game.bots.length;
}

function spawnTeamBots(config) {
  const allyPalettes = [
    { body: 0x2a7fff, wing: 0x8df2ff, accent: 0x7df6d4, cockpit: 0x10253d },
    { body: 0x1fb7ff, wing: 0x9ff7ff, accent: 0x58ffd8, cockpit: 0x122a42 },
    { body: 0x2f6cff, wing: 0xb0f0ff, accent: 0x7df0ff, cockpit: 0x141d3b },
  ];
  const enemyPalettes = [
    { body: 0xff8a3d, wing: 0xffd34d, accent: 0xff4e7a, cockpit: 0x34192a },
    { body: 0xff6b4d, wing: 0xffb957, accent: 0xff4f4f, cockpit: 0x301a28 },
    { body: 0xffa33d, wing: 0xff6d58, accent: 0xffea6a, cockpit: 0x35201a },
  ];

  const allyLaneOffsets = getTeamEdgeLaneOffsets(config.allyBotCount, 560, true);
  const enemyLaneOffsets = getTeamEdgeLaneOffsets(config.enemyBotCount, 460, false);

  const allies = [];
  for (let i = 0; i < config.allyBotCount; i++) {
    const bot = createFighter(allyPalettes[i % allyPalettes.length]);
    const laneOffset = allyLaneOffsets[i] ?? 0;
    const spawnPos = findEdgeSpawnPosition("negX", laneOffset, EDGE_SPAWN_ALTITUDE + i * 8, 260, 60, 18);
    bot.mesh.position.copy(spawnPos);
    bot.safeAnchor.copy(getBotIngressAnchor(spawnPos, bot.safeAnchor));
    bot.formationSlot = i - (config.allyBotCount - 1) * 0.5;
    assignPlaneIdentity(bot, "allies", "ally", `AL${i + 1}`);
    setPlaneFacingDirection(bot, getCombatCenterPoint(tmpVecB).sub(bot.mesh.position));
    bot.prevPosition.copy(bot.mesh.position);
    allies.push(bot);
  }

  const enemies = [];
  for (let i = 0; i < config.enemyBotCount; i++) {
    const bot = createFighter(enemyPalettes[i % enemyPalettes.length]);
    const laneOffset = enemyLaneOffsets[i] ?? 0;
    const spawnPos = findEdgeSpawnPosition("posX", laneOffset, EDGE_SPAWN_ALTITUDE + rand(-10, 18), 620, 80, 22);
    bot.mesh.position.copy(spawnPos);
    bot.safeAnchor.copy(getBotIngressAnchor(spawnPos, bot.safeAnchor));
    bot.formationSlot = i - (config.enemyBotCount - 1) * 0.5;
    assignPlaneIdentity(bot, "enemies", "enemy", `EN${i + 1}`);
    setPlaneFacingDirection(bot, getCombatCenterPoint(tmpVecB).sub(bot.mesh.position));
    bot.prevPosition.copy(bot.mesh.position);
    enemies.push(bot);
  }

  game.bots = [...allies, ...enemies];
  game.initialEnemyCount = enemies.length;
}

function resetMatch(config = syncPendingMatchConfig()) {
  clearMatchEntities();
  resetMatchState();
  game.phase = "playing";
  game.activeMatchConfig = {
    ...config,
    autoLevelEnabled: config.autoLevelEnabled ?? selectedAutoLevelEnabled,
  };
  hideStartMenu();

  game.player = createFighter(0x48d7ff, true);
  assignPlaneIdentity(game.player, config.mode === MATCH_MODE_TEAM ? "allies" : "player", "player", "YOU");
  game.player.mesh.position.copy(findEdgeSpawnPosition("negX", 0, EDGE_SPAWN_ALTITUDE, 0, 0, 12));
  game.player.yaw = 0;
  game.player.pitch = 0;
  game.player.roll = 0;
  setPlaneFacingDirection(game.player, getCombatCenterPoint(tmpVecA).sub(game.player.mesh.position));
  game.player.prevPosition.copy(game.player.mesh.position);

  if (config.mode === MATCH_MODE_TEAM) {
    spawnTeamBots(config);
  } else {
    spawnFreeForAllBots(config.botCount);
  }

  if (!game.activeMatchConfig.autoLevelEnabled) {
    game.player.speed = Math.max(game.player.speed, MANUAL_FLIGHT_ASSIST_OFF_CRUISE_SPEED);
    if (game.player.velocity.lengthSq() > 1e-6) {
      game.player.velocity.setLength(game.player.speed);
    }
  }

  game.initialBots = game.bots.length;
  updateHudHealthPanel();
}

function syncInput() {
  const kRoll = (keys.has("KeyA") ? 1 : 0) + (keys.has("KeyD") ? -1 : 0);
  const kPitch = (keys.has("KeyW") ? -1 : 0) + (keys.has("KeyS") ? 1 : 0);
  const kThr = (keys.has("ArrowDown") ? -1 : 0) + (keys.has("ArrowUp") ? 1 : 0);
  const shiftBoostHeld = keys.has("ShiftLeft") || keys.has("ShiftRight");

  if (!shiftBoostHeld) game.shiftBoostRelatchRequired = false;
  const shiftBoostEnabled = shiftBoostHeld && (isMobile || !game.shiftBoostRelatchRequired);

  const stickRoll = Math.abs(stickInput.yaw) > 0.01 ? stickInput.yaw : 0;
  const stickPitch = Math.abs(stickInput.pitch) > 0.01 ? stickInput.pitch : 0;
  const usingStick = stickInput.active;

  const rollTarget = usingStick ? -stickRoll : kRoll;
  const pitchTarget = usingStick ? stickPitch : kPitch;
  input.rollIntent = rollTarget;
  input.pitchIntent = pitchTarget;

  input.roll = clamp(input.roll + (rollTarget - input.roll) * (usingStick ? 0.62 : 0.36), -1, 1);
  input.pitch = clamp(input.pitch + (pitchTarget - input.pitch) * (usingStick ? 0.56 : 0.34), -1, 1);
  input.yaw = 0;

  const throttleTarget = Math.abs(kThr) > 0 ? kThr : 0.35;
  input.throttle = clamp(input.throttle + (throttleTarget - input.throttle) * 0.24, -1, 1);

  input.boostLevel = clamp(Math.max(boostLeverState.level, shiftBoostEnabled ? 1 : 0), 0, 1);
  input.boost = input.boostLevel > 0.01;
  input.fire = keys.has("Space") || fireBtn.classList.contains("active");
  input.lockToggle = keys.has("KeyM");
  const keyEdgePress = input.lockToggle && !game.lockToggleButtonLatch;
  input.lockTogglePressed = keyEdgePress || game.lockToggleTapQueuedCount > 0;
  if (!keyEdgePress && game.lockToggleTapQueuedCount > 0) {
    game.lockToggleTapQueuedCount = Math.max(0, game.lockToggleTapQueuedCount - 1);
  }
  input.missileLaunchPressed = keys.has("KeyN") || game.missileLaunchTapQueuedCount > 0;
  if (game.missileLaunchTapQueuedCount > 0) {
    game.missileLaunchTapQueuedCount = Math.max(0, game.missileLaunchTapQueuedCount - 1);
  }
  game.lockToggleButtonLatch = input.lockToggle;
}

function setupJoystick(stickId, onMove) {
  const stick = document.getElementById(stickId);
  const knob = stick.querySelector(".knob");
  const state = { pointerId: null, touchId: null };

  function updateKnob(nx, ny) {
    const max = stick.clientWidth * 0.34;
    knob.style.transform = `translate(${nx * max}px, ${ny * max}px)`;
  }

  function moveFromClient(clientX, clientY) {
    const rect = stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let nx = (clientX - cx) / (rect.width / 2);
    let ny = (clientY - cy) / (rect.height / 2);
    const mag = Math.hypot(nx, ny);
    if (mag > 1) {
      nx /= mag;
      ny /= mag;
    }
    if (mag < 0.06) {
      nx = 0;
      ny = 0;
    }
    updateKnob(nx, ny);
    stickInput.active = true;
    onMove(nx, ny);
  }

  function releaseStick() {
    state.pointerId = null;
    state.touchId = null;
    stickInput.active = false;
    updateKnob(0, 0);
    onMove(0, 0);
  }

  stick.addEventListener("pointerdown", (e) => {
    state.pointerId = e.pointerId;
    moveFromClient(e.clientX, e.clientY);
  });

  const onPointerMove = (e) => {
    if (state.pointerId !== e.pointerId) return;
    moveFromClient(e.clientX, e.clientY);
  };

  const onPointerRelease = (e) => {
    if (state.pointerId !== e.pointerId) return;
    releaseStick();
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerRelease);
  window.addEventListener("pointercancel", onPointerRelease);

  // Fallback for very old browsers that do not support Pointer Events.
  if (!window.PointerEvent) {
    stick.addEventListener(
      "touchstart",
      (e) => {
        if (state.touchId != null) return;
        const t = e.changedTouches[0];
        state.touchId = t.identifier;
        moveFromClient(t.clientX, t.clientY);
        e.preventDefault();
      },
      { passive: false }
    );

    stick.addEventListener(
      "touchmove",
      (e) => {
        if (state.touchId == null) return;
        for (const t of e.changedTouches) {
          if (t.identifier !== state.touchId) continue;
          moveFromClient(t.clientX, t.clientY);
          e.preventDefault();
          break;
        }
      },
      { passive: false }
    );

    const onTouchEnd = (e) => {
      if (state.touchId == null) return;
      for (const t of e.changedTouches) {
        if (t.identifier !== state.touchId) continue;
        releaseStick();
        e.preventDefault();
        break;
      }
    };
    stick.addEventListener("touchend", onTouchEnd, { passive: false });
    stick.addEventListener("touchcancel", onTouchEnd, { passive: false });
  }
}

function setupBoostLever() {
  const knob = boostLeverEl.querySelector(".lever-knob");

  function applyLevel(level) {
    boostLeverState.level = clamp(level, 0, 1);
    const maxTravel = boostLeverEl.clientHeight - knob.clientHeight - 16;
    const y = maxTravel * (1 - boostLeverState.level);
    knob.style.transform = `translate(-50%, ${y}px)`;
  }
  boostLeverState.applyLevel = applyLevel;

  function moveFromClient(clientY) {
    if (game.boostFuel <= 0.01 || game.boostAutoDropAt != null) {
      applyLevel(0);
      return;
    }
    const rect = boostLeverEl.getBoundingClientRect();
    const top = rect.top + 8;
    const bottom = rect.bottom - 8;
    const clampedY = clamp(clientY, top, bottom);
    const level = 1 - (clampedY - top) / Math.max(1, bottom - top);
    applyLevel(level);
  }

  boostLeverEl.addEventListener("pointerdown", (e) => {
    boostLeverState.pointerId = e.pointerId;
    moveFromClient(e.clientY);
  });

  const onPointerMove = (e) => {
    if (boostLeverState.pointerId !== e.pointerId) return;
    moveFromClient(e.clientY);
  };

  const release = (e) => {
    if (boostLeverState.pointerId !== e.pointerId) return;
    boostLeverState.pointerId = null;
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);

  applyLevel(0);
}


function bindActionButton(btn, onPress = null, onRelease = null) {
  const press = (e) => {
    e.preventDefault();
    btn.classList.add("active");
    onPress?.();
  };
  const release = (e) => {
    e.preventDefault();
    btn.classList.remove("active");
    onRelease?.(e);
  };
  btn.addEventListener("pointerdown", press);
  btn.addEventListener("pointerup", release);
  btn.addEventListener("pointercancel", release);
  btn.addEventListener("pointerleave", release);
}

async function tryFullscreen() {
  const target = document.documentElement;
  if (document.fullscreenElement || !target.requestFullscreen) return;
  try {
    await target.requestFullscreen({ navigationUI: "hide" });
  } catch {
    // iOS Safari fallback is PWA standalone mode.
  }
}

async function lockLandscape() {
  if (screen.orientation?.lock) {
    try {
      await screen.orientation.lock("landscape");
    } catch {
      // Browsers may require fullscreen or block orientation lock.
    }
  }
}

function updateOrientationHint() {
  rotateHint.hidden = window.innerWidth >= window.innerHeight;
}

function updateMenuPanelPosition() {
  if (!menuBtn || !menuPanel) return;
  const rect = menuBtn.getBoundingClientRect();
  const menuBottom = Math.max(rect.bottom, 0);
  document.documentElement.style.setProperty("--menu-bottom", `${menuBottom}px`);
}

function fitViewport() {
  const viewport = window.visualViewport;
  const width = Math.max(1, viewport?.width || window.innerWidth || 1);
  const height = Math.max(1, viewport?.height || window.innerHeight || 1);

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  if (!rendererReady) {
    drawRendererFallback();
    return;
  }

  renderer.setPixelRatio(getRenderPixelRatio());
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function setActiveTapButton(buttons, activeButton) {
  buttons.forEach((btn) => {
    const isActive = btn === activeButton;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

function setupTapMenuButtons() {
  syncStartMenuUi();

  const applyMapSelection = (next) => {
    if (!next || next === selectedMapType) return;
    selectedMapType = next;
    syncStartMenuUi();
    clearMatchEntities();
    buildWorld(selectedMapType);
    if (game.phase === "playing") {
      closeMenuPanel();
      resetMatch(syncPendingMatchConfig());
      return;
    }
    showStartMenu();
  };

  const applyAutoLevelSelection = (enabled, applyToActiveMatch = false) => {
    const nextEnabled = !!enabled;
    if (nextEnabled === selectedAutoLevelEnabled && (!applyToActiveMatch || game.activeMatchConfig?.autoLevelEnabled === nextEnabled)) return;
    selectedAutoLevelEnabled = nextEnabled;
    if (applyToActiveMatch && game.activeMatchConfig) {
      game.activeMatchConfig.autoLevelEnabled = nextEnabled;
      if (!nextEnabled && game.player?.alive) {
        trimPlayerIntoAssistOffFlight(game.player);
      } else if (nextEnabled && game.player?.alive) {
        game.player.speed = clamp(game.player.velocity.length(), 150, 560);
      }
    }
    syncStartMenuUi();
  };

  botCountButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const next = Number(btn.dataset.botCount);
      if (!Number.isFinite(next) || next === selectedBotCount) return;
      selectedBotCount = next;
      syncStartMenuUi();
      if (game.phase === "playing" && selectedMatchMode === MATCH_MODE_FFA) {
        closeMenuPanel();
        resetMatch(syncPendingMatchConfig());
      }
    });
  });

  mapTypeButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      applyMapSelection(btn.dataset.mapType);
    });
  });

  startModeButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const next = btn.dataset.matchMode;
      if (!next || next === selectedMatchMode) return;
      selectedMatchMode = next;
      syncStartMenuUi();
    });
  });

  startSoloBotButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const next = Number(btn.dataset.soloBotCount);
      if (!Number.isFinite(next) || next === selectedBotCount) return;
      selectedBotCount = next;
      syncStartMenuUi();
    });
  });

  startTeamAllyButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const next = Number(btn.dataset.teamAllies);
      if (!Number.isFinite(next) || next === selectedTeamAllyCount) return;
      selectedTeamAllyCount = next;
      syncStartMenuUi();
    });
  });

  startTeamEnemyButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      const next = Number(btn.dataset.teamEnemies);
      if (!Number.isFinite(next) || next === selectedTeamEnemyCount) return;
      selectedTeamEnemyCount = next;
      syncStartMenuUi();
    });
  });

  startMapButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      applyMapSelection(btn.dataset.startMapType);
    });
  });

  startAutoLevelButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      applyAutoLevelSelection(parseAutoLevelValue(btn.dataset.autoLevel), false);
    });
  });

  autoLevelButtons.forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      applyAutoLevelSelection(parseAutoLevelValue(btn.dataset.autoLevel), game.phase === "playing");
    });
  });

  startMatchBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    resetMatch(syncPendingMatchConfig());
  });
}

if (!rendererReady) {
  drawRendererFallback();
  messageEl.hidden = false;
  messageEl.textContent = "3D graphics failed to initialize. Please reload the page.";
  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.textContent = "Reload";
  retryBtn.style.marginTop = "12px";
  retryBtn.style.padding = "10px 16px";
  retryBtn.style.borderRadius = "999px";
  retryBtn.style.border = "1px solid rgba(170, 220, 255, 0.6)";
  retryBtn.style.background = "rgba(17, 36, 62, 0.8)";
  retryBtn.style.color = "#d8efff";
  retryBtn.style.fontWeight = "700";
  retryBtn.addEventListener("click", () => location.reload());
  messageEl.insertAdjacentElement("afterend", retryBtn);
  window.addEventListener("resize", drawRendererFallback);
} else {

canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  messageEl.hidden = false;
  messageEl.textContent = "WebGL context was lost. Please reload the page.";
});

setupHudHealthPanel();

const startupState = { phase: "boot" };

function showFatalInitError(err, scope = "init") {
  const phase = startupState.phase || "unknown";
  console.error(`[skyace:${scope}:${phase}]`, err);
  messageEl.hidden = false;
  const text = String(err?.message || err || "unknown error");
  messageEl.textContent = `Initialization error (${scope}:${phase}): ${text}`;
}

function runStartupStep(phase, fn) {
  startupState.phase = phase;
  return fn();
}

window.addEventListener("error", (event) => {
  const locationInfo = `${event.filename || "unknown"}:${event.lineno || 0}:${event.colno || 0}`;
  showFatalInitError(event.error || `${event.message} @ ${locationInfo}`, "window.error");
});
window.addEventListener("unhandledrejection", (event) => {
  showFatalInitError(event.reason, "unhandledrejection");
});

updateMenuPanelPosition();
updateCockpitOverlayLayout();
setupJoystick("leftStick", (x, y) => {
  stickInput.yaw = x;
  stickInput.pitch = y;
});
bindActionButton(fireBtn);
bindActionButton(missileBtn, () => { game.lockToggleTapQueuedCount += 1; });
if (lockCancelBtn) bindActionButton(lockCancelBtn, () => { game.missileLaunchTapQueuedCount += 1; });
setupBoostLever();

window.addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (["ArrowUp", "ArrowDown", "Space", "KeyM", "KeyN", "Escape", "KeyC"].includes(e.code)) e.preventDefault();
  if (e.code === "Escape" || e.code === "KeyC") {
    game.missileLockTarget = null;
    game.missileLockLostTimer = 0;
  }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.code);
});

let lastHudPanelActionAt = 0;
function runHudPanelAction(e, action) {
  e?.preventDefault?.();
  const now = performance.now();
  if (now - lastHudPanelActionAt < 220) return;
  lastHudPanelActionAt = now;
  action();
}

const restartFromHud = (e) => runHudPanelAction(e, () => {
  closeMenuPanel();
  resetMatch(game.activeMatchConfig ? { ...game.activeMatchConfig } : syncPendingMatchConfig());
});

const openStartMenuFromHud = (e) => runHudPanelAction(e, () => {
  showStartMenu();
});

restartBtn.addEventListener("click", restartFromHud);
restartBtn.addEventListener("pointerup", restartFromHud);
startMenuBtn?.addEventListener("click", openStartMenuFromHud);
startMenuBtn?.addEventListener("pointerup", openStartMenuFromHud);



let lastMenuToggleAt = 0;

function toggleMenuPanel() {
  updateMenuPanelPosition();
  menuPanel.hidden = !menuPanel.hidden;
  menuBtn.setAttribute("aria-expanded", String(!menuPanel.hidden));
  lastMenuToggleAt = performance.now();
}

menuBtn.addEventListener("pointerup", (e) => {
  e.preventDefault();
  toggleMenuPanel();
});

menuBtn.addEventListener("click", (e) => {
  e.preventDefault();
  if (performance.now() - lastMenuToggleAt < 350) return;
  toggleMenuPanel();
});

setupTapMenuButtons();

window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("selectstart", (e) => e.preventDefault());
window.addEventListener("dragstart", (e) => e.preventDefault());
window.addEventListener("gesturestart", (e) => e.preventDefault());

window.addEventListener("resize", () => {
  fitViewport();
  updateMenuPanelPosition();
  updateOrientationHint();
  updateCockpitOverlayLayout();
});
window.visualViewport?.addEventListener("resize", () => {
  fitViewport();
  updateMenuPanelPosition();
  updateCockpitOverlayLayout();
});

let last = performance.now();
function tick(now) {
  try {
    startupState.phase = "tick";
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;

    game.matchElapsed += dt;
    syncInput();
    updatePlayer(dt);
    updateBots(dt);
    updateBullets(dt);
    updateMissiles(dt);
    updateEffects(dt);
    updateState();

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  } catch (err) {
    showFatalInitError(err, "tick");
  }
}

try {
  runStartupStep("fitViewport", () => fitViewport());
  runStartupStep("orientationHint", () => updateOrientationHint());
  runStartupStep("buildWorld", () => buildWorld(selectedMapType));
  runStartupStep("showStartMenu", () => showStartMenu());
  runStartupStep("startLoop", () => requestAnimationFrame(tick));
} catch (err) {
  showFatalInitError(err, "startup");
}
}



































































































































