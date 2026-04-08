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
    const [terrainTextures, rock09, rockFace02, cliff01, cliff02, skyTexture] = await Promise.all([
      this.loadTerrainTextures(),
      this.loaderGltf.loadAsync(assetManifest.models.rock09.scene),
      this.loaderGltf.loadAsync(assetManifest.models.rockFace02.scene),
      this.loaderGltf.loadAsync(assetManifest.models.cliffNamaqualand01.scene),
      this.loaderGltf.loadAsync(assetManifest.models.cliffNamaqualand02.scene),
      this.loaderHdr.loadAsync(assetManifest.skies.wastelandClouds.hdri),
    ]);

    this.terrainTextures = terrainTextures;
    this.rockTemplates.set("rock09", rock09.scene);
    this.rockTemplates.set("rockFace02", rockFace02.scene);
    this.rockTemplates.set("cliffNamaqualand01", cliff01.scene);
    this.rockTemplates.set("cliffNamaqualand02", cliff02.scene);

    this.applySky(skyTexture);
    this.buildTerrain();
    this.buildRockField();
    this.buildDustBands();
    this.buildHorizonSilhouettes();
  }

  async loadTerrainTextures() {
    const [rockyDiffuse, rockyNormal, rockyArm] = await Promise.all([
      this.loaderTexture.loadAsync(assetManifest.textures.rockyGravel.diffuse),
      this.loaderTexture.loadAsync(assetManifest.textures.rockyGravel.normal),
      this.loaderTexture.loadAsync(assetManifest.textures.rockyGravel.arm),
    ]);

    for (const texture of [rockyDiffuse, rockyNormal, rockyArm]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), 8);
      texture.repeat.set(16, 16);
    }

    rockyDiffuse.colorSpace = THREE.SRGBColorSpace;

    return {
      rockyDiffuse,
      rockyNormal,
      rockyArm,
    };
  }

  applySky(hdrTexture) {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const environmentMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;

    this.scene.background = hdrTexture;
    this.scene.environment = environmentMap;
    this.scene.fog = new THREE.FogExp2("#b77a47", 0.0049);

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
      color: "#bb8555",
      map: this.terrainTextures.rockyDiffuse,
      normalMap: this.terrainTextures.rockyNormal,
      roughnessMap: this.terrainTextures.rockyArm,
      metalnessMap: this.terrainTextures.rockyArm,
      aoMap: this.terrainTextures.rockyArm,
      roughness: 1,
      metalness: 0.14,
      normalScale: new THREE.Vector2(1.2, 1.2),
      envMapIntensity: 0.42,
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
    const outerScale = 1.55;
    const placements = [
      ["rock09", -48, -18, 8.5, 1.7, 0.4],
      ["rock09", -76, 34, 8.2, 1.55, -0.8],
      ["rock09", 68, -42, 7.2, 1.35, 0.1],
      ["rock09", 84, 28, 8.8, 1.65, 0.5],
      ["rockFace02", -104, 10, 16, 1.95, 0.8],
      ["rockFace02", 112, -8, 15.5, 1.8, -0.6],
      ["rockFace02", -34, 108, 13.5, 1.55, 0.25],
      ["rockFace02", 30, -118, 13.5, 1.65, -0.35],
      ["rock09", -132, -56, 10.5, 1.75, 0.1],
      ["rock09", 136, 62, 9.2, 1.45, -0.3],
      ["rock09", -146, 92, 12.5, 1.95, 0.18],
      ["rockFace02", 150, -94, 18, 2.1, -0.42],
    ].map(([templateKey, x, z, targetHeight, scale, rotation]) => ([
      templateKey,
      x * outerScale,
      z * outerScale,
      targetHeight * 1.08,
      scale,
      rotation,
    ]));

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
      [-58, 74, 8.8, 3.8, "#8c6540"],
      [58, 88, 8.2, 3.2, "#7c5638"],
      [106, 56, 7.8, 3.1, "#916641"],
      [-98, -84, 8.8, 3.6, "#7a5333"],
      [24, -124, 7.6, 3, "#855d3c"],
      [-142, 18, 9.6, 4.2, "#7b5436"],
      [144, -18, 10.4, 4.6, "#916746"],
      [-176, 132, 10.8, 4.8, "#7d5838"],
      [188, 108, 11.4, 5.2, "#916847"],
      [-212, -94, 10.6, 4.9, "#7a5535"],
      [204, -126, 12.1, 5.4, "#8d6440"],
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

    const ringGeometry = new THREE.RingGeometry(
      this.config.playRadius * 0.16,
      this.config.playRadius * 0.5,
      64,
      1,
    );
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
      new THREE.RingGeometry(
        this.config.playRadius * 0.58,
        this.config.playRadius + 30,
        64,
        1,
      ),
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

  addBackdropInstance(templateKey, {
    x,
    z,
    targetHeight,
    scale = 1,
    rotation = 0,
    yOffset = 0,
    parent = this.group,
  }) {
    const template = this.rockTemplates.get(templateKey);

    if (!template) {
      return;
    }

    const clone = cloneScene(template);
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = bounds.getSize(new THREE.Vector3());
    const height = Math.max(size.y, 0.001);
    const scaleFactor = (targetHeight / height) * scale;

    clone.scale.setScalar(scaleFactor);
    const scaledBounds = new THREE.Box3().setFromObject(clone);
    const center = scaledBounds.getCenter(new THREE.Vector3());

    clone.position.set(
      x - center.x,
      this.sampleHeight(x, z) - scaledBounds.min.y + yOffset,
      z - center.z,
    );
    clone.rotation.y = rotation;
    parent.add(clone);
  }

  buildHorizonSilhouettes() {
    const silhouettes = new THREE.Group();
    silhouettes.name = "HorizonSilhouettes";

    for (const [templateKey, x, z, targetHeight, scale, rotation, yOffset] of [
      ["cliffNamaqualand01", -246, 246, 58, 1.02, 0.18, -1.4],
      ["cliffNamaqualand02", -302, 172, 74, 1.08, 0.06, -1.8],
      ["cliffNamaqualand01", -314, 72, 46, 0.86, -0.1, -1.2],
      ["cliffNamaqualand02", 284, -184, 52, 0.88, 2.34, -1.1],
      ["cliffNamaqualand01", 222, -266, 64, 1.04, 2.56, -1.5],
      ["cliffNamaqualand02", 102, -312, 42, 0.78, 2.9, -0.9],
      ["cliffNamaqualand01", 314, 44, 38, 0.72, 1.64, -0.8],
    ]) {
      this.addBackdropInstance(templateKey, {
        x,
        z,
        targetHeight,
        scale,
        rotation,
        yOffset,
        parent: silhouettes,
      });
    }

    for (const [angle, radius, width, height, color, rotation] of [
      [0.04, this.config.playRadius + 32, 18, 21, "#6f4d35", 0.08],
      [0.1, this.config.playRadius + 44, 24, 28, "#765237", 0.12],
      [0.17, this.config.playRadius + 36, 16, 18, "#6e4c34", -0.18],
      [0.25, this.config.playRadius + 48, 20, 23, "#714d34", 0.18],
      [0.31, this.config.playRadius + 40, 18, 20, "#7b563a", 0.3],
      [0.38, this.config.playRadius + 50, 26, 30, "#6a4932", -0.16],
      [0.45, this.config.playRadius + 34, 22, 26, "#6d4b32", -0.12],
      [0.53, this.config.playRadius + 46, 20, 24, "#7a5538", 0.2],
      [0.61, this.config.playRadius + 52, 22, 25, "#7c583d", -0.1],
      [0.69, this.config.playRadius + 38, 18, 19, "#714d34", -0.22],
      [0.76, this.config.playRadius + 48, 23, 27, "#6d4a33", 0.26],
      [0.83, this.config.playRadius + 42, 24, 28, "#7c573b", 0.16],
      [0.9, this.config.playRadius + 36, 19, 21, "#6b4931", -0.08],
      [0.96, this.config.playRadius + 50, 22, 24, "#77543a", 0.12],
      [1.04, this.config.playRadius + 46, 28, 30, "#69462f", 0.18],
      [1.11, this.config.playRadius + 40, 20, 22, "#724e34", -0.14],
      [1.19, this.config.playRadius + 52, 26, 29, "#7b573a", 0.2],
    ]) {
      const radians = angle * Math.PI * 2;
      const x = Math.cos(radians) * radius;
      const z = Math.sin(radians) * radius;
      const baseY = this.sampleHeight(x, z);

      const mesa = new THREE.Mesh(
        new THREE.CylinderGeometry(width * 0.48, width, height, 7),
        new THREE.MeshStandardMaterial({
          color,
          roughness: 1,
          metalness: 0.02,
        }),
      );
      mesa.position.set(x, baseY + height * 0.48, z);
      mesa.rotation.y = rotation;
      silhouettes.add(mesa);
    }

    for (const [width, height, x, z, rotation, opacity] of [
      [110, 34, -264, 166, 0.1, 0.11],
      [86, 28, 238, -224, 0.62, 0.08],
      [72, 24, 86, -304, 0.18, 0.06],
    ]) {
      const haze = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
          color: "#d08d58",
          transparent: true,
          opacity,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );

      haze.position.set(x, this.sampleHeight(x, z) + height * 0.5 + 8, z);
      haze.rotation.y = rotation;
      silhouettes.add(haze);
    }

    this.group.add(silhouettes);
  }

  sampleHeight(x, z) {
    const distance = Math.sqrt(x * x + z * z);
    const openFactor = smoothstep(36, 140, distance);
    const outerFactor = smoothstep(176, this.config.playRadius, distance);
    const basin = -1.6 * (1 - smoothstep(0, 64, distance));
    const macroWaves =
      Math.sin(x * 0.034) * 1.2 +
      Math.cos(z * 0.041) * 0.9 +
      Math.sin((x + z) * 0.019) * 1.4;
    const erosion =
      Math.sin((x - z) * 0.061) * 0.8 +
      Math.cos(z * 0.071 + x * 0.024) * 0.55;
    const edgeRise = outerFactor * (7.2 + Math.sin(distance * 0.055) * 2);
    const plateau = THREE.MathUtils.lerp(basin, macroWaves * 0.3 + erosion * 0.18, openFactor);

    return plateau + edgeRise * 0.6;
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
