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
  totalNodes = 59,
  segLength = 0.18,
  gravity = -30,
  damping = 0.96,
  iterations = 24,
  pendantMass = 4,
  // Anchors are spread in Z so the chain hangs in a tilted plane, giving real
  // depth from the angled camera (right strand forward, left strand back).
  // World-Y is asymmetric to compensate for perspective: the closer anchor
  // (z=+1.2) is dropped and the farther one (z=-1.2) raised so both project
  // to the same screen Y. Tuned for camera (10, 1.5, 18) looking at (0,1,0);
  // re-solve if the camera moves.
  anchorL = new THREE.Vector3(-0.25, 6.26, -1.2),
  anchorR = new THREE.Vector3(0.25, 5.74, 1.2)
}) {
  const dt = 1 / 60
  const MID = Math.floor(totalNodes / 2)

  // Initialize chain in a U shape between the two anchors. Z is interpolated
  // along with X so the starting shape lies near the rest plane.
  const nodes = useMemo(() => {
    const arr = []
    for (let i = 0; i < totalNodes; i++) {
      let p
      if (i <= MID) {
        const t = i / MID
        p = new THREE.Vector3(
          anchorL.x * (1 - t),
          anchorL.y - t * 4.5,
          anchorL.z * (1 - t)
        )
      } else {
        const t = (i - MID) / (totalNodes - 1 - MID)
        p = new THREE.Vector3(
          anchorR.x * t,
          anchorL.y - 4.5 + t * 4.5,
          anchorR.z * t
        )
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
  // Accumulator for fixed-dt sub-stepping so the chain runs at a real-time
  // 60Hz regardless of render framerate (otherwise on a 30fps mobile device
  // the chain advances at half speed — slow motion).
  const accumRef = useRef(0)

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
    // Fixed-dt sub-stepping. Cap the accumulator so a long pause (tab
    // backgrounded, debugger, etc.) doesn't trigger a "spiral of death"
    // where we try to catch up by running hundreds of steps in one frame.
    accumRef.current = Math.min(0.25, accumRef.current + delta)
    while (accumRef.current >= dt) {
      integrate()
      solveConstraints()
      accumRef.current -= dt
    }
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
