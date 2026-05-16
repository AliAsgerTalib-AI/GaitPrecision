import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, ContactShadows, Environment } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { Box, Layers } from 'lucide-react';
import * as THREE from 'three';

function Skeleton({ isWireframe }: { isWireframe: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);

  // Reusable material with AO-like properties
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: isWireframe ? "#00FFFF" : "#57f1db",
    roughness: 0.3,
    metalness: 0.8,
    emissive: isWireframe ? "#006666" : "#005047",
    emissiveIntensity: 0.1,
    wireframe: isWireframe
  }), [isWireframe]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const cycleSpeed = 3.5;
    
    const wideSwing = Math.sin(t * cycleSpeed) * 0.5;
    const cosSwing = Math.cos(t * cycleSpeed);

    if (leftLegRef.current) leftLegRef.current.rotation.x = wideSwing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -wideSwing;

    if (leftArmRef.current) leftArmRef.current.rotation.x = -wideSwing * 0.8;
    if (rightArmRef.current) rightArmRef.current.rotation.x = wideSwing * 0.8;

    if (torsoRef.current) {
      torsoRef.current.rotation.y = wideSwing * 0.2; 
      torsoRef.current.rotation.z = cosSwing * 0.05; 
    }

    if (headRef.current) {
      headRef.current.rotation.y = -wideSwing * 0.1;
      headRef.current.position.y = 0.5 + Math.sin(t * cycleSpeed * 2) * 0.02;
    }
    
    groupRef.current.position.y = Math.sin(t * cycleSpeed * 2) * 0.04 + 1.25;
  });

  return (
    <group ref={groupRef}>
      {/* Torso */}
      <mesh ref={torsoRef} position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.6, 0.2]} />
        <primitive object={material} attach="material" />
      </mesh>
      
      {/* Head */}
      <mesh ref={headRef} position={[0, 0.5, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.15, 32, 32]} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* Left Leg Joint (Hip) */}
      <group ref={leftLegRef} position={[-0.15, -0.3, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.6, 0.08]} />
          <primitive object={material} attach="material" />
        </mesh>
      </group>

      {/* Right Leg Joint (Hip) */}
      <group ref={rightLegRef} position={[0.15, -0.3, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.6, 0.08]} />
          <primitive object={material} attach="material" />
        </mesh>
      </group>

      {/* Left Arm Joint (Shoulder) */}
      <group ref={leftArmRef} position={[-0.25, 0.25, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <primitive object={material} attach="material" />
        </mesh>
      </group>

      {/* Right Arm Joint (Shoulder) */}
      <group ref={rightArmRef} position={[0.25, 0.25, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <primitive object={material} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

function CinematicCamera() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (t < 2) {
      // Smoothly fly in from a distance
      state.camera.position.lerp(new THREE.Vector3(4, 2, 4), 0.05);
      state.camera.lookAt(0, 1, 0);
    }
  });
  return <PerspectiveCamera makeDefault position={[10, 5, 10]} fov={50} />;
}

export default function Gait3D() {
  const [isWireframe, setIsWireframe] = useState(false);

  return (
    <div className="w-full h-full bg-surface-container-lowest rounded-2xl border border-outline-variant relative overflow-hidden shadow-inner group">
      <Canvas shadows gl={{ antialias: false }}>
        <CinematicCamera />
        <OrbitControls 
          enableZoom={true} 
          enableDamping={true}
          dampingFactor={0.08}
          rotateSpeed={0.7}
          zoomSpeed={1.2}
          autoRotate={false} 
          maxPolarAngle={Math.PI / 2} 
          minDistance={2}
          maxDistance={15}
          makeDefault
        />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} castShadow intensity={2} />
        <pointLight position={[-10, -10, -10]} color="#57f1db" intensity={0.5} />
        
        <Environment preset="city" />
        
        <gridHelper args={[20, 20, '#1e293b', '#0f172a']} position={[0, -0.5, 0]} />
        
        <ContactShadows 
          position={[0, -0.5, 0]} 
          opacity={0.6} 
          scale={10} 
          blur={2.5} 
          far={1} 
          color="#000000"
        />

        <Skeleton isWireframe={isWireframe} />

        <EffectComposer multisampling={0}>
          <SSAO 
            samples={31} 
            radius={0.1} 
            intensity={20} 
            luminanceInfluence={0.1} 
            color={new THREE.Color("#000000")} 
          />
        </EffectComposer>
      </Canvas>
      
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md border border-outline-variant px-3 py-1.5 rounded-lg shadow-lg">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#57f1db]" />
          <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">
            3D_RECON_ACTIVE
          </span>
        </div>
        <div className="bg-surface/40 backdrop-blur-sm border border-outline-variant/30 px-2 py-1 rounded text-[8px] font-mono text-on-surface-variant uppercase tracking-tighter">
          Orbit_Controls: Active
        </div>
        <button 
          onClick={() => setIsWireframe(!isWireframe)}
          className="flex items-center gap-2 bg-surface/60 hover:bg-surface/80 backdrop-blur-sm border border-outline-variant/30 px-3 py-1.5 rounded-lg text-[8px] font-mono text-on-surface transition-all active:scale-95 uppercase tracking-widest font-bold"
        >
          {isWireframe ? <Box className="w-3 h-3 text-primary" /> : <Layers className="w-3 h-3 text-primary" />}
          {isWireframe ? 'View_Solid' : 'View_Wireframe'}
        </button>
      </div>

      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="font-mono text-[9px] text-primary font-bold uppercase tracking-widest bg-surface/80 backdrop-blur px-3 py-2 rounded-lg border border-primary/20">
          Scroll to Zoom • Drag to Rotate
        </p>
      </div>
    </div>
  );
}
