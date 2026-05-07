import { useRef, useMemo } from 'react'
import * as THREE from 'three'

/**
 * Verlet-integrated chain with two pinned ends and a heavier "pendant" node in the middle.
 * Returns refs to the simulation state, plus a step() function to advance physics.
 *
 * The architecture: one continuous chain, both ends pinned at top anchors, pendant is
 * just a node in the middle with higher mass. Mass-weighted distance constraints keep
 * the chain from stretching even with the heavy pendant pulling down.
 */
export function useChainSimulation({
  totalNodes = 41,
  segLength = 0.24,
  gravity = -30,
  damping = 0.96,
  iterations = 24,
  pendantMass = 4,
  anchorL = new THREE.Vector3(-0.2, 6.0, 0),
  anchorR = new THREE.Vector3(0.2, 6.0, 0)
}) {
  const dt = 1 / 60
  const MID = Math.floor(totalNodes / 2)

  // Initialize chain in a U shape between the two anchors
  const nodes = useMemo(() => {
    const arr = []
    for (let i = 0; i < totalNodes; i++) {
      let p
      if (i <= MID) {
        const t = i / MID
        p = new THREE.Vector3(anchorL.x * (1 - t), anchorL.y - t * 4.5, 0)
      } else {
        const t = (i - MID) / (totalNodes - 1 - MID)
        p = new THREE.Vector3(anchorR.x * t, anchorL.y - 4.5 + t * 4.5, 0)
      }
      arr.push({
        pos: p.clone(),
        prev: p.clone(),
        lerped: p.clone(),
        pinned: i === 0 || i === totalNodes - 1,
        isPendant: i === MID,
        invMass: i === MID ? 1 / pendantMass : 1
      })
    }
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalNodes])

  const draggingRef = useRef(false)
  const mouseTargetRef = useRef(new THREE.Vector3())

  function integrate() {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      if (n.pinned) continue
      if (n.isPendant && draggingRef.current) continue

      const vx = (n.pos.x - n.prev.x) * damping
      const vy = (n.pos.y - n.prev.y) * damping
      const vz = (n.pos.z - n.prev.z) * damping
      n.prev.copy(n.pos)
      n.pos.x += vx
      n.pos.y += vy + gravity * dt * dt
      n.pos.z += vz
    }

    if (draggingRef.current) {
      const p = nodes[MID]
      p.prev.copy(p.pos)
      p.pos.lerp(mouseTargetRef.current, 0.5)
    }
  }

  function solveConstraints() {
    for (let iter = 0; iter < iterations; iter++) {
      nodes[0].pos.copy(anchorL)
      nodes[totalNodes - 1].pos.copy(anchorR)

      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i]
        const b = nodes[i + 1]
        const dx = b.pos.x - a.pos.x
        const dy = b.pos.y - a.pos.y
        const dz = b.pos.z - a.pos.z
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001
        const diff = (dist - segLength) / dist

        const aFixed = a.pinned || (a.isPendant && draggingRef.current)
        const bFixed = b.pinned || (b.isPendant && draggingRef.current)

        if (aFixed && bFixed) continue
        if (aFixed) {
          b.pos.x -= dx * diff
          b.pos.y -= dy * diff
          b.pos.z -= dz * diff
        } else if (bFixed) {
          a.pos.x += dx * diff
          a.pos.y += dy * diff
          a.pos.z += dz * diff
        } else {
          const totalInv = a.invMass + b.invMass
          const aShare = a.invMass / totalInv
          const bShare = b.invMass / totalInv
          a.pos.x += dx * diff * aShare
          a.pos.y += dy * diff * aShare
          a.pos.z += dz * diff * aShare
          b.pos.x -= dx * diff * bShare
          b.pos.y -= dy * diff * bShare
          b.pos.z -= dz * diff * bShare
        }
      }
    }
  }

  function smoothLerped(delta) {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i]
      const distance = n.lerped.distanceTo(n.pos)
      const clamped = Math.max(0.1, Math.min(1, distance))
      const speed = 14 + clamped * 30
      n.lerped.lerp(n.pos, Math.min(1, delta * speed))
    }
  }

  function step(delta) {
    integrate()
    solveConstraints()
    smoothLerped(delta)
  }

  return {
    nodes,
    midIndex: MID,
    draggingRef,
    mouseTargetRef,
    step
  }
}
