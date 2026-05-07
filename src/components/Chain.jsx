import { useMemo } from 'react'
import * as THREE from 'three'

/**
 * Renders the chain as a series of torus meshes between consecutive nodes.
 * Skips the two segments adjacent to the pendant node (covered by the bail).
 *
 * Returns a Fragment, not a group — the parent's group is the one we hand
 * to updateChainMeshes, so its children must be the link meshes themselves.
 */
export default function Chain({ nodes, midIndex }) {
  const linkMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 1.0, roughness: 0.07 }),
    []
  )

  // Outer radius (R + t) = 0.11, so adjacent links at segLength=0.18 overlap by
  // ~0.04 and read as connected. The alternating 90° rotation in
  // updateChainMeshes makes the overlap look like real interlocking links.
  const linkGeometry = useMemo(() => new THREE.TorusGeometry(0.085, 0.025, 8, 16), [])

  return (
    <>
      {nodes.slice(0, -1).map((_, i) => {
        const hidden = i === midIndex - 1 || i === midIndex
        return (
          <mesh
            key={i}
            geometry={linkGeometry}
            material={linkMaterial}
            visible={!hidden}
          />
        )
      })}
    </>
  )
}

/**
 * Helper: update link mesh positions/orientations from chain nodes.
 * Called from the parent's useFrame so the simulation stays centralized.
 */
export function updateChainMeshes(linkMeshes, nodes, midIndex) {
  const up = new THREE.Vector3(0, 1, 0)
  const dir = new THREE.Vector3()
  for (let i = 0; i < linkMeshes.length; i++) {
    const mesh = linkMeshes[i]
    if (!mesh) continue
    if (i === midIndex - 1 || i === midIndex) continue

    const a = nodes[i].lerped
    const b = nodes[i + 1].lerped
    mesh.position.set((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5)
    dir.set(b.x - a.x, b.y - a.y, b.z - a.z)
    const len = dir.length() || 0.0001
    dir.divideScalar(len)
    mesh.quaternion.setFromUnitVectors(up, dir)
    if (i % 2 === 0) mesh.rotateY(Math.PI / 2)
  }
}
