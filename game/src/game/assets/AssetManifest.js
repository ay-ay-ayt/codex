function resolveProjectPath(relativePath) {
  return new URL(relativePath, import.meta.url).href;
}

export const assetManifest = Object.freeze({
  textures: {
    rockyGravel: {
      diffuse: resolveProjectPath("../../../assets/textures/terrain/rocky_gravel/rocky_gravel_diff_2k.jpg"),
      normal: resolveProjectPath("../../../assets/textures/terrain/rocky_gravel/rocky_gravel_nor_gl_2k.jpg"),
      arm: resolveProjectPath("../../../assets/textures/terrain/rocky_gravel/rocky_gravel_arm_2k.jpg"),
    },
    rocksGround05: {
      diffuse: resolveProjectPath("../../../assets/textures/terrain/rocks_ground_05/rocks_ground_05_diff_2k.jpg"),
      normal: resolveProjectPath("../../../assets/textures/terrain/rocks_ground_05/rocks_ground_05_nor_gl_2k.jpg"),
      arm: resolveProjectPath("../../../assets/textures/terrain/rocks_ground_05/rocks_ground_05_arm_2k.jpg"),
    },
  },
  models: {
    rock09: {
      scene: resolveProjectPath("../../../assets/models/environment/rocks/rock_09/rock_09_2k.gltf"),
    },
    rockFace02: {
      scene: resolveProjectPath("../../../assets/models/environment/rocks/rock_face_02/rock_face_02_2k.gltf"),
    },
  },
  skies: {
    wastelandClouds: {
      preview: resolveProjectPath("../../../assets/sky/wasteland_clouds/wasteland_clouds.jpg"),
      hdri: resolveProjectPath("../../../assets/sky/wasteland_clouds/wasteland_clouds_2k.hdr"),
    },
    mudRoadPureSky: {
      preview: resolveProjectPath("../../../assets/sky/mud_road_puresky/mud_road_puresky.jpg"),
      hdri: resolveProjectPath("../../../assets/sky/mud_road_puresky/mud_road_puresky_2k.hdr"),
    },
  },
  audioCandidatesDoc: resolveProjectPath("../../../docs/audio-candidates.md"),
});

export default assetManifest;
