# Made Mobb Pendant

An interactive 3D pendant necklace built with React Three Fiber. Drag it around, watch it swing.

Inspired by the [Vercel Ship 2024 badge](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber) and the Made Mobb 2026 commemorative pendant.

## Stack

- React 18
- Vite
- Three.js
- React Three Fiber
- Drei (for `<Environment />`)

No physics engine. The chain runs on a custom verlet integration with mass-weighted distance constraints, written from scratch in `src/hooks/useChainSimulation.js`. Lightweight enough to run smoothly without Rapier.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## How it works

The necklace is a single chain of 41 nodes. Both ends are pinned to anchor points at the top of the screen (close together so it looks like one clasp). The pendant is a single node in the middle of the chain with 4x mass, so it sags under gravity to form a natural U shape. Mass-weighted PBD distance constraints prevent the chain from stretching.

The pendant mesh is rendered with its origin at the bail (top), so when the chain node moves, the pendant follows naturally and rotates around the bail like real jewelry.

### Key files

```
src/
├── App.jsx                       Canvas + lighting setup
├── components/
│   ├── Necklace.jsx              Orchestrator: ties simulation to rendering
│   ├── Pendant.jsx               Pendant mesh (swap this with a GLB)
│   └── Chain.jsx                 Torus-link chain rendering
└── hooks/
    └── useChainSimulation.js     Verlet physics + constraint solver
```

## Swapping in a Blender model

The current pendant is built from primitive boxes to approximate the Made Mobb design. To use a real model:

1. Model the pendant in Blender. Important: **set the origin at the bail** (the loop at the top), not the center of the body. The `<group>` wrapping the GLB needs to rotate around the bail.
2. Export as `.glb` (File → Export → glTF 2.0). Embed textures.
3. Drop the file into `public/pendant.glb`.
4. Replace the body in `src/components/Pendant.jsx`:

```jsx
import { useGLTF } from '@react-three/drei'

const Pendant = forwardRef(function Pendant(props, ref) {
  const { scene } = useGLTF('/pendant.glb')
  return (
    <group ref={ref} {...props}>
      <primitive object={scene} />
    </group>
  )
})
```

If the bail position in your GLB is offset, adjust by wrapping `<primitive>` in a group with a translation so the bail lands at the group origin.

## Tuning

Most physics knobs live in `useChainSimulation.js`:

- `gravity` (default `-30`) — more negative = falls faster
- `damping` (default `0.96`) — closer to 1 = swings longer
- `pendantMass` (default `4`) — heavier = chain hangs lower
- `iterations` (default `24`) — more = stiffer chain, less stretch
- `segLength` (default `0.24`) — distance between chain links

## Credits

- Verlet chain technique adapted from classic position-based dynamics (Müller et al.)
- Pattern inspiration from [Vercel's interactive badge](https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber)
- Pendant design references the [Made Mobb 2026 silver pendant](https://mademobb.com/)
