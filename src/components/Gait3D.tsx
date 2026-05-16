import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, ContactShadows, Environment } from '@react-three/drei';
import { EffectComposer, SSAO } from '@react-three/postprocessing';
import { Box, Layers } from 'lucide-react';
import * as THREE from 'three';
import { poseStore } from '@/src/lib/poseStore';

const _camTarget = new THREE.Vector3(4, 2, 4);

// Signed angle of segment p1→p2 measured from straight-down.
// Returns 0 when p2 is directly below p1, positive = forward (right in image).
function segDir(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.atan2(p2.x - p1.x, p2.y - p1.y);
}

function Skeleton({ isWireframe }: { isWireframe: boolean }) {
  const groupRef      = useRef<THREE.Group>(null);
  const torsoRef      = useRef<THREE.Mesh>(null);
  const headRef       = useRef<THREE.Mesh>(null);
  const leftArmRef    = useRef<THREE.Group>(null);
  const rightArmRef   = useRef<THREE.Group>(null);

  // Two-segment legs: thigh group pivots at hip, shank group pivots at knee.
  const leftThighRef  = useRef<THREE.Group>(null);
  const leftShankRef  = useRef<THREE.Group>(null);
  const rightThighRef = useRef<THREE.Group>(null);
  const rightShankRef = useRef<THREE.Group>(null);

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color:            isWireframe ? '#00FFFF' : '#57f1db',
    roughness:        0.3,
    metalness:        0.8,
    emissive:         isWireframe ? '#006666' : '#005047',
    emissiveIntensity: 0.1,
    wireframe:        isWireframe,
  }), [isWireframe]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const lm = poseStore.read();

    if (lm && lm.length >= 29) {
      // ── Data-driven mode ────────────────────────────────────────────
      // Lerp factor: smooths out per-frame jitter without adding lag.
      const LERP = 0.15;

      const lHip = lm[23], lKnee = lm[25], lAnkle = lm[27];
      const rHip = lm[24], rKnee = lm[26], rAnkle = lm[28];
      const lShoulder = lm[11], lElbow = lm[13];
      const rShoulder = lm[12], rElbow = lm[14];

      // Thigh direction from vertical (hip→knee). Drives hip flexion/extension.
      const lThighDir = segDir(lHip,  lKnee);
      const rThighDir = segDir(rHip,  rKnee);

      // Shank direction relative to the parent thigh frame. Encodes knee bend:
      // when knee is straight both segments share the same direction → delta = 0;
      // when knee is flexed the shank is angled backward → delta is negative.
      const lShankRel = segDir(lKnee, lAnkle) - lThighDir;
      const rShankRel = segDir(rKnee, rAnkle) - rThighDir;

      // Arm swing driven by shoulder→elbow vector.
      const lArmDir = segDir(lShoulder, lElbow);
      const rArmDir = segDir(rShoulder, rElbow);

      // Torso lean: spine midline (hip midpoint → shoulder midpoint).
      const hipMid = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
      const shouMid = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
      const torsoLean = segDir(hipMid, shouMid);

      leftThighRef.current!.rotation.x  = THREE.MathUtils.lerp(leftThighRef.current!.rotation.x,  lThighDir,       LERP);
      leftShankRef.current!.rotation.x  = THREE.MathUtils.lerp(leftShankRef.current!.rotation.x,  lShankRel,       LERP);
      rightThighRef.current!.rotation.x = THREE.MathUtils.lerp(rightThighRef.current!.rotation.x, rThighDir,       LERP);
      rightShankRef.current!.rotation.x = THREE.MathUtils.lerp(rightShankRef.current!.rotation.x, rShankRel,       LERP);
      leftArmRef.current!.rotation.x    = THREE.MathUtils.lerp(leftArmRef.current!.rotation.x,    lArmDir,         LERP);
      rightArmRef.current!.rotation.x   = THREE.MathUtils.lerp(rightArmRef.current!.rotation.x,   rArmDir,         LERP);
      if (torsoRef.current)
        torsoRef.current.rotation.x     = THREE.MathUtils.lerp(torsoRef.current.rotation.x,       torsoLean * 0.4, LERP);

      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 1.25, 0.1);

    } else {
      // ── Procedural fallback (no pose data) ──────────────────────────
      const t          = state.clock.getElapsedTime();
      const cycleSpeed = 3.5;
      const swing      = Math.sin(t * cycleSpeed) * 0.5;  // ±0.5 rad
      const cosSwing   = Math.cos(t * cycleSpeed);

      if (leftThighRef.current)  leftThighRef.current.rotation.x  =  swing;
      if (rightThighRef.current) rightThighRef.current.rotation.x = -swing;

      // Knee bends during the backward-to-forward transition (swing phase).
      if (leftShankRef.current)  leftShankRef.current.rotation.x  = Math.max(0, -swing) * 0.65;
      if (rightShankRef.current) rightShankRef.current.rotation.x = Math.max(0,  swing) * 0.65;

      if (leftArmRef.current)  leftArmRef.current.rotation.x  = -swing * 0.8;
      if (rightArmRef.current) rightArmRef.current.rotation.x =  swing * 0.8;

      if (torsoRef.current) {
        torsoRef.current.rotation.y =  swing * 0.2;
        torsoRef.current.rotation.z = cosSwing * 0.05;
      }
      if (headRef.current)
        headRef.current.position.y = 0.5 + Math.sin(t * cycleSpeed * 2) * 0.02;

      groupRef.current.position.y = Math.sin(t * cycleSpeed * 2) * 0.04 + 1.25;
    }
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

      {/* Left arm */}
      <group ref={leftArmRef} position={[-0.25, 0.25, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <primitive object={material} attach="material" />
        </mesh>
      </group>

      {/* Right arm */}
      <group ref={rightArmRef} position={[0.25, 0.25, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 0.5, 0.06]} />
          <primitive object={material} attach="material" />
        </mesh>
      </group>

      {/* Left leg: thigh group at hip, shank group at knee */}
      <group ref={leftThighRef} position={[-0.15, -0.3, 0]}>
        {/* Thigh segment — center offset to hang below hip pivot */}
        <mesh position={[0, -0.175, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.35, 0.08]} />
          <primitive object={material} attach="material" />
        </mesh>
        {/* Knee joint — at bottom of thigh */}
        <group ref={leftShankRef} position={[0, -0.35, 0]}>
          <mesh position={[0, -0.165, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.07, 0.33, 0.07]} />
            <primitive object={material} attach="material" />
          </mesh>
          {/* Foot */}
          <mesh position={[0.09, -0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.22, 0.05, 0.09]} />
            <primitive object={material} attach="material" />
          </mesh>
        </group>
      </group>

      {/* Right leg */}
      <group ref={rightThighRef} position={[0.15, -0.3, 0]}>
        <mesh position={[0, -0.175, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.08, 0.35, 0.08]} />
          <primitive object={material} attach="material" />
        </mesh>
        <group ref={rightShankRef} position={[0, -0.35, 0]}>
          <mesh position={[0, -0.165, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.07, 0.33, 0.07]} />
            <primitive object={material} attach="material" />
          </mesh>
          <mesh position={[0.09, -0.35, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.22, 0.05, 0.09]} />
            <primitive object={material} attach="material" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function CinematicCamera() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (t < 2) {
      state.camera.position.lerp(_camTarget, 0.05);
      state.camera.lookAt(0, 1, 0);
    }
  });
  return <PerspectiveCamera makeDefault position={[10, 5, 10]} fov={50} />;
}

export default function Gait3D() {
  const [isWireframe, setIsWireframe] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // Poll the store every 300 ms to update the "LIVE" badge — cheap enough for UI only.
  useEffect(() => {
    const id = setInterval(() => {
      const live = poseStore.read() !== null;
      setIsLive(prev => prev === live ? prev : live);
    }, 300);
    return () => clearInterval(id);
  }, []);

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
            color={new THREE.Color('#000000')}
          />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md border border-outline-variant px-3 py-1.5 rounded-lg shadow-lg">
          <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_#57f1db] ${isLive ? 'bg-primary animate-pulse' : 'bg-outline-variant'}`} />
          <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">
            {isLive ? 'LIVE_POSE_DATA' : 'DEMO_ANIM'}
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
