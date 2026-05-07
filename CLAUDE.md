# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server on http://localhost:5173 (auto-opens browser)
- `npm run build` — production build
- `npm run preview` — serve the production build

There is no linter, type checker, or test suite configured.

## Architecture

This is a single-scene React Three Fiber app. The interesting design decisions live in three files; the rest is plumbing.

### One chain, not two

The necklace is **one continuous chain of 41 nodes**, not two chains joined by a pendant. Both endpoints are pinned to anchor points at the top (close together so they read as a single clasp), and the middle node (`midIndex = floor(totalNodes / 2)`) is flagged `isPendant` with `invMass = 1/pendantMass` so it sags under gravity to form the U shape. Mass-weighted PBD distance constraints keep the chain from stretching even with the heavy middle.

Implications when modifying:
- The pendant is *a chain node*, not a separate body. To move/pin the pendant, mutate `nodes[midIndex]` directly.
- `solveConstraints` treats the pendant as fixed when `draggingRef.current` is true (see the `aFixed`/`bFixed` checks). Don't add a separate "drag" code path; the existing branch handles it.
- The two chain segments adjacent to the pendant are rendered hidden (`Chain.jsx:23`, `Chain.jsx:48`) because the bail visually replaces them.

### Pendant origin at the bail

`Pendant.jsx` is built so the **group origin sits at the bail**, not at the body center. `BAIL_TO_CENTER` (exported) is the offset; the body content is wrapped in a `<group position={[0, -BAIL_TO_CENTER, 0]}>`. This lets `Necklace.jsx` set the pendant position directly to the chain node's lerped position and have rotations pivot around the bail like real jewelry.

If swapping in a GLB, the GLB's origin must also be at the bail, or you wrap it in a translated group to compensate. README has the swap recipe.

### Simulation/rendering split

- `useChainSimulation.js` owns physics state (`nodes` array with `pos`/`prev`/`lerped`/`pinned`/`isPendant`/`invMass`) and exposes `step(delta)`, `draggingRef`, `mouseTargetRef`. The hook does *not* touch any meshes.
- `Necklace.jsx` is the orchestrator. Its `useFrame` calls `step()`, then imperatively updates pendant position/rotation and calls `updateChainMeshes()` to push node positions onto the link meshes.
- `Chain.jsx` renders torus link meshes as a Fragment (no inner group). It returns a Fragment specifically so the link meshes are direct children of `chainGroupRef` in `Necklace.jsx` — `updateChainMeshes` mutates that array. If you ever wrap the meshes in an inner `<group>`, that helper will silently target the group instead of the meshes and the chain will collapse to a single point. Exports `updateChainMeshes(meshes, nodes, midIndex)`.

### Pendant orientation: rigid pendulum (Z-axis only)

The pendant body is a **rigid pendulum** hanging from the bail. Single DOF: Z-axis tilt `θ` from straight-down. Each frame, `Necklace.jsx`:

1. Computes the bail's lateral and vertical acceleration (`a_x`, `a_y`) by second-differencing `node.lerped` over the last three frames (history kept in `bailHistoryRef`). Clamped to `±ACC_CLAMP` so a drag-start spike can't snap the body.
2. Integrates the standard accelerating-pivot pendulum equation:
   `θ'' = −(g + a_y)/L · sin(θ) − a_x/L · cos(θ) − c · θ'`
   with `L = BAIL_TO_CENTER`, `g = 30` (matches chain gravity), `c = 2.5` (under-damped). Semi-implicit Euler, real `delta`.
3. Sets `pendantRef.rotation.z = θ` and position to `bail.lerped`. Done.

Why this and not chain-direction alignment: aligning the pendant with the chain's hang direction *flips it* if the user drags the bail above the chain neighbors — a previous version did this and it looked wrong. Real pendants can't invert under any normal input because gravity always restores toward θ = 0 and the bail-joint inertia term can't push past `±π/2`. The pendulum model is also frame-rate independent (proper `dt` integration) and responds to *acceleration*, not velocity — so a steady drag produces no torque, matching real physics.

X and Y rotations are intentionally never set. In-plane chain motion can't physically tilt the pendant forward/back or twist it on its long axis; adding fake springs there just looks janky.

The hit area is rendered as a `children` of `<Pendant>` so it inherits the rotation automatically — no separate hit-area math.

`nodes[i].lerped` (a smoothed copy of `pos`) is what gets rendered, not `pos` itself. `smoothLerped()` runs after constraints each frame.

### Drag interaction

Pointer events are on a transparent `<mesh>` ("hit area" in `Necklace.jsx`) that tracks the pendant body position — *not* the bail. Each frame it's repositioned to `bail + rotate(-BAIL_TO_CENTER, swing.angle)` so the hit area follows the swinging body.

The drag converts pointer NDC to a world point on the camera's z=0 plane (`toWorld`) and writes to `mouseTargetRef`. The simulation's integrate step lerps the pendant node toward that target when `draggingRef.current` is true.

## Tuning physics

All knobs are parameters of `useChainSimulation({...})`. Defaults and effects are documented in the README under "Tuning". When the chain looks wrong, change these before changing the algorithm.
