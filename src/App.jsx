import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import Necklace from './components/Necklace.jsx'

export default function App() {
  return (
    <div className="scene-wrapper">
      <Canvas camera={{ position: [0, 0, 20], fov: 30 }} dpr={[1, 2]}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 6]} intensity={3} />
        <directionalLight position={[-5, 2, 4]} intensity={1.8} color="#c0d0ff" />
        <directionalLight position={[0, -4, 3]} intensity={1} color="#ffe0c0" />

        <Environment preset="studio" background={false} />

        <Necklace />
      </Canvas>
      <div className="hint">Drag the pendant</div>
    </div>
  )
}
