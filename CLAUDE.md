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

The necklace is **one continuous chain of 47 nodes** (the default in `useChainSimulation.js`), not two chains joined by a pendant. Both endpoints are pinned to anchor points at the top, and the middle node (`midIndex = floor(totalNodes / 2)`) is flagged `isPendant` with `invMass = 1/pendantMass` so it sags under gravity to form the U shape. Mass-weighted PBD distance constraints keep the chain from stretching even with the heavy middle.

The anchors are spread in **Z as well as X** (default `(±0.25, 6, ±1.2)`) — so the chain hangs in a plane that's tilted around the Y axis rather than lying flat in z=0. From the angled camera, this gives genuine depth: the right-Z strand reads as closer, the left-Z strand as farther. Pendant rest-position is still at `(0, low_y, 0)` by symmetry. The verlet/constraint code is fully 3D; the only place 2D was assumed was the chain initialization, which now interpolates Z too.

**Fixed-dt sub-stepping.** The verlet integrator and constraint solver use a constant `dt = 1/60`. To stay at real-time speed regardless of render framerate, `step(delta)` accumulates `delta` and runs as many fixed-`dt` sub-steps as needed (capped at 0.25 sec to avoid a spiral of death after a long pause). On 30fps mobile that's 2 chain steps per render frame; on 120fps it's 1 step every other frame. Net: chain always advances 60 simulated steps per real second. Without this the chain ran at half speed on lower-fps devices (slow-motion bug). The pendulum in `Necklace.jsx` already uses real `delta`, so it didn't have the issue.

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

### Pendant orientation: 2-axis rigid pendulum

The pendant body is a **rigid pendulum** hanging from the bail with **two independent angular DOF**, both driven by the standard accelerating-pivot equation:

- `thetaZ` — in-plane swing (rotation around world Z), driven by bail `a_x`. Side-to-side.
- `thetaX` — depth swing (rotation around world X), driven by bail `a_z`. Toward/away from camera.

Each frame, `Necklace.jsx`:

1. Computes bail acceleration `(a_x, a_y, a_z)` by second-differencing `node.lerped` over three frames (history in `bailHistoryRef`). All three components clamped to `±ACC_CLAMP` so drag-start spikes can't snap the body.
2. Integrates two pendulums in parallel:
   - `θ_z'' = −(g + a_y)/L · sin(θ_z) − a_x/L · cos(θ_z) − c · θ_z'`
   - `θ_x'' = −(g + a_y)/L · sin(θ_x) **+** a_z/L · cos(θ_x) − c · θ_x'`
   Note the **sign flip on `a_z`**: positive `thetaX` rotates the body toward `-Z`, so a `+Z` bail acceleration (body lags in `-Z`) drives `+thetaX`. Constants: `L = BAIL_TO_CENTER`, `g = 30`, `c = 2.5`. Semi-implicit Euler with real `delta`.
3. Sets `pendantRef.rotation.set(thetaX, 0, thetaZ)` (XYZ Euler order — for moderate angles, this composes the two tilts cleanly). Position is set to `bail.lerped`.

Why two axes are needed now (and not before): the camera is angled, the chain plane is tilted in 3D, and dragging horizontally on screen produces world motion in *both* X and Z. A 1-axis Z-pendulum wouldn't respond at all to the Z component, and the body would look frozen for some drag directions.

Why this and not chain-direction alignment: aligning the pendant with the chain's hang direction flips it if the user drags the bail above the chain neighbors. Real pendants can never invert because gravity always restores toward θ = 0 and the inertia term can't push past `±π/2`. The pendulum model is also frame-rate independent and responds to *acceleration*, not velocity — so a steady drag produces no torque.

Y rotation (twist on the long axis) is intentionally never set: in-plane chain motion can't physically twist the pendant, and faking it looks janky.

The hit area is rendered as a `children` of `<Pendant>` so it inherits both tilts automatically.

`nodes[i].lerped` (a smoothed copy of `pos`) is what gets rendered, not `pos` itself. `smoothLerped()` runs after constraints each frame.

### Drag interaction

Pointer events are on a transparent `<mesh>` ("hit area" in `Necklace.jsx`) that tracks the pendant body position — *not* the bail. Each frame it's repositioned to `bail + rotate(-BAIL_TO_CENTER, swing.angle)` so the hit area follows the swinging body.

The drag converts pointer NDC to a world point on the camera's z=0 plane (`toWorld`) and writes to `mouseTargetRef`. The simulation's integrate step lerps the pendant node toward that target when `draggingRef.current` is true.

## Tuning physics

All knobs are parameters of `useChainSimulation({...})`. Defaults and effects are documented in the README under "Tuning". When the chain looks wrong, change these before changing the algorithm.
