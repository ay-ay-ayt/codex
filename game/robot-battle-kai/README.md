# 3D Robot Air Combat Boss Battle

A high-quality 3D robot air-combat action game focused on a polished single large-boss battle vertical slice.

## Current Goal

Build and refine one satisfying boss-fight prototype with:

- one player robot
- one large boss
- one open map
- lock-on combat
- ground / hover / fall / jet states
- one main ranged attack
- energy-based movement and combat
- mobile-first controls, with PC support

## Core Design Direction

- Air combat is the main focus
- The player can move between ground and air
- The boss is primarily ground-based
- The map should feel open, with some obstacles but strong visibility
- Lock-on should make combat readable and comfortable
- Energy management should matter, but should not make the player feel helpless

## Controls

### Mobile
- Left joystick: horizontal movement
- Right vertical control: ascend / descend
- Right buttons: shoot / jet / hover / lock
- Camera control by swipe mainly when lock-on is off

### PC
PC controls should follow the same gameplay philosophy as mobile:
- camera-relative movement
- vertical control
- shooting
- jet
- hover
- lock-on

## Directory Structure

- `src/` game code
- `vendor/` bundled libraries
- `assets/` models, textures, VFX, audio, UI assets
- `public/` static files for serving or distribution
- `AGENTS.md` Codex instructions and project rules
- `THIRD_PARTY.md` third-party asset and library tracking
- `CREDITS.md` public-facing credits and attribution

## Asset Policy

- Reuse local assets only when they are already good enough
- External assets and libraries may be used when they clearly improve quality and are legally safe
- Do not add third-party assets or libraries without updating `THIRD_PARTY.md`
- If attribution is required, also update `CREDITS.md`

## Quality Priorities

In order of importance:

1. Game feel
2. Lock-on camera quality
3. Combat readability
4. Hit feedback and VFX clarity
5. Mobile performance
6. Clean, tunable code

Do not stop at “it works”.
Aim for satisfying controls, readable combat, and convincing presentation.

## Notes

- Prioritize polished vertical-slice quality over broad unfinished systems
- Do not overbuild future PvP or expansion systems too early
- Prefer stable mobile performance over expensive visuals
- Prefer readability over visual noise
