import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useChainSimulation } from '../hooks/useChainSimulation.js'
import Pendant, { BAIL_TO_CENTER } from './Pendant.jsx'
import Chain, { updateChainMeshes } from './Chain.jsx'

export default function Necklace() {
  const { nodes, midIndex, draggingRef, mouseTargetRef, step } = useChainSimulation({})

  const pendantRef = useRef()
  const chainGroupRef = useRef()
  // Rigid pendulum hanging from the bail. theta = Z-axis tilt from straight
  // down (radians). Only ever Z; X/Y rotations would be unphysical for a
  // pendant on a 2D-swinging chain.
  const pendulumRef = useRef({ theta: 0, omega: 0 })
  // Bail position history for computing acceleration via second-difference.
  const bailHistoryRef = useRef({ x: 0, y: 0, prevX: 0, prevY: 0, init: false })
  const [hovered, setHovered] = useState(false)

  const { camera } = useThree()
  const dragOffset = useRef(new THREE.Vector3())

  const toWorld = (pointer) => {
    const v = new THREE.Vector3(pointer.x, pointer.y, 0.5).unproject(camera)
    const dir = v.sub(camera.position).normalize()
    const t = -camera.position.z / dir.z
    return camera.position.clone().add(dir.multiplyScalar(t))
  }

  const handlePointerDown = (e) => {
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    const node = nodes[midIndex].pos
    const world = toWorld(e.pointer)
    dragOffset.current.set(world.x - node.x, world.y - node.y, 0)
    // Seed the drag target so a useFrame between pointerdown and pointermove
    // doesn't yank the pendant toward the (0,0,0) default.
    mouseTargetRef.current.copy(node)
    draggingRef.current = true
  }

  const handlePointerUp = (e) => {
    if (e.target.releasePointerCapture) e.target.releasePointerCapture(e.pointerId)
    draggingRef.current = false
  }

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return
    const world = toWorld(e.pointer)
    mouseTargetRef.current.set(world.x - dragOffset.current.x, world.y - dragOffset.current.y, 0)
  }

  useFrame((state, delta) => {
    const dt = Math.min(0.05, delta)
    step(dt)

    if (chainGroupRef.current) {
      updateChainMeshes(chainGroupRef.current.children, nodes, midIndex)
    }

    const node = nodes[midIndex]
    const bail = node.lerped

    // Bail acceleration via second-difference of its rendered position.
    const bh = bailHistoryRef.current
    if (!bh.init) {
      bh.x = bail.x; bh.y = bail.y
      bh.prevX = bail.x; bh.prevY = bail.y
      bh.init = true
    }
    const dt2 = Math.max(1e-6, dt * dt)
    let ax = (bail.x - 2 * bh.x + bh.prevX) / dt2
    let ay = (bail.y - 2 * bh.y + bh.prevY) / dt2
    bh.prevX = bh.x; bh.prevY = bh.y
    bh.x = bail.x; bh.y = bail.y

    // Clamp the spike that drag-start can produce, so the body doesn't snap.
    const ACC_CLAMP = 250
    ax = Math.max(-ACC_CLAMP, Math.min(ACC_CLAMP, ax))
    ay = Math.max(-ACC_CLAMP, Math.min(ACC_CLAMP, ay))

    // Rigid pendulum. The body's only DOF is Z-axis tilt; gravity always
    // restores toward straight-down, and bail acceleration kicks it through
    // the standard accelerating-pivot inertial torque. This is exactly the
    // motion of a real pendant on a chain — it can never invert under normal
    // input, because gravity and inertia don't push past θ = ±π/2.
    //   θ'' = −(g + a_y)/L · sin(θ) − a_x/L · cos(θ) − c · θ'
    const p = pendulumRef.current
    const L = BAIL_TO_CENTER
    const g = 30 // matches chain-sim gravity for consistent timing
    const c = 2.5 // damping coefficient (under-damped, so it swings visibly)
    const accRot =
      -((g + ay) / L) * Math.sin(p.theta)
      - (ax / L) * Math.cos(p.theta)
      - c * p.omega
    p.omega += accRot * dt
    p.theta += p.omega * dt

    if (pendantRef.current) {
      pendantRef.current.position.set(bail.x, bail.y, bail.z)
      pendantRef.current.rotation.set(0, 0, p.theta)
    }

    if (typeof document !== 'undefined') {
      document.body.style.cursor = draggingRef.current ? 'grabbing' : hovered ? 'grab' : 'auto'
    }
  })

  return (
    <>
      <Pendant ref={pendantRef}>
        <mesh
          position={[0, -BAIL_TO_CENTER, 0]}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <boxGeometry args={[2, 2.6, 0.6]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </Pendant>

      <group ref={chainGroupRef}>
        <Chain nodes={nodes} midIndex={midIndex} />
      </group>
    </>
  )
}
