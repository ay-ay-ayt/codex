# AGENTS.md

## Project goal
This project is a high-quality 3D robot air-combat action game.
The current priority is one polished vertical slice: a single large boss battle.

Do not aim for a bare-minimum prototype.
Aim for satisfying gameplay, readable combat, and convincing presentation.

## Current focus
Prioritize:
- one player robot
- one large boss
- one open map
- lock-on combat
- ground / hover / fall / jet states
- one main ranged attack
- energy-based movement and combat
- mobile-first controls, with PC support

Do not spend effort on future PvP or broad systems unless the task explicitly requires it.

## Core priorities
In order of importance:
1. Game feel
2. Lock-on camera quality
3. Combat readability
4. Hit feedback and VFX clarity
5. Mobile performance
6. Clean, tunable code

## Quality standard
Do not stop at "it works".

Within the target area, aim to improve:
- control feel
- camera behavior
- lock-on readability
- movement responsiveness
- hit feedback
- boss telegraph clarity
- UI clarity
- visual presentation
- stability

Avoid shallow solutions that only make the feature technically functional.

## Change policy
Keep changes limited to the target feature or target area.

However, within that area, do not settle for minimum viability.
Maximize quality within scope.

Do not choose a low-effort solution just to minimize changes.
If a better solution exists within the same scope, prefer it.

Outside the target area, preserve existing behavior unless change is clearly necessary.

## Gameplay rules
Movement is camera-relative.

Mobile controls:
- left joystick = horizontal movement
- right vertical control = ascend / descend
- right buttons = shoot / jet / hover / lock

PC controls should follow the same gameplay philosophy.

Lock-on is a core feature.
When locked on:
- the boss should remain easy to track
- the camera should reduce player burden
- vertical separation should stay readable
- movement should still feel controllable

Jet is a signature action.
It should feel powerful and useful for evasion, engagement, disengagement, and repositioning.

Energy is a shared combat resource for movement, hover, jet, and shooting.
The player should still retain some ability to act even at low energy.

## Art direction
Do not chase half-finished realism.

Prefer a strong stylized presentation using:
- clean silhouettes
- emissive accents
- readable materials
- clear weak points
- strong combat telegraphs
- attractive VFX
- cohesive color use

Visual quality should come from composition, lighting, effects, and readability, not only from model complexity.

## Environment direction
Prefer a natural wasteland battlefield over a mechanical arena.
Use dry ground, rock formations, sand, eroded terrain, and open space, while preserving combat readability and lock-on clarity.

## Asset policy
There are currently no usable local project assets to rely on by default.

External assets and libraries are allowed when they clearly improve quality and are legally safe to use.
Do not avoid external assets by default.

If required assets are missing, use clean placeholders where appropriate and clearly state which assets should be provided later.

## License and third-party rules
Only use external assets or libraries when the license is clear and compatible with this project.

Before adding any external asset or library, verify:
- the exact license is identifiable
- the source is reputable
- modification is allowed if needed
- redistribution is allowed if needed
- commercial use is allowed if needed
- attribution requirements are understood

Do not use anything with unclear, missing, or conflicting license terms.

When adding an external asset or library, record:
- what was added
- where it came from
- which license applies
- whether attribution is required

Do not add third-party assets or libraries without recording their source and license in `THIRD_PARTY.md`.
If attribution is required, add an appropriate entry to `CREDITS.md`.

## Performance rules
Prefer stable mobile performance over expensive visuals.
Avoid heavy solutions unless they provide major gameplay or presentation value.

## Workflow
For non-trivial tasks:
1. identify the real gameplay goal
2. make a short plan
3. implement
4. self-review
5. improve weak points before finishing

## Completion rule
A task is not complete just because it runs.

A task is complete when:
- the intended behavior works
- the result feels good enough
- readability is acceptable
- presentation is acceptable
- no obvious low-quality shortcut remains within scope

When instructions are ambiguous:
- prefer better combat feel over more features
- prefer readability over visual noise
- prefer polished vertical-slice quality over broad unfinished systems
- prefer mobile playability over desktop-only convenience
- prefer high-quality implementation in the target area over minimum-effort completion
