import * as THREE from "three";
import { GLTFLoader } from "../../../vendor/three/examples/jsm/loaders/GLTFLoader.js";
import { assetManifest } from "../assets/AssetManifest.js";
import { gameConfig, locomotionStates } from "../config.js";
import { EnergyPool } from "../systems/EnergyPool.js";
import {
  applyPlayerLocomotionAmplification,
  collectPlayerLocomotionAmplifiers,
  getPlayerLocomotionAngleSnapshot,
} from "../animation/PlayerLocomotionAmplifier.js";

function dampVectorToward(current, target, lambda, deltaSeconds) {
  const t = 1 - Math.exp(-lambda * deltaSeconds);
  current.lerp(target, t);
}

function isFiniteVector(vector) {
  return (
    Number.isFinite(vector.x) &&
    Number.isFinite(vector.y) &&
    Number.isFinite(vector.z)
  );
}

function isFiniteQuaternion(quaternion) {
  return (
    Number.isFinite(quaternion.x) &&
    Number.isFinite(quaternion.y) &&
    Number.isFinite(quaternion.z) &&
    Number.isFinite(quaternion.w)
  );
}

function isFiniteEuler(euler) {
  return (
    Number.isFinite(euler.x) &&
    Number.isFinite(euler.y) &&
    Number.isFinite(euler.z)
  );
}

const lowerBodyFacingDeformBonePattern =
  /^DEF-(?:LEG|SHIN|KNEE|FOOT-ALONG-[XY]|TOE-(?:FRONT|BACK|IN|OUT|PLATE-FRONT)|SHIN-PISTON-(?:IN|OUT)|ANKLE-PISTON-(?:IN|OUT))\.[LR](?:_|$)/i;

function createAdditiveMaterial({ color, opacity, depthTest = false }) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthTest,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function createFlameSheetMaterial({ color, opacity, texture, depthTest = false }) {
  return new THREE.MeshBasicMaterial({
    color,
    map: texture,
    alphaMap: texture,
    transparent: true,
    opacity,
    depthTest,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function createFlameSpriteMaterial({ color, opacity, texture, depthTest = false }) {
  return new THREE.SpriteMaterial({
    color,
    map: texture,
    transparent: true,
    opacity,
    depthTest,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function createFlameTexture() {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width * 0.5, 0);

  const width = canvas.width;
  const height = canvas.height;

  const outerGradient = context.createLinearGradient(0, height, 0, 0);
  outerGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  outerGradient.addColorStop(0.06, "rgba(255, 236, 214, 0.12)");
  outerGradient.addColorStop(0.16, "rgba(210, 235, 255, 0.24)");
  outerGradient.addColorStop(0.34, "rgba(224, 243, 255, 0.44)");
  outerGradient.addColorStop(0.62, "rgba(244, 250, 255, 0.32)");
  outerGradient.addColorStop(0.88, "rgba(255, 255, 255, 0.08)");
  outerGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = outerGradient;

  context.beginPath();
  context.moveTo(0, height * 0.02);
  context.bezierCurveTo(
    -width * 0.1,
    height * 0.14,
    -width * 0.19,
    height * 0.46,
    -width * 0.06,
    height * 0.98,
  );
  context.lineTo(width * 0.08, height * 0.98);
  context.bezierCurveTo(
    width * 0.19,
    height * 0.46,
    width * 0.1,
    height * 0.14,
    0,
    height * 0.02,
  );
  context.closePath();
  context.fill();

  const lobeSpecs = [
    { y: 0.87, radiusX: 0.12, radiusY: 0.095, alpha: 0.42 },
    { y: 0.72, radiusX: 0.1, radiusY: 0.125, alpha: 0.48 },
    { y: 0.54, radiusX: 0.085, radiusY: 0.145, alpha: 0.38 },
    { y: 0.34, radiusX: 0.065, radiusY: 0.125, alpha: 0.24 },
  ];

  for (const lobe of lobeSpecs) {
    const gradient = context.createRadialGradient(
      0,
      height * lobe.y,
      width * 0.01,
      0,
      height * lobe.y,
      width * lobe.radiusX,
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${Math.min(lobe.alpha + 0.28, 0.9)})`);
    gradient.addColorStop(0.35, `rgba(245, 250, 255, ${lobe.alpha})`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(
      0,
      height * lobe.y,
      width * lobe.radiusX,
      height * lobe.radiusY,
      0,
      0,
      Math.PI * 2,
    );
    context.fill();
  }

  const coreGradient = context.createLinearGradient(0, height * 0.96, 0, height * 0.08);
  coreGradient.addColorStop(0, "rgba(255, 241, 228, 0.32)");
  coreGradient.addColorStop(0.12, "rgba(255, 255, 255, 0.82)");
  coreGradient.addColorStop(0.42, "rgba(247, 252, 255, 0.66)");
  coreGradient.addColorStop(0.78, "rgba(255, 255, 255, 0.18)");
  coreGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = coreGradient;
  context.beginPath();
  context.moveTo(0, height * 0.04);
  context.lineTo(-width * 0.03, height * 0.18);
  context.lineTo(-width * 0.018, height * 0.94);
  context.lineTo(width * 0.018, height * 0.94);
  context.lineTo(width * 0.03, height * 0.18);
  context.closePath();
  context.fill();

  const rootGradient = context.createRadialGradient(
    0,
    height * 0.9,
    width * 0.01,
    0,
    height * 0.9,
    width * 0.13,
  );
  rootGradient.addColorStop(0, "rgba(255, 239, 222, 0.52)");
  rootGradient.addColorStop(0.46, "rgba(240, 248, 255, 0.28)");
  rootGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = rootGradient;
  context.beginPath();
  context.ellipse(0, height * 0.9, width * 0.11, height * 0.075, 0, 0, Math.PI * 2);
  context.fill();

  const edgeGradient = context.createLinearGradient(0, height * 0.94, 0, height * 0.14);
  edgeGradient.addColorStop(0, "rgba(173, 214, 255, 0.18)");
  edgeGradient.addColorStop(0.42, "rgba(205, 232, 255, 0.22)");
  edgeGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.strokeStyle = edgeGradient;
  context.lineWidth = width * 0.055;
  context.beginPath();
  context.moveTo(0, height * 0.08);
  context.bezierCurveTo(
    -width * 0.06,
    height * 0.2,
    -width * 0.13,
    height * 0.56,
    -width * 0.03,
    height * 0.94,
  );
  context.stroke();
  context.beginPath();
  context.moveTo(0, height * 0.08);
  context.bezierCurveTo(
    width * 0.06,
    height * 0.2,
    width * 0.13,
    height * 0.56,
    width * 0.03,
    height * 0.94,
  );
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function buildMaterialArray(materialOrMaterials, prepareMaterial) {
  if (Array.isArray(materialOrMaterials)) {
    return materialOrMaterials.map(prepareMaterial);
  }

  return prepareMaterial(materialOrMaterials);
}

export class PlayerActor {
  constructor() {
    this.config = gameConfig.player;
    this.energyRules = gameConfig.energy;

    this.group = new THREE.Group();
    this.group.name = "PlayerActor";

    this.visualRoot = new THREE.Group();
    this.visualRoot.name = "PlayerVisualRoot";
    this.group.add(this.visualRoot);

    this.modelRoot = new THREE.Group();
    this.modelRoot.name = "PlayerModelRoot";
    this.visualRoot.add(this.modelRoot);

    this.energy = new EnergyPool({ max: this.energyRules.max });
    this.hp = this.config.hp;
    this.state = locomotionStates.ground;
    this.hoverLatched = false;
    this.isAlive = true;
    this.damageFlash = 0;
    this.jetTimer = 0;
    this.jetExitToHover = false;

    this.position = this.group.position;
    this.velocity = new THREE.Vector3();
    this.horizontalVelocity = new THREE.Vector3();
    this.forward = new THREE.Vector3(0, 0, -1);
    this.jetDirection = new THREE.Vector3(0, 0, -1);
    this.lastSafePosition = new THREE.Vector3();

    this.muzzleNode = new THREE.Object3D();
    this.visualRoot.add(this.muzzleNode);

    this.weaponNodes = [new THREE.Object3D(), new THREE.Object3D()];

    for (const weaponNode of this.weaponNodes) {
      this.visualRoot.add(weaponNode);
    }

    this.cameraAnchorNode = new THREE.Object3D();
    this.visualRoot.add(this.cameraAnchorNode);

    this.lockAnchorNode = new THREE.Object3D();
    this.visualRoot.add(this.lockAnchorNode);

    this.boosterNodes = [new THREE.Object3D(), new THREE.Object3D()];

    for (const boosterNode of this.boosterNodes) {
      this.visualRoot.add(boosterNode);
    }

    this.namedAnchorNodes = {
      nozzles: [null, null],
      guns: [null, null],
      cameraBase: null,
    };
    this.locomotionNodes = {
      hips: null,
      legFollows: [null, null],
      legs: [null, null],
      knees: [null, null],
      shins: [null, null],
      feet: [null, null],
      footMasters: [null, null],
      };
      this.locomotionAmplifiers = [];
      this.locomotionPoseEntries = [];
      this.lowerBodyFacingEntries = [];
      this.lowerBodyYaw = 0;
      this.modelSceneRoot = null;

    this.contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 28),
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
      }),
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.04;
    this.group.add(this.contactShadow);

    this.presentationBaseHeight = 0;
    this.shadowBaseScale = 1.35;
    this.animationMixer = null;
    this.animationActions = new Map();
    this.activeAnimationAction = null;
    this.activeAnimationName = null;
    this.idleAnimationName = null;
    this.walkAnimationName = null;
    this.runAnimationName = null;
    this.locomotionMode = "idle";
    this.thrusterTimer = 0;
    this.moveIntentMagnitude = 0;
    this.presentationTime = 0;

    this.boosterMaterials = [];
    this.coreMaterial = null;
    this.accentMaterials = [];

    this.modelBounds = new THREE.Box3();
    this.modelSize = new THREE.Vector3();
    this.modelCenter = new THREE.Vector3();

    this.tmpMoveDirection = new THREE.Vector3();
    this.tmpDesiredVelocity = new THREE.Vector3();
    this.tmpForward = new THREE.Vector3();
    this.tmpToTarget = new THREE.Vector3();
    this.tmpRight = new THREE.Vector3();
    this.tmpThrusterPosition = new THREE.Vector3();
    this.tmpExhaustDirection = new THREE.Vector3();
    this.tmpAnchorA = new THREE.Vector3();
    this.tmpAnchorB = new THREE.Vector3();
    this.tmpAnchorC = new THREE.Vector3();
    this.tmpAnchorD = new THREE.Vector3();
    this.tmpAnchorE = new THREE.Vector3();
    this.tmpQuaternion = new THREE.Quaternion();
    this.tmpQuaternionB = new THREE.Quaternion();
    this.tmpQuaternionC = new THREE.Quaternion();
    this.tmpQuaternionD = new THREE.Quaternion();
    this.tmpEuler = new THREE.Euler(0, 0, 0, "YXZ");
    this.tmpBox = new THREE.Box3();
    this.tmpBoxSize = new THREE.Vector3();
    this.tmpBoxCenter = new THREE.Vector3();
    this.tmpLocalPort = new THREE.Vector3();
    this.tmpLocalDirection = new THREE.Vector3();
    this.tmpFallbackForward = new THREE.Vector3();
    this.tmpFallbackRight = new THREE.Vector3();
    this.tmpFallbackOffset = new THREE.Vector3();
    this.tmpJetPlanarDirection = new THREE.Vector3();
    this.thrusterAxisUp = new THREE.Vector3(0, 1, 0);
    this.tmpAxis = new THREE.Vector3(1, 0, 0);

    this.thrusterFxRoot = new THREE.Group();
    this.thrusterFxRoot.name = "PlayerThrusterFxRoot";
    this.barrelTipLocalOffsets = [null, null];
    this.thrusterVisuals = {
      side: [null, null],
      center: null,
      foot: [null, null],
    };
    this.thrusterFlameTexture = createFlameTexture();
    this.thrusterSheetGeometry = new THREE.PlaneGeometry(1, 1, 1, 8);
    this.thrusterOuterGeometry = this.thrusterSheetGeometry;
    this.thrusterInnerGeometry = this.thrusterSheetGeometry;
    this.thrusterCoreGeometry = new THREE.ConeGeometry(0.05, 1, 12, 1, true);
    this.thrusterFlareGeometry = new THREE.SphereGeometry(0.16, 14, 14);
  }

  async initialize() {
    try {
      await this.loadPrimaryModel();
    } catch (error) {
      console.warn("Failed to load player model. Falling back to placeholder.", error);
      this.buildFallbackModel();
    }

    if (this.modelRoot.children.length === 0) {
      this.buildFallbackModel();
    }
  }

  async loadPrimaryModel() {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(assetManifest.models.playerKwIi.scene);

    if (!gltf.scene) {
      throw new Error("Player GLB did not contain a scene.");
    }

    const sceneRoot = gltf.scene;
    sceneRoot.name = "KWIIPlayerModel";
    sceneRoot.rotation.y = this.config.modelAsset.rotationY;
    sceneRoot.scale.setScalar(this.config.modelScale);

    sceneRoot.traverse((object) => {
      if (!object.isMesh) {
        return;
      }

      object.material = buildMaterialArray(object.material, (material) => {
        if (!material?.clone) {
          return material;
        }

        const clonedMaterial = material.clone();

        if ("envMapIntensity" in clonedMaterial) {
          clonedMaterial.envMapIntensity = Math.max(clonedMaterial.envMapIntensity ?? 1, 0.95);
        }

        return clonedMaterial;
      });
    });

    this.modelRoot.add(sceneRoot);
    this.fitLoadedModel(sceneRoot);
    this.resolveNamedAnchors(sceneRoot);
    this.resolveLocomotionNodes(sceneRoot);
    this.captureLocomotionAmplifiers(sceneRoot);
    this.refreshLocomotionPoseEntries();
    this.group.updateMatrixWorld(true);
    this.calibrateBarrelTipOffsets();
    this.collectAccentMaterials(sceneRoot);
    this.setupAnimation(sceneRoot, gltf.animations ?? []);
    this.attachThrusterFxRoot();
    this.ensureThrusterVisuals();
  }

  fitLoadedModel(sceneRoot) {
    this.modelBounds.setFromObject(sceneRoot);
    this.modelBounds.getSize(this.modelSize);

    const safeHeight = Math.max(this.modelSize.y, 0.001);
    const scale = this.config.modelAsset.targetHeight / safeHeight;
    sceneRoot.scale.multiplyScalar(scale);

    this.modelBounds.setFromObject(sceneRoot);
    this.modelBounds.getCenter(this.modelCenter);
    sceneRoot.position.x -= this.modelCenter.x;
    sceneRoot.position.z -= this.modelCenter.z;
    sceneRoot.position.y -= this.modelBounds.min.y;

    this.modelBounds.setFromObject(sceneRoot);
    this.modelBounds.getSize(this.modelSize);

    this.presentationBaseHeight = 0;
    this.shadowBaseScale = THREE.MathUtils.clamp(
      Math.max(this.modelSize.x, this.modelSize.z) * 0.55,
      1.35,
      2.4,
    );
    this.configureAnchorsFromBounds(this.modelBounds);
  }

  resolveNamedAnchors(sceneRoot) {
    const anchorNames = this.config.modelAsset.namedAnchors;

    this.modelSceneRoot = sceneRoot;
    this.namedAnchorNodes.nozzles[0] = sceneRoot.getObjectByName(anchorNames.nozzleLeft) ?? null;
    this.namedAnchorNodes.nozzles[1] = sceneRoot.getObjectByName(anchorNames.nozzleRight) ?? null;
    this.namedAnchorNodes.guns[0] = sceneRoot.getObjectByName(anchorNames.gunLeft) ?? null;
    this.namedAnchorNodes.guns[1] = sceneRoot.getObjectByName(anchorNames.gunRight) ?? null;
    this.namedAnchorNodes.cameraBase = sceneRoot.getObjectByName(anchorNames.cameraBase) ?? null;
  }

  resolveLocomotionNodes(sceneRoot) {
    this.locomotionNodes.hips = sceneRoot.getObjectByName("DEF-HIPS_0103") ?? null;
    this.locomotionNodes.legFollows[0] = sceneRoot.getObjectByName("MCH-INT-LEG-FOLLOW.L_039") ?? null;
    this.locomotionNodes.legFollows[1] = sceneRoot.getObjectByName("MCH-INT-LEG-FOLLOW.R_067") ?? null;
    this.locomotionNodes.legs[0] = sceneRoot.getObjectByName("MCH-SWITCH-LEG.L_040") ?? null;
    this.locomotionNodes.legs[1] = sceneRoot.getObjectByName("MCH-SWITCH-LEG.R_068") ?? null;
    this.locomotionNodes.knees[0] = sceneRoot.getObjectByName("MCH-SWITCH-KNEE.L_044") ?? null;
    this.locomotionNodes.knees[1] = sceneRoot.getObjectByName("MCH-SWITCH-KNEE.R_072") ?? null;
    this.locomotionNodes.shins[0] = sceneRoot.getObjectByName("MCH-SWITCH-SHIN.L_025") ?? null;
    this.locomotionNodes.shins[1] = sceneRoot.getObjectByName("MCH-SWITCH-SHIN.R_073") ?? null;
    this.locomotionNodes.feet[0] = sceneRoot.getObjectByName("MCH-FOOT-Z-ROT.L_050") ?? null;
    this.locomotionNodes.feet[1] = sceneRoot.getObjectByName("MCH-FOOT-Z-ROT.R_078") ?? null;
    this.locomotionNodes.footMasters[0] = sceneRoot.getObjectByName("IK-FOOT-MASTER.L_062") ?? null;
    this.locomotionNodes.footMasters[1] = sceneRoot.getObjectByName("IK-FOOT-MASTER.R_090") ?? null;
  }

  captureLocomotionAmplifiers(sceneRoot) {
    this.locomotionAmplifiers = collectPlayerLocomotionAmplifiers(sceneRoot);
  }

  refreshLocomotionPoseEntries() {
    const uniqueNodes = new Set();
    const nextEntries = [];
    const registerNode = (node) => {
      if (!node || uniqueNodes.has(node)) {
        return;
      }

      uniqueNodes.add(node);
      nextEntries.push({
        node,
        position: node.position.clone(),
        quaternion: node.quaternion.clone(),
      });
    };

    for (const entry of this.locomotionAmplifiers) {
      registerNode(entry.node);
    }

    this.locomotionPoseEntries = nextEntries;
    this.captureLocomotionPoseEntries();
    this.refreshLowerBodyFacingEntries();
  }

  refreshLowerBodyFacingEntries() {
    const nextEntries = [];
    const registeredNodes = new Set();
    const registerNode = (node, role, weight = 1) => {
      if (!node || registeredNodes.has(node)) {
        return;
      }

      registeredNodes.add(node);
      nextEntries.push({
        node,
        role,
        weight,
        worldPosition: new THREE.Vector3(),
        worldQuaternion: new THREE.Quaternion(),
      });
    };

    registerNode(this.locomotionNodes.hips, "hips", 0.3);

    const sceneRoot = this.modelSceneRoot ?? this.modelRoot;
    registerNode(sceneRoot?.getObjectByName?.("DEF-BODY_0118") ?? null, "body", 1.14);

    sceneRoot?.traverse((object) => {
      if (object?.isSkinnedMesh && /low_legs/i.test(object.geometry?.name ?? "")) {
        registerNode(object, "visualLegMesh", 1.72);
        return;
      }

      if (!object?.isBone || !lowerBodyFacingDeformBonePattern.test(object.name ?? "")) {
        return;
      }

      const role = /^DEF-LEG\./i.test(object.name ?? "") ? "legRoot" : "legChain";
      const weight = role === "legRoot" ? 1.38 : 1.22;
      registerNode(object, role, weight);
    });

    this.lowerBodyFacingEntries = nextEntries;
  }

  captureLocomotionPoseEntries() {
    for (const entry of this.locomotionPoseEntries) {
      entry.position.copy(entry.node.position);
      entry.quaternion.copy(entry.node.quaternion);
    }
  }

  restoreLocomotionPoseEntries() {
    for (const entry of this.locomotionPoseEntries) {
      entry.node.position.copy(entry.position);
      entry.node.quaternion.copy(entry.quaternion);
    }
  }

  calibrateBarrelTipOffsets() {
    const configuredLocalOffsets = this.config.modelAsset.barrelTipLocalOffsets;

    for (let index = 0; index < 2; index += 1) {
      const gunAnchor = this.namedAnchorNodes.guns[index];
      const configuredLocalOffset = configuredLocalOffsets
        ? index === 0
          ? configuredLocalOffsets.left
          : configuredLocalOffsets.right
        : null;

      const configuredWorldPoint = this.getConfiguredModelPoint(
        this.getMuzzlePortOffset(index),
        new THREE.Vector3(),
      );

      if (gunAnchor && configuredWorldPoint) {
        const localPoint = gunAnchor.worldToLocal(configuredWorldPoint.clone());
        this.barrelTipLocalOffsets[index] = isFiniteVector(localPoint)
          ? localPoint.clone()
          : null;
        continue;
      }

      if (gunAnchor && configuredLocalOffset) {
        this.barrelTipLocalOffsets[index] = this.tmpLocalPort
          .fromArray(configuredLocalOffset)
          .clone();
        continue;
      }

      this.barrelTipLocalOffsets[index] = configuredWorldPoint?.clone() ?? null;
    }
  }

  configureAnchorsFromBounds(bounds) {
    bounds.getSize(this.tmpBoxSize);
    bounds.getCenter(this.tmpBoxCenter);

    const frontZ = bounds.min.z;
    const backZ = bounds.max.z;
    const muzzleZ = frontZ + this.tmpBoxSize.z * this.config.modelAsset.frontInsetRatio;
    const cameraZ = THREE.MathUtils.lerp(frontZ, backZ, this.config.modelAsset.cameraDepthRatio);
    const weaponX = Math.max(this.tmpBoxSize.x * 0.23, 0.56);
    const weaponY = bounds.min.y + this.tmpBoxSize.y * this.config.modelAsset.muzzleHeightRatio;

    this.muzzleNode.position.set(
      0,
      weaponY,
      muzzleZ,
    );
    this.weaponNodes[0].position.set(-weaponX, weaponY, muzzleZ);
    this.weaponNodes[1].position.set(weaponX, weaponY, muzzleZ);
    this.lockAnchorNode.position.set(
      0,
      bounds.min.y + this.tmpBoxSize.y * this.config.modelAsset.lockHeightRatio,
      frontZ + this.tmpBoxSize.z * 0.22,
    );
    this.cameraAnchorNode.position.set(
      0,
      bounds.min.y + this.tmpBoxSize.y * this.config.modelAsset.cameraHeightRatio,
      cameraZ,
    );

    const boosterX = Math.max(this.tmpBoxSize.x * 0.16, 0.46);
    const boosterY = bounds.min.y + this.tmpBoxSize.y * 0.56;
    const boosterZ = backZ - this.tmpBoxSize.z * 0.08;

    this.boosterNodes[0].position.set(-boosterX, boosterY, boosterZ);
    this.boosterNodes[1].position.set(boosterX, boosterY, boosterZ);
  }

  collectAccentMaterials(sceneRoot) {
    this.accentMaterials = [];

    sceneRoot.traverse((object) => {
      if (!object.isMesh) {
        return;
      }

      const materials = Array.isArray(object.material) ? object.material : [object.material];

      for (const material of materials) {
        if (
          material?.isMeshStandardMaterial &&
          material.emissive &&
          material.emissive.getHex() !== 0
        ) {
          this.accentMaterials.push({
            material,
            baseIntensity: material.emissiveIntensity ?? 1,
          });
        }
      }
    });
  }

  setupAnimation(sceneRoot, clips) {
    if (clips.length === 0) {
      return;
    }

    this.animationMixer = new THREE.AnimationMixer(sceneRoot);
    this.animationActions.clear();

    for (const clip of clips) {
      const action = this.animationMixer.clipAction(clip);
      action.enabled = true;
      action.clampWhenFinished = false;
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.animationActions.set(clip.name, action);
    }

    this.idleAnimationName = clips.find((clip) => clip.name === "Full length pose")?.name ??
      clips.find((clip) => /idle|hover|stand|breath|pose/i.test(clip.name))?.name ??
      clips[0].name;
    this.walkAnimationName = clips.find((clip) => clip.name === "Walking animation")?.name ??
      clips.find((clip) => /walk|run|move/i.test(clip.name))?.name ??
      null;
    this.runAnimationName = clips.find((clip) => /run|sprint|dash/i.test(clip.name))?.name ?? null;

    this.playAnimation(this.idleAnimationName, 0);
  }

  playAnimation(name, fadeSeconds = 0.2) {
    if (!name || this.activeAnimationName === name || !this.animationMixer) {
      return;
    }

    const nextAction = this.animationActions.get(name);

    if (!nextAction) {
      return;
    }

    for (const action of this.animationActions.values()) {
      if (action === nextAction) {
        continue;
      }

      action.stop();
      action.enabled = false;
      action.setEffectiveWeight(0);
    }

    nextAction.enabled = true;
    nextAction.setEffectiveWeight(1);
    nextAction.setEffectiveTimeScale(1);
    nextAction.reset();
    nextAction.play();

    this.activeAnimationAction = nextAction;
    this.activeAnimationName = name;
  }

  updateAnimationState() {
    if (!this.animationMixer) {
      return;
    }

    const horizontalSpeed = this.horizontalVelocity.length();
    const locomotionMode = this.getGroundLocomotionMode(horizontalSpeed);
    this.locomotionMode = locomotionMode;
    const useRunClip = locomotionMode === "run" && this.runAnimationName;
    const locomotionAnimation = useRunClip
      ? this.runAnimationName
      : this.walkAnimationName;

    this.playAnimation(
      locomotionMode === "idle" ? this.idleAnimationName : locomotionAnimation,
      locomotionMode === "idle" ? 0.18 : 0.06,
    );

    if (!this.activeAnimationAction) {
      return;
    }

    const locomotionSpeedRatio = this.getGroundLocomotionSpeedRatio(horizontalSpeed);

    if (locomotionMode === "walk") {
      const walkRatio = THREE.MathUtils.clamp((locomotionSpeedRatio - 0.18) / 0.44, 0, 1);
      this.activeAnimationAction.timeScale = THREE.MathUtils.lerp(
        this.config.walkPlaybackMin,
        this.config.walkPlaybackMax,
        walkRatio,
      );
    } else if (locomotionMode === "run") {
      const runRatio = THREE.MathUtils.clamp((locomotionSpeedRatio - 0.56) / 0.44, 0, 1);
      this.activeAnimationAction.timeScale = THREE.MathUtils.lerp(
        this.config.runPlaybackMin,
        this.config.runPlaybackMax,
        runRatio,
      );
    } else {
      this.activeAnimationAction.timeScale = 1;
    }
  }

  getGroundLocomotionMode(horizontalSpeed = this.horizontalVelocity.length()) {
    if (
      this.state !== locomotionStates.ground ||
      !this.walkAnimationName ||
      this.moveIntentMagnitude <= 0.08
    ) {
      return "idle";
    }

    const speedRatio = horizontalSpeed / Math.max(this.config.groundSpeed, 0.001);
    return speedRatio >= 0.56 || this.moveIntentMagnitude >= 0.76 ? "run" : "walk";
  }

  getGroundLocomotionSpeedRatio(horizontalSpeed = this.horizontalVelocity.length()) {
    const speedRatio = horizontalSpeed / Math.max(this.config.groundSpeed, 0.001);
    return THREE.MathUtils.clamp(Math.max(this.moveIntentMagnitude, speedRatio), 0, 1);
  }

  updateLowerBodyFacing(deltaSeconds, moveDirection, lockTargetPosition) {
    this.lowerBodyYaw = THREE.MathUtils.damp(
      this.lowerBodyYaw,
      0,
      this.config.lowerBodyYawSmoothing,
      deltaSeconds,
    );

    if (!Number.isFinite(this.lowerBodyYaw)) {
      this.lowerBodyYaw = 0;
    }
  }

  getLowerBodyFacingPivotWorldPosition(target = new THREE.Vector3()) {
    const hipsEntry = this.lowerBodyFacingEntries.find((entry) => entry?.role === "hips" && entry.node);

    if (hipsEntry) {
      hipsEntry.node.getWorldPosition(target);

      if (isFiniteVector(target)) {
        const hipsWorld = this.tmpAnchorB.copy(target);
        let legRootCount = 0;
        target.set(0, 0, 0);

        for (const entry of this.lowerBodyFacingEntries) {
          if (entry?.role !== "legRoot" || !entry.node) {
            continue;
          }

          const worldPosition = entry.node.getWorldPosition(this.tmpAnchorA);

          if (!isFiniteVector(worldPosition)) {
            continue;
          }

          target.add(worldPosition);
          legRootCount += 1;
        }

        if (legRootCount > 0) {
          target.divideScalar(legRootCount).lerp(hipsWorld, 0.12);
          return target;
        }

        return target.copy(hipsWorld);
      }
    }

    let count = 0;
    target.set(0, 0, 0);

    for (const entry of this.lowerBodyFacingEntries) {
      if (entry?.role !== "legRoot" || !entry.node) {
        continue;
      }

      const worldPosition = entry.node.getWorldPosition(this.tmpAnchorA);

      if (!isFiniteVector(worldPosition)) {
        continue;
      }

      target.add(worldPosition);
      count += 1;
    }

    if (count > 0) {
      target.divideScalar(count);
      return target;
    }

    return this.getWorldPosition(target);
  }

  applyLowerBodyFacingOffset() {
    return;
  }

  applyLocalRotationOffset(node, x = 0, y = 0, z = 0) {
    if (!node || (!x && !y && !z)) {
      return;
    }

    this.tmpQuaternionB.setFromEuler(this.tmpEuler.set(x, y, z, "XYZ"));
    node.quaternion.multiply(this.tmpQuaternionB);
  }

  applyLocalPositionOffset(node, x = 0, y = 0, z = 0) {
    if (!node || (!x && !y && !z)) {
      return;
    }

    node.position.x += x;
    node.position.y += y;
    node.position.z += z;
  }

  applyModelSpacePositionOffset(node, x = 0, y = 0, z = 0) {
    if (!node || (!x && !y && !z)) {
      return;
    }

    const modelRoot = this.modelSceneRoot ?? this.modelRoot;
    const parent = node.parent;

    if (!modelRoot || !parent) {
      this.applyLocalPositionOffset(node, x, y, z);
      return;
    }

    const worldOrigin = modelRoot.localToWorld(this.tmpAnchorA.set(0, 0, 0));
    const worldOffset = modelRoot.localToWorld(this.tmpAnchorB.set(x, y, z));
    const parentLocalOrigin = parent.worldToLocal(this.tmpAnchorC.copy(worldOrigin));
    const parentLocalOffset = parent.worldToLocal(this.tmpAnchorD.copy(worldOffset));
    node.position.add(parentLocalOffset.sub(parentLocalOrigin));
  }

  amplifyLocomotionAnimation(moveRatio, locomotionMode) {
    applyPlayerLocomotionAmplification(this.locomotionAmplifiers, {
      locomotionMode,
      moveRatio,
    });
  }

  applyProceduralStridePose(walkPhase, moveRatio, locomotionMode) {
    return;
  }

  applyLocomotionAdditivePose(walkPhase, moveRatio, locomotionMode) {
    return;
  }

  buildFallbackModel() {
    this.presentationBaseHeight = 1.1;
    this.shadowBaseScale = 1.35;

    const armorMaterial = new THREE.MeshStandardMaterial({
      color: "#c4b49a",
      roughness: 0.42,
      metalness: 0.22,
      envMapIntensity: 0.55,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: "#5d6776",
      roughness: 0.5,
      metalness: 0.45,
    });
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: "#ffd199",
      emissive: "#ff8c3b",
      emissiveIntensity: 1.8,
      roughness: 0.18,
      metalness: 0.08,
    });
    this.coreMaterial = coreMaterial;

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 2.2, 1.5),
      armorMaterial,
    );
    torso.position.y = 1.45;
    this.modelRoot.add(torso);

    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 1),
      trimMaterial,
    );
    chest.position.set(0, 1.55, -0.86);
    this.modelRoot.add(chest);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 18, 18),
      coreMaterial,
    );
    core.position.set(0, 1.52, -0.98);
    this.modelRoot.add(core);

    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.62, 1.45),
        armorMaterial,
      );
      shoulder.position.set(side * 1.35, 1.75, -0.12);
      this.modelRoot.add(shoulder);

      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 1.6, 0.46),
        trimMaterial,
      );
      arm.position.set(side * 1.45, 0.9, -0.18);
      this.modelRoot.add(arm);

      const legUpper = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 1.2, 0.8),
        armorMaterial,
      );
      legUpper.position.set(side * 0.52, 0.3, 0.08);
      this.modelRoot.add(legUpper);

      const legLower = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 1.25, 0.54),
        trimMaterial,
      );
      legLower.position.set(side * 0.48, -0.7, 0.14);
      this.modelRoot.add(legLower);

      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.2, 0.96),
        armorMaterial,
      );
      foot.position.set(side * 0.46, -1.45, -0.04);
      this.modelRoot.add(foot);

      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.78, 2),
        trimMaterial,
      );
      wing.position.set(side * 1.9, 1.4, 0.24);
      wing.rotation.z = side * -0.3;
      wing.rotation.x = 0.16;
      this.modelRoot.add(wing);

      const boosterMaterial = new THREE.MeshStandardMaterial({
        color: "#9fb2c8",
        emissive: "#5de3ff",
        emissiveIntensity: 0.25,
        roughness: 0.2,
        metalness: 0.28,
      });
      this.boosterMaterials.push(boosterMaterial);

      const booster = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.26, 0.78, 16),
        boosterMaterial,
      );
      booster.rotation.x = Math.PI / 2;
      booster.position.set(side * 0.72, 0.65, 1.04);
      this.modelRoot.add(booster);
    }

    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.3, 0.7),
      trimMaterial,
    );
    backpack.position.set(0, 1.15, 1.06);
    this.modelRoot.add(backpack);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.48, 0.62),
      armorMaterial,
    );
    head.position.set(0, 2.62, -0.1);
    this.modelRoot.add(head);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.12, 0.12),
      new THREE.MeshStandardMaterial({
        color: "#b8f3ff",
        emissive: "#88e4ff",
        emissiveIntensity: 1.2,
        roughness: 0.12,
        metalness: 0.04,
      }),
    );
    visor.position.set(0, 2.62, -0.38);
    this.modelRoot.add(visor);

    this.muzzleNode.position.set(0, 1.55, -1.65);
    this.weaponNodes[0].position.set(-1.28, 1.52, -1.45);
    this.weaponNodes[1].position.set(1.28, 1.52, -1.45);
    this.cameraAnchorNode.position.set(0, 1.9, 0.25);
    this.lockAnchorNode.position.set(0, 1.95, 0.2);
    this.boosterNodes[0].position.set(-0.72, 0.7, 1.28);
    this.boosterNodes[1].position.set(0.72, 0.7, 1.28);
    this.modelBounds.setFromObject(this.modelRoot);
    this.modelBounds.getSize(this.modelSize);
    this.modelBounds.getCenter(this.modelCenter);
    this.refreshLocomotionPoseEntries();
    this.attachThrusterFxRoot();
    this.ensureThrusterVisuals();
  }

  addToScene(scene) {
    scene.add(this.group);
  }

  setSpawnPosition(position) {
    this.position.copy(position);
    this.lastSafePosition.copy(position);
  }

  getWorldPosition(target = new THREE.Vector3()) {
    return this.group.getWorldPosition(target);
  }

  getCameraAnchor(target = new THREE.Vector3()) {
    const anchor = this.cameraAnchorNode.getWorldPosition(target);
    return isFiniteVector(anchor)
      ? anchor
      : this.getFallbackNodeWorldPosition(
          this.cameraAnchorNode,
          this.config.modelAsset.cameraPort,
          target,
        );
  }

  getAimOrigin(target = new THREE.Vector3()) {
    const anchor = this.lockAnchorNode.getWorldPosition(target);
    return isFiniteVector(anchor)
      ? anchor
      : this.getFallbackNodeWorldPosition(
          this.lockAnchorNode,
          this.config.modelAsset.lockPort,
          target,
        );
  }

  getWeaponAnchorNode(index) {
    return this.namedAnchorNodes.guns[index] ??
      this.weaponNodes[index] ??
      this.muzzleNode;
  }

  getSideJetAnchorNode(index) {
    return this.namedAnchorNodes.nozzles[index] ??
      this.boosterNodes[index] ??
      this.muzzleNode;
  }

  getNozzleAnchorNode(index) {
    return this.namedAnchorNodes.nozzles[index] ?? this.boosterNodes[index] ?? this.muzzleNode;
  }

  getOffsetForAnchor(kind, index) {
    const anchorOffsets = this.config.modelAsset.anchorOffsets;

    if (kind === "jet") {
      return index === 0 ? anchorOffsets.jetLeft : anchorOffsets.jetRight;
    }

    if (kind === "gun") {
      return index === 0 ? anchorOffsets.gunLeft : anchorOffsets.gunRight;
    }

    return anchorOffsets.centerJet;
  }

  getJetPortOffset(kind, index) {
    const jetPorts = this.config.modelAsset.jetPorts;

    if (!jetPorts) {
      return null;
    }

    if (kind === "side") {
      return index === 0 ? jetPorts.left : jetPorts.right;
    }

    if (kind === "foot") {
      return index === 0 ? jetPorts.footLeft : jetPorts.footRight;
    }

    return jetPorts.center ?? null;
  }

  getMuzzlePortOffset(index) {
    const muzzlePorts = this.config.modelAsset.muzzlePorts;

    if (!muzzlePorts) {
      return null;
    }

    return index === 0 ? muzzlePorts.left : muzzlePorts.right;
  }

  getConfiguredModelPoint(offset, target = new THREE.Vector3()) {
    if (!offset) {
      return null;
    }

    const modelRoot = this.modelSceneRoot ?? this.modelRoot;
    const point = modelRoot.localToWorld(target.fromArray(offset));
    return isFiniteVector(point) ? point : null;
  }

  getNodeLocalPoint(node, offset, target = new THREE.Vector3()) {
    if (!node || !offset) {
      return null;
    }

    const point = node.localToWorld(target.fromArray(offset));
    return isFiniteVector(point) ? point : null;
  }

  getAnchorWorldPositionWithLocalOffset(anchorNode, fallbackNode, offset, target = new THREE.Vector3()) {
    const resolvedNode = anchorNode ?? fallbackNode;

    if (!resolvedNode) {
      return target.set(0, 0, 0);
    }

    if (offset) {
      const point = resolvedNode.localToWorld(target.fromArray(offset));
      return isFiniteVector(point) ? point : target.set(0, 0, 0);
    }

    const point = resolvedNode.getWorldPosition(target);
    return isFiniteVector(point) ? point : target.set(0, 0, 0);
  }

  attachThrusterFxRoot() {
    const parent = this.group;

    if (this.thrusterFxRoot.parent !== parent) {
      this.thrusterFxRoot.removeFromParent();
      parent.add(this.thrusterFxRoot);
    }
  }

  ensureThrusterVisuals() {
    this.attachThrusterFxRoot();

    if (!this.thrusterVisuals.side[0]) {
      this.thrusterVisuals.side[0] = this.createThrusterVisual("side-left", 0.3);
      this.thrusterVisuals.side[1] = this.createThrusterVisual("side-right", 1.7);
      this.thrusterVisuals.center = this.createThrusterVisual("center", 3.2, {
        occludedByGeometry: true,
      });
      this.thrusterVisuals.foot[0] = this.createThrusterVisual("foot-left", 4.4);
      this.thrusterVisuals.foot[1] = this.createThrusterVisual("foot-right", 5.5);
      this.hideThrusterVisuals();
    }
  }

  createThrusterVisual(name, phase, { occludedByGeometry = false } = {}) {
    const group = new THREE.Group();
    group.name = `ThrusterVisual-${name}`;
    const outer = new THREE.Mesh(
      this.thrusterOuterGeometry,
      createFlameSheetMaterial({
        color: "#a8dcff",
        opacity: 0.74,
        texture: this.thrusterFlameTexture,
        depthTest: occludedByGeometry,
      }),
    );
    const outerCross = outer.clone();
    const inner = new THREE.Mesh(
      this.thrusterInnerGeometry,
      createFlameSheetMaterial({
        color: "#f9fdff",
        opacity: 0.62,
        texture: this.thrusterFlameTexture,
        depthTest: occludedByGeometry,
      }),
    );
    const innerCross = inner.clone();
    const core = new THREE.Mesh(
      this.thrusterCoreGeometry,
      createAdditiveMaterial({
        color: "#ffffff",
        opacity: 0.82,
        depthTest: occludedByGeometry,
      }),
    );
    const flare = new THREE.Mesh(
      this.thrusterFlareGeometry,
      createAdditiveMaterial({
        color: "#fffaf6",
        opacity: 0.26,
        depthTest: occludedByGeometry,
      }),
    );
    const rootGlow = new THREE.Mesh(
      this.thrusterFlareGeometry,
      createAdditiveMaterial({
        color: "#f5fbff",
        opacity: 0.34,
        depthTest: occludedByGeometry,
      }),
    );
    const sideBillboard = new THREE.Sprite(
      createFlameSpriteMaterial({
        color: "#c9ecff",
        opacity: 0.42,
        texture: this.thrusterFlameTexture,
        depthTest: occludedByGeometry,
      }),
    );
    const sideBillboardCore = new THREE.Sprite(
      createFlameSpriteMaterial({
        color: "#ffffff",
        opacity: 0.5,
        texture: this.thrusterFlameTexture,
        depthTest: occludedByGeometry,
      }),
    );
    outerCross.rotation.y = Math.PI * 0.5;
    innerCross.rotation.y = Math.PI * 0.5;
    outer.renderOrder = 28;
    outerCross.renderOrder = 28;
    inner.renderOrder = 29;
    innerCross.renderOrder = 29;
    core.renderOrder = 30;
    flare.renderOrder = 31;
    rootGlow.renderOrder = 32;
    group.visible = false;
    group.add(outer);
    group.add(outerCross);
    group.add(inner);
    group.add(innerCross);
    group.add(core);
    group.add(flare);
    group.add(rootGlow);
    group.add(sideBillboard);
    group.add(sideBillboardCore);
    this.thrusterFxRoot.add(group);
    return {
      group,
      outer,
      outerCross,
      inner,
      innerCross,
      core,
      flare,
      rootGlow,
      sideBillboard,
      sideBillboardCore,
      phase,
    };
  }

  hideThrusterVisuals() {
    for (const visual of [
      ...this.thrusterVisuals.side,
      this.thrusterVisuals.center,
      ...this.thrusterVisuals.foot,
    ]) {
      if (visual) {
        visual.group.visible = false;
      }
    }
  }

  getFallbackNodeWorldPosition(node, configuredPort, target = new THREE.Vector3()) {
    const localPosition = node?.position ?? this.tmpFallbackOffset.fromArray(configuredPort ?? [0, 0, 0]);
    const safeVisualHeight = Number.isFinite(this.visualRoot.position.y)
      ? this.visualRoot.position.y
      : this.presentationBaseHeight;
    const forward = this.tmpFallbackForward.copy(this.forward);

    if (!isFiniteVector(forward) || forward.lengthSq() < 0.0001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    this.tmpFallbackRight.set(-forward.z, 0, forward.x);

    if (!isFiniteVector(this.tmpFallbackRight) || this.tmpFallbackRight.lengthSq() < 0.0001) {
      this.tmpFallbackRight.set(1, 0, 0);
    } else {
      this.tmpFallbackRight.normalize();
    }

    return target
      .copy(this.position)
      .addScaledVector(this.tmpFallbackRight, localPosition.x)
      .addScaledVector(forward, localPosition.z)
      .setY(this.position.y + safeVisualHeight + localPosition.y);
  }

  getThrusterPortLocalPosition(kind, index, target = new THREE.Vector3()) {
    if (kind === "side") {
      return target.fromArray(this.getJetPortOffset("side", index));
    }

    if (kind === "foot") {
      return target.fromArray(this.getJetPortOffset("foot", index));
    }

    return target.fromArray(this.getJetPortOffset("center"));
  }

  getThrusterLocalDirection(kind, index, target = new THREE.Vector3()) {
    if (kind === "center" || kind === "foot") {
      return target.set(0, -1, 0);
    }

    const sideBias = index === 0 ? 1 : -1;
    return target.set(sideBias * 0.24, -0.12, 0.96).normalize();
  }

  copyWorldPointToThrusterLocal(worldPosition, target = new THREE.Vector3()) {
    return this.thrusterFxRoot.worldToLocal(target.copy(worldPosition));
  }

  copyWorldDirectionToThrusterLocal(
    worldPosition,
    worldDirection,
    target = new THREE.Vector3(),
  ) {
    const localOrigin = this.copyWorldPointToThrusterLocal(worldPosition, this.tmpAnchorD);
    const localEnd = this.copyWorldPointToThrusterLocal(
      this.tmpAnchorE.copy(worldPosition).add(worldDirection),
      this.tmpAnchorE,
    );

    return target.subVectors(localEnd, localOrigin).normalize();
  }

  setThrusterVisual(visual, localPosition, localDirection, strength, options = {}) {
    if (!visual) {
      return;
    }

    const jetActive = options.jetActive ?? false;
    const foot = options.foot ?? false;
    const center = options.center ?? false;
    const side = !center && !foot;
    const visibleStrength = THREE.MathUtils.clamp(strength, 0, 2.2);

    if (side || visibleStrength <= 0.05) {
      visual.group.visible = false;
      return;
    }

    const pulseTime = this.presentationTime;
    const fastFlutter = Math.sin(pulseTime * (jetActive ? 76 : 54) + visual.phase * 1.6);
    const mediumFlutter = Math.sin(pulseTime * (jetActive ? 49 : 33) + visual.phase * 0.9);
    const slowSurge = Math.sin(pulseTime * (jetActive ? 18 : 12) + visual.phase * 0.6);
    const pulse = THREE.MathUtils.clamp(
      0.94 + fastFlutter * 0.08 + mediumFlutter * 0.06 + Math.max(0, slowSurge) * 0.12,
      0.78,
      1.18,
    );
    const swayX = Math.sin(pulseTime * 12.2 + visual.phase * 0.7) * 0.008 * visibleStrength;
    const swayZ = Math.cos(pulseTime * 10.4 + visual.phase * 0.9) * 0.008 * visibleStrength;
    const radiusBase = center ? 0.46 : 0.35;
    const outerLengthBase = center
      ? (jetActive ? 4.45 : 2.28)
      : (jetActive ? 3.12 : 1.86);
    const innerLengthBase = center
      ? (jetActive ? 2.72 : 1.34)
      : (jetActive ? 1.82 : 1.06);
    const coreLengthBase = center
      ? (jetActive ? 1.46 : 0.68)
      : (jetActive ? 0.98 : 0.58);
    const outerLength = outerLengthBase * pulse;
    const innerLength = innerLengthBase * (0.94 + mediumFlutter * 0.06);
    const coreLength = coreLengthBase * (0.9 + fastFlutter * 0.04);
    const outerRadius = radiusBase + visibleStrength * (center ? 0.22 : 0.17);
    const innerRadius = outerRadius * 0.62;
    const coreRadius = outerRadius * 0.18;
    const outerWidth = outerRadius * (center ? 1.42 : 1.26);
    const innerWidth = innerRadius * (center ? 0.84 : 0.72);
    const coreWidth = coreRadius * 0.54;
    const flameBaseLift = center ? 0.03 : 0.022;

    visual.group.visible = true;
    visual.group.position.copy(localPosition);
    visual.group.quaternion.setFromUnitVectors(this.thrusterAxisUp, localDirection);

    visual.outer.scale.set(outerWidth, outerLength, 1);
    visual.outer.position.set(swayX, outerLength * 0.5 + flameBaseLift, swayZ);
    visual.outerCross.scale.set(outerWidth * 1.1, outerLength, 1);
    visual.outerCross.position.copy(visual.outer.position);
    visual.inner.scale.set(innerWidth, innerLength, 1);
    visual.inner.position.set(swayX * 0.36, innerLength * 0.46 + flameBaseLift, swayZ * 0.36);
    visual.innerCross.scale.set(innerWidth * 0.86, innerLength, 1);
    visual.innerCross.position.copy(visual.inner.position);
    visual.core.scale.set(coreWidth, coreLength, coreWidth);
    visual.core.position.set(swayX * 0.12, coreLength * 0.42 + flameBaseLift, swayZ * 0.12);
    visual.flare.position.set(swayX * 0.04, flameBaseLift, swayZ * 0.04);
    visual.rootGlow.position.set(0, 0, 0);
    visual.sideBillboard.visible = false;
    visual.sideBillboardCore.visible = false;
    visual.flare.scale.set(
      center ? 0.54 + visibleStrength * 0.08 : 0.36 + visibleStrength * 0.06,
      0.16,
      center ? 0.54 + visibleStrength * 0.08 : 0.36 + visibleStrength * 0.06,
    );
    visual.rootGlow.scale.setScalar(
      center ? 0.18 + visibleStrength * 0.05 : 0.14 + visibleStrength * 0.04,
    );
    visual.outer.material.color.set(center ? "#9fd4ff" : "#addcff");
    visual.outerCross.material.color.set(center ? "#9fd4ff" : "#addcff");
    visual.inner.material.color.set("#fbfdff");
    visual.innerCross.material.color.set("#fbfdff");
    visual.sideBillboard.material.color.set(center ? "#b9dcff" : "#c6e6ff");
    visual.sideBillboardCore.material.color.set("#ffffff");
    visual.rootGlow.material.color.set("#fff4ec");
    visual.flare.material.color.set("#fff8f2");

    visual.outer.material.opacity = THREE.MathUtils.clamp(
      (center ? 0.8 : 0.72) + visibleStrength * (jetActive ? 0.26 : 0.2),
      0,
      1,
    );
    visual.outerCross.material.opacity = visual.outer.material.opacity * 0.98;
    visual.inner.material.opacity = THREE.MathUtils.clamp(
      (center ? 0.58 : 0.5) + visibleStrength * (jetActive ? 0.18 : 0.12),
      0,
      0.92,
    );
    visual.innerCross.material.opacity = visual.inner.material.opacity * 0.88;
    visual.core.material.opacity = THREE.MathUtils.clamp(
      (center ? 0.48 : 0.4) + visibleStrength * (jetActive ? 0.12 : 0.08),
      0,
      0.76,
    );
    visual.flare.material.opacity = THREE.MathUtils.clamp(
      (center ? 0.18 : 0.14) + visibleStrength * (jetActive ? 0.06 : 0.04),
      0,
      0.36,
    );
    visual.rootGlow.material.opacity = THREE.MathUtils.clamp(
      (center ? 0.08 : 0.06) + visibleStrength * (jetActive ? 0.025 : 0.018),
      0,
      0.16,
    );
    visual.sideBillboard.material.opacity = 0;
    visual.sideBillboardCore.material.opacity = 0;
  }

  getWeaponAnchorWorldPosition(index, target = new THREE.Vector3()) {
    return this.getAnchorWorldPositionWithLocalOffset(
      this.namedAnchorNodes.guns[index],
      this.weaponNodes[index] ?? this.muzzleNode,
      null,
      target,
    );
  }

  getWeaponWorldPosition(index, target = new THREE.Vector3()) {
    return this.getWeaponAnchorWorldPosition(index, target);
  }

  getWeaponMuzzleWorldPosition(index, target = new THREE.Vector3()) {
    const gunAnchorNode = this.namedAnchorNodes.guns[index];
    const calibratedLocalOffset = this.barrelTipLocalOffsets[index];

    if (gunAnchorNode && calibratedLocalOffset) {
      return gunAnchorNode.localToWorld(target.copy(calibratedLocalOffset));
    }

    if (!gunAnchorNode) {
      const configuredPoint = this.getConfiguredModelPoint(this.getMuzzlePortOffset(index), target);

      if (configuredPoint) {
        return configuredPoint;
      }

      return this.getAnchorWorldPositionWithLocalOffset(
        null,
        this.weaponNodes[index] ?? this.muzzleNode,
        this.getOffsetForAnchor("gun", index),
        target,
      );
    }

    return gunAnchorNode.getWorldPosition(target);
  }

  getMuzzleWorldPosition(target = new THREE.Vector3()) {
    return target
      .copy(this.getWeaponMuzzleWorldPosition(0, this.tmpAnchorA))
      .lerp(this.getWeaponMuzzleWorldPosition(1, this.tmpAnchorB), 0.5);
  }

  getNozzleAnchorWorldPosition(index, target = new THREE.Vector3()) {
    return this.getAnchorWorldPositionWithLocalOffset(
      this.namedAnchorNodes.nozzles[index],
      this.getSideJetAnchorNode(index),
      null,
      target,
    );
  }

  getNozzleWorldPosition(index, target = new THREE.Vector3()) {
    const configuredPoint = this.getConfiguredModelPoint(this.getJetPortOffset("side", index), target);

    if (configuredPoint) {
      return configuredPoint;
    }

    return this.getAnchorWorldPositionWithLocalOffset(
      this.namedAnchorNodes.nozzles[index],
      this.getSideJetAnchorNode(index),
      this.getOffsetForAnchor("jet", index),
      target,
    );
  }

  applyModelLocalOffset(position, offset, target = position) {
    if (!offset) {
      return target;
    }

    const modelRoot = this.modelSceneRoot ?? this.modelRoot;
    const worldOrigin = modelRoot.getWorldPosition(this.tmpAnchorD);
    const worldOffsetPosition = modelRoot.localToWorld(this.tmpAnchorE.fromArray(offset));

    return target.copy(position).add(worldOffsetPosition.sub(worldOrigin));
  }

  getCenterJetWorldPosition(target = new THREE.Vector3()) {
    const configuredPoint = this.getConfiguredModelPoint(this.getJetPortOffset("center"), target);

    if (configuredPoint) {
      return configuredPoint;
    }

    const midNozzle = this.tmpAnchorA
      .copy(this.getNozzleAnchorWorldPosition(0, this.tmpAnchorA))
      .lerp(this.getNozzleAnchorWorldPosition(1, this.tmpAnchorB), 0.5);
    const cameraBaseNode = this.namedAnchorNodes.cameraBase ?? this.cameraAnchorNode;
    const cameraBase = cameraBaseNode.getWorldPosition(this.tmpAnchorC);

    target.copy(midNozzle).lerp(cameraBase, this.config.modelAsset.centerJetBlend);
    this.applyModelLocalOffset(
      target,
      this.getOffsetForAnchor("center"),
      target,
    );
    return target;
  }

  getFootJetWorldPosition(index, target = new THREE.Vector3()) {
    const configuredPoint = this.getConfiguredModelPoint(this.getJetPortOffset("foot", index), target);

    if (configuredPoint) {
      return configuredPoint;
    }

    const fallbackX = index === 0 ? 0.78 : -0.78;
    const fallbackZ = 0.38;
    return this.applyModelLocalOffset(
      target.copy(this.getWorldPosition(target)),
      [fallbackX, 0.18, fallbackZ],
      target,
    );
  }

  getDebugSnapshot() {
    const gunAxisDistance = 3.6;
    const locomotionAngles = getPlayerLocomotionAngleSnapshot(this.locomotionAmplifiers);

    return {
      rawJetAnchors: [
        {
          position: this.getNozzleAnchorWorldPosition(0, new THREE.Vector3()).clone(),
        },
        {
          position: this.getNozzleAnchorWorldPosition(1, new THREE.Vector3()).clone(),
        },
        {
          position: this.tmpAnchorC
            .copy(this.getNozzleAnchorWorldPosition(0, new THREE.Vector3()))
            .lerp(this.getNozzleAnchorWorldPosition(1, new THREE.Vector3()), 0.5)
            .clone(),
        },
      ],
      jetAnchors: [
        {
          position: this.getNozzleWorldPosition(0, new THREE.Vector3()).clone(),
          direction: this.getNozzleExhaustDirection(0, new THREE.Vector3()).clone(),
        },
        {
          position: this.getNozzleWorldPosition(1, new THREE.Vector3()).clone(),
          direction: this.getNozzleExhaustDirection(1, new THREE.Vector3()).clone(),
        },
        {
          position: this.getCenterJetWorldPosition(new THREE.Vector3()).clone(),
          direction: this.getCenterJetExhaustDirection(new THREE.Vector3()).clone(),
        },
      ],
      footJetAnchors: [
        {
          position: this.getFootJetWorldPosition(0, new THREE.Vector3()).clone(),
          direction: this.getFootJetExhaustDirection(0, new THREE.Vector3()).clone(),
        },
        {
          position: this.getFootJetWorldPosition(1, new THREE.Vector3()).clone(),
          direction: this.getFootJetExhaustDirection(1, new THREE.Vector3()).clone(),
        },
      ],
      rawGunAnchors: [
        {
          position: (this.namedAnchorNodes.guns[0]?.getWorldPosition(new THREE.Vector3()) ??
            this.getWeaponAnchorWorldPosition(0, new THREE.Vector3())).clone(),
        },
        {
          position: (this.namedAnchorNodes.guns[1]?.getWorldPosition(new THREE.Vector3()) ??
            this.getWeaponAnchorWorldPosition(1, new THREE.Vector3())).clone(),
        },
      ],
      gunAxes: [0, 1].map((index) => {
        const gunNode = this.namedAnchorNodes.guns[index];

        if (!gunNode) {
          return null;
        }

        return {
          origin: gunNode.getWorldPosition(new THREE.Vector3()).clone(),
          x: this.getNodeLocalPoint(gunNode, [gunAxisDistance, 0, 0], new THREE.Vector3())?.clone() ?? null,
          y: this.getNodeLocalPoint(gunNode, [0, gunAxisDistance, 0], new THREE.Vector3())?.clone() ?? null,
          z: this.getNodeLocalPoint(gunNode, [0, 0, gunAxisDistance], new THREE.Vector3())?.clone() ?? null,
        };
      }),
      gunAnchors: [
        {
          position: this.getWeaponMuzzleWorldPosition(0, new THREE.Vector3()).clone(),
        },
        {
          position: this.getWeaponMuzzleWorldPosition(1, new THREE.Vector3()).clone(),
        },
      ],
      animation: {
        active: this.activeAnimationName,
        hasAction: Boolean(this.activeAnimationAction),
        idle: this.idleAnimationName,
        walk: this.walkAnimationName,
        locomotionMode: this.locomotionMode,
        time: this.activeAnimationAction?.time ?? null,
        timeScale: this.activeAnimationAction?.timeScale ?? null,
        legAngles: locomotionAngles,
      },
      lowerBodyFacing: {
        yaw: this.lowerBodyYaw,
        entryCount: this.lowerBodyFacingEntries.length,
        roles: this.lowerBodyFacingEntries.slice(0, 8).map((entry) => `${entry.role}:${entry.node?.name ?? "n/a"}`),
      },
    };
  }

  getExhaustDirection(sideBias, target = new THREE.Vector3()) {
    target.copy(this.forward).multiplyScalar(-0.18);
    target.y -= 1;

    if (sideBias !== 0) {
      this.tmpRight.set(-this.forward.z, 0, this.forward.x);

      if (this.tmpRight.lengthSq() < 0.0001) {
        this.tmpRight.set(1, 0, 0);
      } else {
        this.tmpRight.normalize();
      }

      target.addScaledVector(this.tmpRight, sideBias * 0.22);
    }

    return target.normalize();
  }

  getNozzleExhaustDirection(index, target = new THREE.Vector3()) {
    return this.getExhaustDirection(index === 0 ? -1 : 1, target);
  }

  getModelWorldDirectionFromLocal(localX, localY, localZ, target = new THREE.Vector3()) {
    const modelSpaceNode = this.modelSceneRoot ?? this.modelRoot;
    target.set(localX, localY, localZ);

    if (target.lengthSq() < 0.0001) {
      target.set(0, -1, 0);
    } else {
      target.normalize();
    }

    return target
      .applyQuaternion(modelSpaceNode.getWorldQuaternion(this.tmpQuaternionB))
      .normalize();
  }

  getCenterJetExhaustDirection(target = new THREE.Vector3()) {
    const backwardWeight = this.state === locomotionStates.jet ? 0.4 : 0.24;
    return this.getModelWorldDirectionFromLocal(0, -1, backwardWeight, target);
  }

  getFootJetExhaustDirection(index, target = new THREE.Vector3()) {
    const backwardWeight = this.state === locomotionStates.jet ? 0.07 : 0.035;
    const outwardWeight = this.state === locomotionStates.jet ? 0.06 : 0.035;
    const outwardX = index === 0 ? outwardWeight : -outwardWeight;
    return this.getModelWorldDirectionFromLocal(outwardX, -1, backwardWeight, target);
  }

  getForwardVector(target = new THREE.Vector3()) {
    return target.copy(this.forward);
  }

  getAltitude(arena) {
    return Math.max(0, this.position.y - arena.sampleHeight(this.position.x, this.position.z));
  }

  getDamageMultiplier() {
    return this.state === locomotionStates.jet ? this.config.jetDamageMultiplier : 1;
  }

  takeDamage(amount) {
    if (!this.isAlive) {
      return 0;
    }

    const actualDamage = amount * this.getDamageMultiplier();
    this.hp = Math.max(0, this.hp - actualDamage);
    this.damageFlash = 1;

    if (this.hp <= 0) {
      this.isAlive = false;
    }

    return actualDamage;
  }

  resetForBattle(spawnPosition) {
    this.setSpawnPosition(spawnPosition);
    this.energy.current = this.energy.max;
    this.hp = this.config.hp;
    this.state = locomotionStates.ground;
    this.hoverLatched = false;
    this.isAlive = true;
    this.damageFlash = 0;
    this.jetTimer = 0;
    this.jetExitToHover = false;
    this.moveIntentMagnitude = 0;
    this.lowerBodyYaw = 0;
    this.presentationTime = 0;
    this.locomotionMode = "idle";
    this.velocity.set(0, 0, 0);
    this.horizontalVelocity.set(0, 0, 0);
    this.forward.set(0, 0, -1);
    this.jetDirection.set(0, 0, -1);
    this.visualRoot.position.y = this.presentationBaseHeight;
    this.visualRoot.quaternion.identity();
    this.modelRoot.position.set(0, 0, 0);
    this.modelRoot.rotation.set(0, 0, 0);
    this.contactShadow.scale.setScalar(this.shadowBaseScale);
    this.contactShadow.material.opacity = 0.28;
    this.hideThrusterVisuals();

    if (this.animationMixer) {
      this.animationMixer.stopAllAction();
      this.activeAnimationAction = null;
      this.activeAnimationName = null;
      this.playAnimation(this.idleAnimationName, 0);
    }

    this.group.updateMatrixWorld(true);
  }

  update(deltaSeconds, { input, moveBasis, arena, lockTargetPosition, fx }) {
    if (!this.isAlive) {
      return;
    }

    if (
      !isFiniteVector(this.position) ||
      !isFiniteVector(this.velocity) ||
      !isFiniteVector(this.horizontalVelocity)
    ) {
      this.recoverFromInvalidMotion(arena);
    } else {
      this.lastSafePosition.copy(this.position);
    }

    const moveX = input.moveX;
    const moveY = input.moveY;
    const moveMagnitude = Math.min(Math.sqrt(moveX * moveX + moveY * moveY), 1);
    this.moveIntentMagnitude = moveMagnitude;
    const moveDirection = this.computeMoveDirection(moveBasis, moveX, moveY);
    const groundHeight = arena.sampleHeight(this.position.x, this.position.z);
    const altitude = this.position.y - groundHeight;

    if (input.hoverTogglePressed) {
      this.hoverLatched = !this.hoverLatched;
    }

    const hoverInputThreshold = this.config.autoHoverInputThreshold ?? 0.08;
    const hoverInputActive = Math.abs(input.vertical) > hoverInputThreshold;
    const upwardHoverIntent = input.vertical > hoverInputThreshold;
    const hoverIntent = this.hoverLatched || hoverInputActive;

    if (input.jetPressed && this.state !== locomotionStates.jet) {
      this.tryStartJet(moveDirection, altitude, input, fx);
    }

    if (
      this.state === locomotionStates.ground &&
      upwardHoverIntent &&
      this.energy.has(this.config.hoverRelightMinimum)
    ) {
      const lift = this.config.liftoffImpulse + Math.max(0, input.vertical) * this.config.ascendImpulse;
      this.enterHover(lift, { latch: true });
    }

    if (
      this.state === locomotionStates.fall &&
      upwardHoverIntent &&
      this.energy.has(this.config.hoverRelightMinimum)
    ) {
      this.enterHover(Math.max(this.velocity.y, 0), { latch: true });
    }

    switch (this.state) {
      case locomotionStates.ground:
        this.updateGround(
          deltaSeconds,
          moveDirection,
          moveMagnitude,
          input,
          arena,
          groundHeight,
          upwardHoverIntent,
        );
        break;
      case locomotionStates.hover:
        this.updateHover(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight, hoverIntent);
        break;
      case locomotionStates.fall:
        this.updateFall(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight, hoverIntent);
        break;
      case locomotionStates.jet:
        this.updateJet(deltaSeconds, arena, groundHeight, hoverIntent);
        break;
      default:
        break;
    }

    arena.clampToPlayArea(this.position);

    if (!isFiniteVector(this.position)) {
      this.recoverFromInvalidMotion(arena);
    } else {
      this.lastSafePosition.copy(this.position);
    }

    this.updateAnimationState();
    this.updateOrientation(deltaSeconds, moveDirection, lockTargetPosition);
    this.updatePresentation(deltaSeconds, this.getAltitude(arena), fx);
    this.group.updateMatrixWorld(true);
  }

  computeMoveDirection(moveBasis, moveX, moveY) {
    const basisForward = moveBasis?.forward;
    const basisRight = moveBasis?.right;

    if (!basisForward || !basisRight || !isFiniteVector(basisForward) || !isFiniteVector(basisRight)) {
      this.tmpRight.set(-this.forward.z, 0, this.forward.x);

      if (!isFiniteVector(this.tmpRight) || this.tmpRight.lengthSq() < 0.0001) {
        this.tmpRight.set(1, 0, 0);
      } else {
        this.tmpRight.normalize();
      }

      this.tmpMoveDirection
        .copy(this.tmpRight)
        .multiplyScalar(moveX)
        .addScaledVector(this.forward, moveY);
    } else {
      this.tmpMoveDirection
        .copy(basisRight)
        .multiplyScalar(moveX)
        .addScaledVector(basisForward, moveY);
    }

    if (this.tmpMoveDirection.lengthSq() > 1) {
      this.tmpMoveDirection.normalize();
    }

    if (!isFiniteVector(this.tmpMoveDirection)) {
      this.tmpMoveDirection.set(0, 0, 0);
    }

    return this.tmpMoveDirection;
  }

  recoverFromInvalidMotion(arena) {
    if (!isFiniteVector(this.lastSafePosition)) {
      this.lastSafePosition.set(0, 0, 0);
    }

    this.position.copy(this.lastSafePosition);
    this.position.y = arena.sampleHeight(this.position.x, this.position.z);
    this.velocity.set(0, 0, 0);
    this.horizontalVelocity.set(0, 0, 0);
    this.jetTimer = 0;
    this.jetExitToHover = false;
    this.state = locomotionStates.ground;
  }

  tryStartJet(moveDirection, altitude, input, fx) {
    if (!this.energy.has(this.energyRules.jetMinimum)) {
      return false;
    }

    if (!this.energy.spendImmediate(this.energyRules.jetStartCost)) {
      return false;
    }

    this.state = locomotionStates.jet;
    this.jetTimer = 0;
    this.jetExitToHover = false;
    const verticalInput = THREE.MathUtils.clamp(input?.vertical ?? 0, -1, 1);
    const verticalThreshold = this.config.jetVerticalInputThreshold ?? 0.16;

    if (moveDirection.lengthSq() > 0.01) {
      this.jetDirection.copy(moveDirection).normalize();
    } else {
      this.jetDirection.copy(this.forward).setY(0);

      if (this.jetDirection.lengthSq() < 0.001) {
        this.jetDirection.set(0, 0, -1);
      } else {
        this.jetDirection.normalize();
      }
    }

    if (Math.abs(verticalInput) > verticalThreshold) {
      const planarDirection = this.tmpJetPlanarDirection.copy(moveDirection).setY(0);

      if (planarDirection.lengthSq() > 0.0001) {
        this.jetDirection
          .copy(planarDirection.normalize())
          .addScaledVector(this.thrusterAxisUp, verticalInput)
          .normalize();
      } else {
        this.jetDirection.set(0, Math.sign(verticalInput), 0);
      }

      this.jetExitToHover = verticalInput > 0;
    }

    this.horizontalVelocity
      .copy(this.jetDirection)
      .setY(0)
      .multiplyScalar(this.config.jetSpeed);
    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;
    const verticalJetSpeed =
      this.jetDirection.y * this.config.jetSpeed * (this.config.jetVerticalSpeedScale ?? 0.72);

    if (Math.abs(verticalJetSpeed) > 0.01) {
      const blockGroundDive = altitude <= 0.22 && verticalJetSpeed < 0;
      this.velocity.y = blockGroundDive ? 0 : verticalJetSpeed;
    } else {
      this.velocity.y = altitude > 0.35 ? Math.max(this.velocity.y, 0.65) : 0;
    }

    if (fx) {
      this.spawnJetKickFx(fx);
    }

    return true;
  }

  spawnJetKickFx(fx) {
    fx.clearJetBursts?.();
    fx.spawnJetBurst(
      this.getCenterJetWorldPosition(this.tmpThrusterPosition),
      this.getCenterJetExhaustDirection(this.tmpExhaustDirection),
      { strength: 1.8 },
    );

    for (let index = 0; index < 2; index += 1) {
      fx.spawnJetBurst(
        this.getFootJetWorldPosition(index, this.tmpThrusterPosition),
        this.getFootJetExhaustDirection(index, this.tmpExhaustDirection),
        { strength: 1.15 },
      );
    }
  }

  enterHover(initialVerticalVelocity, { latch = false } = {}) {
    this.state = locomotionStates.hover;
    if (latch) {
      this.hoverLatched = true;
    }
    this.jetExitToHover = false;
    this.velocity.y = Math.max(this.velocity.y, initialVerticalVelocity);
  }

  updateGround(
    deltaSeconds,
    moveDirection,
    moveMagnitude,
    input,
    arena,
    groundHeight,
    upwardHoverIntent,
  ) {
    const fatigue = moveMagnitude > 0.05
      ? 0.72 + this.energy.spendContinuous(this.energyRules.groundMoveDrain, deltaSeconds) * 0.28
      : 1;

    this.energy.recover(this.energyRules.groundRegen, deltaSeconds);

    this.tmpDesiredVelocity.copy(moveDirection).multiplyScalar(this.config.groundSpeed * fatigue);
    this.tmpDesiredVelocity.y = 0;

    dampVectorToward(
      this.horizontalVelocity,
      this.tmpDesiredVelocity,
      moveMagnitude > 0.05 ? this.config.groundAcceleration : this.config.braking,
      deltaSeconds,
    );

    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;
    this.velocity.y = 0;

    this.position.addScaledVector(this.velocity, deltaSeconds);
    this.position.y = arena.sampleHeight(this.position.x, this.position.z);

    if (upwardHoverIntent && this.energy.has(this.config.hoverRelightMinimum)) {
      const lift = this.config.liftoffImpulse + input.vertical * this.config.ascendImpulse;
      this.enterHover(lift, { latch: true });
      this.position.y = Math.max(this.position.y, groundHeight + 0.02);
    }
  }

  updateHover(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight, hoverIntent) {
    const drainRatio = this.energy.spendContinuous(this.energyRules.hoverDrain, deltaSeconds);
    this.energy.recover(this.energyRules.airRegen, deltaSeconds);

    if (drainRatio < 1) {
      this.hoverLatched = false;
      this.state = locomotionStates.fall;
      return;
    }

    if (!hoverIntent) {
      this.state = locomotionStates.fall;
      return;
    }

    this.tmpDesiredVelocity.copy(moveDirection).multiplyScalar(this.config.hoverSpeed);
    dampVectorToward(
      this.horizontalVelocity,
      this.tmpDesiredVelocity,
      moveMagnitude > 0.05 ? this.config.airAcceleration : this.config.braking * 0.75,
      deltaSeconds,
    );

    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;

    const desiredVerticalSpeed = input.vertical * this.config.hoverVerticalSpeed;
    this.velocity.y = THREE.MathUtils.damp(
      this.velocity.y,
      desiredVerticalSpeed,
      this.config.hoverDamping,
      deltaSeconds,
    );

    this.position.addScaledVector(this.velocity, deltaSeconds);

    if (this.position.y <= groundHeight && this.velocity.y <= 0) {
      this.land(arena);
    }
  }

  updateFall(deltaSeconds, moveDirection, moveMagnitude, input, arena, groundHeight, hoverIntent) {
    this.energy.recover(this.energyRules.airRegen, deltaSeconds);

    this.tmpDesiredVelocity.copy(moveDirection).multiplyScalar(this.config.fallSpeed);
    dampVectorToward(
      this.horizontalVelocity,
      this.tmpDesiredVelocity,
      moveMagnitude > 0.05 ? this.config.airAcceleration * 0.7 : this.config.braking * 0.45,
      deltaSeconds,
    );

    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;
    this.velocity.y -= this.config.gravity * deltaSeconds;

    this.position.addScaledVector(this.velocity, deltaSeconds);

    if (this.position.y <= groundHeight) {
      this.land(arena);
      return;
    }

    if (hoverIntent && this.energy.has(this.config.hoverRelightMinimum)) {
      this.enterHover(Math.max(this.velocity.y * 0.4, -1.6), { latch: true });
    }
  }

  updateJet(deltaSeconds, arena, groundHeight, hoverIntent) {
    this.jetTimer += deltaSeconds;

    this.horizontalVelocity
      .copy(this.jetDirection)
      .setY(0)
      .multiplyScalar(this.config.jetSpeed);
    this.velocity.x = this.horizontalVelocity.x;
    this.velocity.z = this.horizontalVelocity.z;

    const verticalJetSpeed =
      this.jetDirection.y * this.config.jetSpeed * (this.config.jetVerticalSpeedScale ?? 0.72);

    if (Math.abs(verticalJetSpeed) > 0.01) {
      const blockGroundDive = verticalJetSpeed < 0 && this.position.y <= groundHeight + 0.22;
      this.velocity.y = blockGroundDive ? 0 : verticalJetSpeed;
    } else if (this.position.y > groundHeight + 0.22) {
      this.velocity.y = THREE.MathUtils.damp(this.velocity.y, 0.15, 7, deltaSeconds);
    } else {
      this.velocity.y = 0;
    }

    this.position.addScaledVector(this.velocity, deltaSeconds);

    const endJet = this.jetTimer >= this.config.jetDurationCap;

    if (this.position.y <= groundHeight && this.velocity.y <= 0) {
      this.position.y = groundHeight;
    }

    if (!endJet) {
      return;
    }

    const altitude = this.position.y - arena.sampleHeight(this.position.x, this.position.z);

    if (altitude <= 0.05) {
      this.land(arena, this.config.groundSpeed * 1.35);
      return;
    }

    if (this.jetExitToHover && this.energy.has(this.config.hoverMaintainMinimum)) {
      this.enterHover(Math.max(this.velocity.y, this.config.hoverLift * 0.22), { latch: true });
      return;
    }

    if (hoverIntent && this.energy.has(this.config.hoverMaintainMinimum)) {
      this.enterHover(Math.max(this.velocity.y, 0), { latch: true });
      return;
    }

    this.state = locomotionStates.fall;
  }

  land(arena, carrySpeed = 0) {
    this.state = locomotionStates.ground;
    this.jetExitToHover = false;
    this.position.y = arena.sampleHeight(this.position.x, this.position.z);

    if (carrySpeed > 0) {
      this.horizontalVelocity.copy(this.jetDirection).setY(0);

      if (this.horizontalVelocity.lengthSq() > 0.0001) {
        this.horizontalVelocity.normalize().multiplyScalar(carrySpeed);
      }

      this.velocity.set(this.horizontalVelocity.x, 0, this.horizontalVelocity.z);
      return;
    }

    this.velocity.set(0, 0, 0);
    this.horizontalVelocity.set(0, 0, 0);
  }

  getLocomotionPhase(locomotionMode) {
    if (locomotionMode === "idle" || !this.activeAnimationAction) {
      return performance.now() * 0.006;
    }

    const clip = this.activeAnimationAction.getClip?.();
    const duration = clip?.duration ?? 0;
    const actionTime = Number.isFinite(this.activeAnimationAction.time)
      ? this.activeAnimationAction.time
      : 0;

    if (!Number.isFinite(duration) || duration <= 0) {
      return actionTime * Math.PI * 2;
    }

    const normalizedTime = THREE.MathUtils.euclideanModulo(actionTime, duration) / duration;
    return normalizedTime * Math.PI * 2;
  }

  updateOrientation(deltaSeconds, moveDirection, lockTargetPosition) {
    let desiredForward = this.tmpForward.copy(this.forward);

    if (lockTargetPosition) {
      desiredForward = this.tmpToTarget
        .subVectors(lockTargetPosition, this.getAimOrigin(new THREE.Vector3()))
        .setY(0);

      if (desiredForward.lengthSq() > 0.001) {
        desiredForward.normalize();
      } else {
        desiredForward.copy(this.forward);
      }

      if (moveDirection.lengthSq() > 0.03) {
        desiredForward
          .multiplyScalar(gameConfig.camera.orientationBossWeight)
          .addScaledVector(moveDirection, gameConfig.camera.orientationMoveWeight)
          .normalize();
      }
    } else if (moveDirection.lengthSq() > 0.03) {
      desiredForward.copy(moveDirection).normalize();
    } else if (this.horizontalVelocity.lengthSq() > 0.05) {
      desiredForward.copy(this.horizontalVelocity).setY(0).normalize();
    }

    if (!isFiniteVector(desiredForward) || desiredForward.lengthSq() < 0.001) {
      desiredForward.copy(this.forward);
    }

    dampVectorToward(this.forward, desiredForward, 10, deltaSeconds);
    this.forward.setY(0);

    if (!isFiniteVector(this.forward) || this.forward.lengthSq() < 0.001) {
      this.forward.set(0, 0, -1);
    } else {
      this.forward.normalize();
    }

    this.updateLowerBodyFacing(deltaSeconds, moveDirection, lockTargetPosition);

    const yaw = Math.atan2(this.forward.x, this.forward.z);
    this.tmpEuler.set(0, yaw, 0);
    this.tmpQuaternion.setFromEuler(this.tmpEuler);

    if (!isFiniteQuaternion(this.visualRoot.quaternion)) {
      this.visualRoot.quaternion.identity();
    }

    this.visualRoot.quaternion.slerp(this.tmpQuaternion, 1 - Math.exp(-11 * deltaSeconds));

    if (!isFiniteQuaternion(this.visualRoot.quaternion)) {
      this.visualRoot.quaternion.identity();
    }
  }

  updatePresentation(deltaSeconds, altitude, fx) {
    if (this.animationMixer) {
      this.animationMixer.update(deltaSeconds);
    }

    this.presentationTime += deltaSeconds;
    this.damageFlash = Math.max(0, this.damageFlash - deltaSeconds * 4);

    const hoverFactor = this.state === locomotionStates.hover ? 1 : 0;
    const jetFactor = this.state === locomotionStates.jet ? 1 : 0;
    const groundFactor = this.state === locomotionStates.ground ? 1 : 0;
    const locomotionMode = groundFactor > 0 ? this.locomotionMode : "idle";
    const isWalking = locomotionMode === "walk";
    const isRunning = locomotionMode === "run";
    const isLocomoting = isWalking || isRunning;
    const maxMoveSpeed = groundFactor > 0 ? this.config.groundSpeed : this.config.hoverSpeed;
    const moveRatio = THREE.MathUtils.clamp(
      this.horizontalVelocity.length() / Math.max(maxMoveSpeed, 0.001),
      0,
      1,
    );
    const walkPhase = isLocomoting
      ? this.getLocomotionPhase(locomotionMode)
      : performance.now() * 0.006;
    const strideWave = Math.sin(walkPhase);
    const strideBounce = Math.abs(Math.cos(walkPhase));
    const rawBob =
      isLocomoting
        ? 0
        : Math.sin(performance.now() * 0.006) *
          (hoverFactor * 0.08 + jetFactor * 0.04 + groundFactor * moveRatio * 0.028);
    const bob = Number.isFinite(rawBob) ? rawBob : 0;

    this.amplifyLocomotionAnimation(moveRatio, locomotionMode);
    this.applyLowerBodyFacingOffset();

    this.visualRoot.position.y = this.presentationBaseHeight + bob;

    this.tmpRight.set(-this.forward.z, 0, this.forward.x);

    if (!isFiniteVector(this.tmpRight) || this.tmpRight.lengthSq() < 0.0001) {
      this.tmpRight.set(1, 0, 0);
    } else {
      this.tmpRight.normalize();
    }

    const localForwardSpeed = this.horizontalVelocity.dot(this.forward);
    const localStrafeSpeed = this.horizontalVelocity.dot(this.tmpRight);
    const tiltSpeedReference = groundFactor > 0 ? this.config.groundSpeed : this.config.hoverSpeed;
    const safeTiltSpeedReference = Math.max(tiltSpeedReference, 0.001);
    const forwardTiltRatio = THREE.MathUtils.clamp(localForwardSpeed / safeTiltSpeedReference, -1, 1);
    const strafeTiltRatio = THREE.MathUtils.clamp(localStrafeSpeed / safeTiltSpeedReference, -1, 1);
    const verticalTiltRatio = THREE.MathUtils.clamp(
      this.velocity.y / Math.max(this.config.hoverVerticalSpeed, 0.001),
      -1,
      1,
    );
    const jetLeanBoost = jetFactor > 0
      ? THREE.MathUtils.clamp(1 - this.jetTimer / 0.2, 0, 1)
      : 0;
    const tiltStateScale = groundFactor > 0
      ? (isLocomoting ? 0 : 0.72)
      : hoverFactor > 0
        ? 0.72
        : jetFactor > 0
          ? 0.92
          : 0.42;
    const walkLean = isLocomoting
      ? (isRunning ? 0.0012 + moveRatio * 0.0016 : 0.0008 + moveRatio * 0.001) + strideBounce * 0.0004
      : 0;
    const jetPitchBoost = jetFactor > 0
      ? forwardTiltRatio * (0.22 + jetLeanBoost * 0.18)
      : 0;
    const jetRollBoost = jetFactor > 0
      ? strafeTiltRatio * (0.18 + jetLeanBoost * 0.12)
      : 0;
    const jetYawBoost = jetFactor > 0
      ? strafeTiltRatio * -(0.06 + jetLeanBoost * 0.04)
      : 0;
    const targetPitch =
      forwardTiltRatio *
        (isRunning ? 0 : isWalking ? 0 : 0.42) *
        tiltStateScale -
      (isLocomoting ? walkLean * 0.38 : walkLean) -
      verticalTiltRatio * (hoverFactor * 0.12 + jetFactor * 0.08) +
      jetPitchBoost;
    const targetRoll =
      strafeTiltRatio *
      (isRunning ? 0 : isWalking ? 0 : 0.34) *
      tiltStateScale +
      jetRollBoost;
    const safeTargetPitch = Number.isFinite(targetPitch) ? targetPitch : 0;
    const safeTargetRoll = Number.isFinite(targetRoll) ? targetRoll : 0;
    const safeTargetYaw = Number.isFinite(localStrafeSpeed)
      ? (isLocomoting ? strafeTiltRatio * -0.06 : 0) +
        (isLocomoting ? strideWave * (isRunning ? 0.0008 : 0.0006) * moveRatio : 0) +
        jetYawBoost
      : 0;

    this.modelRoot.rotation.x = THREE.MathUtils.damp(
      this.modelRoot.rotation.x,
      safeTargetPitch,
      groundFactor > 0 ? (isWalking ? 14 : 10.5) : 8,
      deltaSeconds,
    );
    this.modelRoot.rotation.z = THREE.MathUtils.damp(
      this.modelRoot.rotation.z,
      safeTargetRoll,
      groundFactor > 0 ? (isWalking ? 14 : 10.5) : 8,
      deltaSeconds,
    );
    this.modelRoot.rotation.y = THREE.MathUtils.damp(
      this.modelRoot.rotation.y,
      safeTargetYaw,
      isWalking ? 12 : 6.5,
      deltaSeconds,
    );

    if (!isFiniteEuler(this.modelRoot.rotation)) {
      this.modelRoot.rotation.set(0, 0, 0);
    }

    if (!Number.isFinite(this.visualRoot.position.y)) {
      this.visualRoot.position.y = this.presentationBaseHeight;
    }

    this.modelRoot.position.x = 0;
    this.modelRoot.position.y = 0;
    this.modelRoot.position.z = 0;

    if (this.coreMaterial) {
      this.coreMaterial.emissiveIntensity =
        1.5 +
        hoverFactor * 0.55 +
        jetFactor * 1.25 +
        moveRatio * 0.16 +
        groundFactor * 0.08 +
        this.damageFlash * 1.2;
    } else {
      for (const accent of this.accentMaterials) {
        accent.material.emissiveIntensity =
          accent.baseIntensity +
          moveRatio * 0.08 +
          hoverFactor * 0.18 +
          jetFactor * 0.5 +
          this.damageFlash * 0.3;
      }
    }

    const boosterIntensity =
      0.12 +
      groundFactor * moveRatio * 0.32 +
      hoverFactor * (0.5 + moveRatio * 0.25) +
      jetFactor * 2.15;

    for (const material of this.boosterMaterials) {
      material.emissiveIntensity = boosterIntensity;
    }

    this.updateThrusterFx(deltaSeconds, fx, moveRatio, hoverFactor, jetFactor);

    const shadowFactor = THREE.MathUtils.clamp(1.18 - altitude * 0.11, 0.42, 1.18);
    this.contactShadow.scale.setScalar(this.shadowBaseScale * shadowFactor);
    this.contactShadow.material.opacity = THREE.MathUtils.clamp(
      0.28 - altitude * 0.016,
      0.06,
      0.28,
    );
  }

  updateThrusterFx(deltaSeconds, fx, moveRatio, hoverFactor, jetFactor) {
    const verticalRatio = THREE.MathUtils.clamp(
      Math.abs(this.velocity.y) / Math.max(this.config.hoverVerticalSpeed, 0.001),
      0,
      1,
    );
    const falling = this.state === locomotionStates.fall;
    const sustainActive = jetFactor > 0 || hoverFactor > 0 || falling;
    const airPlumeStrength = falling
      ? 0.46 + verticalRatio * 0.28 + moveRatio * 0.12
      : 0.42 + hoverFactor * 0.34 + verticalRatio * 0.22 + moveRatio * 0.1;
    const centerStrength = jetFactor > 0
      ? 2.34 + moveRatio * 0.7 + verticalRatio * 0.26
      : THREE.MathUtils.clamp(0.9 + hoverFactor * 0.56 + verticalRatio * 0.26, 0.82, 1.28);
    const footStrength = jetFactor > 0
      ? 1.68 + verticalRatio * 0.38 + moveRatio * 0.2
      : THREE.MathUtils.clamp(airPlumeStrength + 0.34, 0.78, 1.24);
    const activeStrength = Math.max(centerStrength, footStrength);

    if (!sustainActive || activeStrength <= 0.16) {
      this.hideThrusterVisuals();
      this.thrusterTimer = 0;
      return;
    }

    this.ensureThrusterVisuals();

    for (const visual of this.thrusterVisuals.side) {
      if (visual) {
        visual.group.visible = false;
      }
    }

    const centerWorldPosition = this.getCenterJetWorldPosition(this.tmpAnchorA);
    const centerDirection = this.getCenterJetExhaustDirection(this.tmpAnchorB);
    this.setThrusterVisual(
      this.thrusterVisuals.center,
      this.copyWorldPointToThrusterLocal(centerWorldPosition, this.tmpLocalPort),
      this.copyWorldDirectionToThrusterLocal(
        centerWorldPosition,
        centerDirection,
        this.tmpLocalDirection,
      ),
      centerStrength,
      { jetActive: jetFactor > 0, center: true },
    );

    for (let index = 0; index < 2; index += 1) {
      const footWorldPosition = this.getFootJetWorldPosition(index, this.tmpAnchorA);
      const footDirection = this.getFootJetExhaustDirection(index, this.tmpAnchorB);
      this.setThrusterVisual(
        this.thrusterVisuals.foot[index],
        this.copyWorldPointToThrusterLocal(footWorldPosition, this.tmpLocalPort),
        this.copyWorldDirectionToThrusterLocal(
          footWorldPosition,
          footDirection,
          this.tmpLocalDirection,
        ),
        footStrength,
        { jetActive: jetFactor > 0, foot: true },
      );
    }
  }
}

export default PlayerActor;
