import { forwardRef, useMemo } from 'react'
import * as THREE from 'three'

const PW = 1.5
const PH = 2.1
export const BAIL_TO_CENTER = PH / 2 + 0.3

/**
 * Pendant mesh. The group's origin is AT THE BAIL (top), so it can be positioned
 * directly at a chain node and rotate naturally around that pivot.
 *
 * To replace with a Blender model: swap the body content with <primitive object={gltf.scene} />
 * Make sure the GLB is exported with origin at the bail position.
 */
const Pendant = forwardRef(function Pendant(props, ref) {
  const materials = useMemo(
    () => ({
      dark: new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.85, roughness: 0.18 }),
      silver: new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.06 }),
      raised: new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.95, roughness: 0.1 }),
      edge: new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 1.0, roughness: 0.1 }),
      bail: new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1.0, roughness: 0.04 })
    }),
    []
  )

  const starGeometry = useMemo(() => {
    const pts = []
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 4
      pts.push(new THREE.Vector2(Math.cos(a) * 0.14, Math.sin(a) * 0.14))
    }
    return new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.035, bevelEnabled: false })
  }, [])

  return (
    <group ref={ref} {...props}>
      {/* Body container: offset down from origin (which is at the bail) */}
      <group position={[0, -BAIL_TO_CENTER, 0]}>
        {/* Edge bezel */}
        <mesh material={materials.edge} position={[0, 0, -0.01]}>
          <boxGeometry args={[PW + 0.04, PH + 0.04, 0.09]} />
        </mesh>
        {/* Main dark face */}
        <mesh material={materials.dark}>
          <boxGeometry args={[PW - 0.04, PH - 0.04, 0.12]} />
        </mesh>

        {/* Horizontal divider lines */}
        {[0.6, 0.1, -0.5].map((y, i) => (
          <mesh key={i} material={materials.raised} position={[0, y, 0]}>
            <boxGeometry args={[PW - 0.2, 0.015, 0.135]} />
          </mesh>
        ))}

        {/* Logo box frame */}
        <mesh material={materials.raised} position={[0, 0.78, -0.002]}>
          <boxGeometry args={[0.52, 0.5, 0.115]} />
        </mesh>
        <mesh material={materials.dark} position={[0, 0.78, 0]}>
          <boxGeometry args={[0.44, 0.42, 0.132]} />
        </mesh>

        {/* X arms */}
        {[Math.PI / 4, -Math.PI / 4].map((rot, i) => (
          <mesh key={i} material={materials.raised} position={[0, 0.78, 0]} rotation={[0, 0, rot]}>
            <boxGeometry args={[0.06, 0.3, 0.14]} />
          </mesh>
        ))}

        {/* Text rows (raised silver bars simulating embossed text) */}
        {[
          [0.42, 0.7],
          [0.24, 0.78],
          [0.14, 0.42],
          [-0.65, 0.72]
        ].map(([y, w], i) => (
          <mesh key={i} material={materials.raised} position={[0, y, 0]}>
            <boxGeometry args={[w, 0.045, 0.135]} />
          </mesh>
        ))}

        {/* 4-point diamond/star */}
        <mesh
          geometry={starGeometry}
          material={materials.silver}
          position={[0, -0.28, 0.055]}
        />
      </group>

      {/* Bail and connector at group origin (top) */}
      <mesh material={materials.bail} position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.16, 12]} />
      </mesh>
      <mesh material={materials.bail}>
        <torusGeometry args={[0.13, 0.035, 12, 24]} />
      </mesh>
    </group>
  )
})

export default Pendant
