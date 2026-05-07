import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useChainSimulation } from '../hooks/useChainSimulation.js'
import Pendant, { BAIL_TO_CENTER } from './Pendant.jsx'
import Chain, { updateChainMeshes } from './Chain.jsx'

export default function Necklace() {
  const { nodes, midIndex, draggingRef, mouseTargetRef, step } = useChainSimulation({})

  const pendantRef = useRef()
  const hitAreaRef = useRef()
  const chainGroupRef = useRef()
  const swingRef = useRef({ angle: 0, vel: 0 })
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
    step(Math.min(0.05, delta))

    if (chainGroupRef.current) {
      updateChainMeshes(chainGroupRef.current.children, nodes, midIndex)
    }

    // Pendant swing: damped pendulum responding to bail node's lateral motion
    const node = nodes[midIndex]
    const nodeVelX = node.pos.x - node.prev.x
    const swing = swingRef.current
    const targetSwing = -nodeVelX * 1.5
    swing.vel += -swing.angle * 0.18 + (targetSwing - swing.angle) * 0.05
    swing.vel *= 0.92
    swing.angle = Math.max(-0.7, Math.min(0.7, swing.angle + swing.vel))

    const bail = nodes[midIndex].lerped

    if (pendantRef.current) {
      pendantRef.current.position.set(bail.x, bail.y, bail.z)
      pendantRef.current.rotation.set(0.04, swing.angle * 0.15, swing.angle)
    }

    // Hit area: track pendant body position (rotated down from bail by swing angle)
    if (hitAreaRef.current) {
      hitAreaRef.current.position.set(
        bail.x + Math.sin(swing.angle) * -BAIL_TO_CENTER,
        bail.y + Math.cos(swing.angle) * -BAIL_TO_CENTER,
        bail.z
      )
      hitAreaRef.current.rotation.set(0, 0, swing.angle)
    }

    if (typeof document !== 'undefined') {
      document.body.style.cursor = draggingRef.current ? 'grabbing' : hovered ? 'grab' : 'auto'
    }
  })

  return (
    <>
      <Pendant ref={pendantRef} />

      <mesh
        ref={hitAreaRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[2, 2.6, 0.6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <group ref={chainGroupRef}>
        <Chain nodes={nodes} midIndex={midIndex} />
      </group>
    </>
  )
}
