import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import assetManifest from "../assets/AssetManifest.js";

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function setSecondaryUv(geometry) {
  const uv = geometry.getAttribute("uv");

  if (uv) {
    geometry.setAttribute("uv2", uv.clone());
  }
}

function cloneScene(source) {
  return source.clone(true);
}

export class WastelandArena {
  constructor({ scene, renderer, config }) {
    this.scene = scene;
    this.renderer = renderer;
    this.config = config;

    this.group = new THREE.Group();
    this.group.name = "WastelandArena";
    this.scene.add(this.group);

    this.terrainMesh = null;
    this.terrainMaterial = null;
    this.terrainTextures = null;
    this.rockTemplates = new Map();

    this.loaderTexture = new THREE.TextureLoader();
    this.loaderGltf = new GLTFLoader();
    this.loaderHdr = new HDRLoader();

    this.up = new THREE.Vector3(0, 1, 0);
  }

  async initialize() {
    const [terrainTextures, rock09, rockFace02, skyTexture] = await Promise.all([
      this.loadTerrainTextures(),
      this.loaderGltf.loadAsync(assetManifest.models.rock09.scene),
      this.loaderGltf.loadAsync(assetManifest.models.rockFace02.scene),
      this.loaderHdr.loadAsync(assetManifest.skies.wastelandClouds.hdri),
    ]);

    this.terrainTextures = terrainTextures;
    this.rockTemplates.set("rock09", rock09.scene);
    this.rockTemplates.set("rockFace02", rockFace02.scene);

    this.applySky(skyTexture);
    this.buildTerrain();
    this.buildRockField();
    this.buildDustBands();
  }

  async loadTerrainTextures() {
    const [rockyDiffuse, rockyNormal, rockyArm, groundDiffuse, groundNormal, groundArm] =
      await Promise.all([
        this.loaderTexture.loadAsync(assetManifest.textures.rockyGravel.diffuse),
        this.loaderTexture.loadAsync(assetManifest.textures.rockyGravel.normal),
        this.loaderTexture.loadAsync(assetManifest.textures.rockyGravel.arm),
        this.loaderTexture.loadAsync(assetManifest.textures.rocksGround05.diffuse),
        this.loaderTexture.loadAsync(assetManifest.textures.rocksGround05.normal),
        this.loaderTexture.loadAsync(assetManifest.textures.rocksGround05.arm),
      ]);

    for (const texture of [
      rockyDiffuse,
      rockyNormal,
      rockyArm,
      groundDiffuse,
      groundNormal,
      groundArm,
    ]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
      texture.repeat.set(16, 16);
    }

    rockyDiffuse.colorSpace = THREE.SRGBColorSpace;
    groundDiffuse.colorSpace = THREE.SRGBColorSpace;

    return {
      rockyDiffuse,
      rockyNormal,
      rockyArm,
      groundDiffuse,
      groundNormal,
      groundArm,
    };
  }

  applySky(hdrTexture) {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const environmentMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

    this.scene.background = hdrTexture;
    this.scene.environment = environmentMap;
    this.scene.fog = new THREE.FogExp2("#c48c53", 0.006);

    pmremGenerator.dispose();
  }

  buildTerrain() {
    const size = this.config.size;
    const geometry = new THREE.PlaneGeometry(
      size,
      size,
      this.config.terrainSegments,
      this.config.terrainSegments,
    );
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.getAttribute("position");

    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const z = position.getZ(index);
      position.setY(index, this.sampleHeight(x, z));
    }

    setSecondaryUv(geometry);
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: "#bd8d5d",
      map: this.terrainTextures.groundDiffuse,
      normalMap: this.terrainTextures.groundNormal,
      roughnessMap: this.terrainTextures.groundArm,
      metalnessMap: this.terrainTextures.groundArm,
      aoMap: this.terrainTextures.groundArm,
      roughness: 1,
      metalness: 0.18,
      normalScale: new THREE.Vector2(1.1, 1.1),
      envMapIntensity: 0.45,
    });

    this.terrainMaterial = material;
    this.terrainMesh = new THREE.Mesh(geometry, material);
    this.terrainMesh.receiveShadow = false;
    this.terrainMesh.position.y = 0;
    this.group.add(this.terrainMesh);

    const outerPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.56, size * 0.62, 14, 48),
      new THREE.MeshStandardMaterial({
        color: "#5c3d29",
        roughness: 1,
        metalness: 0.06,
      }),
    );
    outerPlate.position.y = -7.5;
    this.group.add(outerPlate);
  }

  buildRockField() {
    const placements = [
      ["rock09", -48, -18, 8.5, 1.7, 0.4],
      ["rock09", -60, 28, 7, 1.45, -0.8],
      ["rock09", 54, -34, 6.4, 1.3, 0.1],
      ["rock09", 62, 22, 8, 1.55, 0.5],
      ["rockFace02", -78, 6, 13, 1.8, 0.8],
      ["rockFace02", 80, -4, 12, 1.6, -0.6],
      ["rockFace02", -22, 72, 11, 1.45, 0.25],
      ["rockFace02", 24, -78, 10, 1.5, -0.35],
      ["rock09", -96, -40, 9, 1.6, 0.1],
      ["rock09", 96, 46, 7.4, 1.25, -0.3],
    ];

    for (const [templateKey, x, z, targetHeight, scale, rotation] of placements) {
      const template = this.rockTemplates.get(templateKey);

      if (!template) {
        continue;
      }

      const clone = cloneScene(template);
      const bounds = new THREE.Box3().setFromObject(clone);
      const size = bounds.getSize(new THREE.Vector3());
      const largest = Math.max(size.x, size.y, size.z) || 1;
      const scaleFactor = (targetHeight / largest) * scale;

      clone.scale.setScalar(scaleFactor);
      const scaledBounds = new THREE.Box3().setFromObject(clone);
      const center = scaledBounds.getCenter(new THREE.Vector3());

      clone.position.set(
        x - center.x,
        this.sampleHeight(x, z) - scaledBounds.min.y,
        z - center.z,
      );
      clone.rotation.y = rotation;
      this.group.add(clone);
    }

    for (const [x, z, radius, height, color] of [
      [-42, 58, 7.2, 3.4, "#8c6540"],
      [42, 68, 6.8, 2.8, "#7c5638"],
      [74, 42, 6.4, 2.4, "#916641"],
      [-70, -62, 7.4, 3.1, "#7a5333"],
      [18, -88, 6, 2.6, "#855d3c"],
    ]) {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.7, radius, height, 7),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 1,
          metalness: 0.04,
        }),
      );

      mesh.position.set(x, this.sampleHeight(x, z) + height * 0.5, z);
      mesh.rotation.y = (x + z) * 0.03;
      this.group.add(mesh);
    }
  }

  buildDustBands() {
    const dustGroup = new THREE.Group();
    dustGroup.name = "DustBands";

    const ringGeometry = new THREE.RingGeometry(18, 62, 64, 1);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#e9a865",
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const innerGlow = new THREE.Mesh(ringGeometry, ringMaterial);
    innerGlow.rotation.x = -Math.PI / 2;
    innerGlow.position.y = 0.12;
    dustGroup.add(innerGlow);

    const farGlow = new THREE.Mesh(
      new THREE.RingGeometry(72, this.config.playRadius + 8, 64, 1),
      new THREE.MeshBasicMaterial({
        color: "#d38b46",
        transparent: true,
        opacity: 0.05,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    farGlow.rotation.x = -Math.PI / 2;
    farGlow.position.y = 0.16;
    dustGroup.add(farGlow);

    this.group.add(dustGroup);
  }

  sampleHeight(x, z) {
    const distance = Math.sqrt(x * x + z * z);
    const openFactor = smoothstep(18, 62, distance);
    const outerFactor = smoothstep(56, 132, distance);
    const basin = -1.3 * (1 - smoothstep(0, 36, distance));
    const macroWaves =
      Math.sin(x * 0.034) * 1.2 +
      Math.cos(z * 0.041) * 0.9 +
      Math.sin((x + z) * 0.019) * 1.4;
    const erosion =
      Math.sin((x - z) * 0.061) * 0.8 +
      Math.cos(z * 0.071 + x * 0.024) * 0.55;
    const edgeRise = outerFactor * (4.2 + Math.sin(distance * 0.08) * 1.2);
    const plateau = THREE.MathUtils.lerp(basin, macroWaves * 0.3 + erosion * 0.18, openFactor);

    return plateau + edgeRise * 0.52;
  }

  getPlayerSpawnPosition(target = new THREE.Vector3()) {
    const [x, , z] = this.config.playerSpawn;
    return target.set(x, this.sampleHeight(x, z), z);
  }

  getBossSpawnPosition(target = new THREE.Vector3()) {
    const [x, , z] = this.config.bossSpawn;
    return target.set(x, this.sampleHeight(x, z), z);
  }

  clampToPlayArea(position) {
    const distance = Math.sqrt(position.x * position.x + position.z * position.z);

    if (distance <= this.config.playRadius) {
      return;
    }

    const scale = this.config.playRadius / Math.max(distance, 0.0001);
    position.x *= scale;
    position.z *= scale;
  }
}

export default WastelandArena;
