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
  // 2-axis rigid pendulum hanging from the bail.
  //   thetaZ: in-plane swing (around world Z) — driven by bail a_x
  //   thetaX: depth swing    (around world X) — driven by bail a_z
  // Two independent damped pendulums; together the body's "down" direction
  // can point anywhere in the lower hemisphere, matching a real chain pendant.
  const pendulumRef = useRef({ thetaX: 0, omegaX: 0, thetaZ: 0, omegaZ: 0 })
  const bailHistoryRef = useRef({
    x: 0, y: 0, z: 0,
    prevX: 0, prevY: 0, prevZ: 0,
    init: false
  })
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
      bh.x = bail.x; bh.y = bail.y; bh.z = bail.z
      bh.prevX = bail.x; bh.prevY = bail.y; bh.prevZ = bail.z
      bh.init = true
    }
    const dt2 = Math.max(1e-6, dt * dt)
    let ax = (bail.x - 2 * bh.x + bh.prevX) / dt2
    let ay = (bail.y - 2 * bh.y + bh.prevY) / dt2
    let az = (bail.z - 2 * bh.z + bh.prevZ) / dt2
    bh.prevX = bh.x; bh.prevY = bh.y; bh.prevZ = bh.z
    bh.x = bail.x; bh.y = bail.y; bh.z = bail.z

    // Clamp the spike that drag-start can produce, so the body doesn't snap.
    const ACC_CLAMP = 250
    ax = Math.max(-ACC_CLAMP, Math.min(ACC_CLAMP, ax))
    ay = Math.max(-ACC_CLAMP, Math.min(ACC_CLAMP, ay))
    az = Math.max(-ACC_CLAMP, Math.min(ACC_CLAMP, az))

    // Two independent rigid pendulums — one in the XY plane (Z-axis rotation,
    // driven by bail a_x) and one in the YZ plane (X-axis rotation, driven by
    // bail a_z). Each follows the standard accelerating-pivot pendulum:
    //   θ'' = −(g + a_y)/L · sin(θ) ∓ a_⊥/L · cos(θ) − c · θ'
    // Together they let the body's down-direction point anywhere in the lower
    // hemisphere, so the pendant can swing toward/away from the camera as
    // well as side-to-side. Still can't invert: gravity always restores.
    const p = pendulumRef.current
    const L = BAIL_TO_CENTER
    const g = 30
    const c = 2.5

    const accZ =
      -((g + ay) / L) * Math.sin(p.thetaZ)
      - (ax / L) * Math.cos(p.thetaZ)
      - c * p.omegaZ
    p.omegaZ += accZ * dt
    p.thetaZ += p.omegaZ * dt

    // Sign on a_z is +: positive thetaX rotates the body toward -Z, so a +Z
    // bail acceleration (body lags in -Z) drives positive thetaX.
    const accX =
      -((g + ay) / L) * Math.sin(p.thetaX)
      + (az / L) * Math.cos(p.thetaX)
      - c * p.omegaX
    p.omegaX += accX * dt
    p.thetaX += p.omegaX * dt

    if (pendantRef.current) {
      pendantRef.current.position.set(bail.x, bail.y, bail.z)
      pendantRef.current.rotation.set(p.thetaX, 0, p.thetaZ)
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
