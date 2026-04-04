# Player Robot Model Candidates

Checked on 2026-04-04.

This note documents evaluated third-party player-model candidates for the humanoid robot player replacement.

No external model file was added in this pass.

Reasons:

- The best Sketchfab candidates are downloadable under CC BY, but Sketchfab's official download flow requires an authenticated Sketchfab account and a tokenized download request.
- The strongest Fab candidates are purchasable and technically suitable, but Fab Standard License assets should not be redistributed as standalone raw source assets. That makes blind check-in to the repository unsafe unless acquisition and repository usage are intentionally managed.
- Mixamo is useful as an animation step, not as a safe raw asset package to commit. Its raw files should not be redistributed standalone.

## Recommended order

### 1. Sketchfab: Robot No.2 - Rigged - Animated
- URL: https://sketchfab.com/3d-models/robot-no2-rigged-animated-cf97b7d0c93a45efb59229c029341526
- Why it stands out:
  - Free and CC BY
  - Rigged
  - Includes Idle / Walk / Run
  - High detail for a free option: 536.3k triangles
  - Sketchfab downloadable models are exportable as glTF, which is easy to load with three.js
- Risks / caveats:
  - Needs Sketchfab login to actually download
  - Attribution must travel with the asset
- Verdict:
  - Best free candidate if we want quality plus ready-to-test animation clips

### 2. Fab: Humanoid Robot by Aozora
- URL: https://www.fab.com/listings/1aedb6db-9b34-4e09-840a-840ccdce9271
- Why it stands out:
  - Strongest production-ready balance I found for this game direction
  - Rigged to Epic skeleton
  - Includes 7 preview animations
  - 4K PBR textures
  - Includes FBX and converted GLB / glTF / USDZ
  - Two skins and customizable material masks help keep the player readable against the wasteland
- Risks / caveats:
  - Paid listing ($9.99 at check time)
  - Requires Epic / Fab acquisition flow
  - Fab Standard License allows use in projects but does not allow standalone redistribution of the raw asset
- Verdict:
  - Best paid candidate if the project is okay with a purchase and with managing the raw asset outside broad redistribution

### 3. Sketchfab: Sci-Fi Humanoid Robot by yur1_val
- URL: https://sketchfab.com/3d-models/sci-fi-humanoid-robot-12ad786ecde246e5854a61fd4f67ed49
- Why it stands out:
  - Free and CC BY
  - High-quality textured robot
  - 435.6k triangles
  - Strong chance of looking materially satisfying immediately
- Risks / caveats:
  - Rig / animation are not clearly stated in the listing summary I could verify
  - Likely needs manual rigging or Mixamo path if no usable skeleton is included
  - Needs Sketchfab login to download
- Verdict:
  - Best free visual-first fallback if we are willing to solve rigging separately

### 4. Sketchfab: ClunkBot - Rigged Humanoid Robot
- URL: https://sketchfab.com/3d-models/clunkbot-rigged-humanoid-robot-b4175b202a6e429a944390fb2edac47f
- Why it stands out:
  - Free and CC BY
  - Rigged
  - Includes simple idle and walk cycle
  - 302.5k triangles
- Risks / caveats:
  - Creator notes that the materials are tame
  - May need a stronger recolor / material pass to stand out in this wasteland game
  - Needs Sketchfab login to download
- Verdict:
  - Good fallback if we want a free rigged asset with lower integration risk than a static visual model

### 5. Sketchfab: futuristic humanoid robot 3d model by Lucianodario
- URL: https://sketchfab.com/3d-models/futuristic-humanoid-robot-3d-model-85f735db85e546e98460b8ed1ad2d8b5
- Why it stands out:
  - Free and CC BY
  - Strong black / orange contrast and aggressive silhouette
  - Visually readable against a warm wasteland palette
- Risks / caveats:
  - Four-arm combat design reads more like an enemy or elite unit than a player mech
  - Rig is not confirmed in the listing summary I verified
  - Needs Sketchfab login to download
- Verdict:
  - Strong silhouette reference, but not my first choice for the player unit

## Mixamo use policy for this project

Mixamo is still useful here, but as a follow-up step:

- Best use:
  - add locomotion and hover-transition animations to a humanoid candidate
  - test animation coverage quickly before custom animation production
- Good fit:
  - bipedal humanoid robots only
- Not safe to check in blindly:
  - raw Mixamo character or animation files should not be redistributed standalone

## Best recommendation

If we optimize for "free + legal clarity + immediate usefulness", choose:

- Sketchfab `Robot No.2 - Rigged - Animated`

If we optimize for "best-looking production asset with the fewest artistic compromises", choose:

- Fab `Humanoid Robot` by Aozora

## Practical next step

If you want me to integrate one immediately in the next step, place the downloaded asset archive under:

- `assets/_incoming/player-model/`

and tell me which candidate you picked.

Preferred target names:

- `assets/_incoming/player-model/sketchfab-robot-no2.zip`
- `assets/_incoming/player-model/fab-humanoid-robot-aozora.zip`
- `assets/_incoming/player-model/sketchfab-scifi-humanoid-yur1.zip`
