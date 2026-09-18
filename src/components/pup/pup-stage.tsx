// Imports three and R3F. Only pup.tsx imports this, lazily.
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { PCFShadowMap, PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import PupModel from "./pup-model";

const ENV_INTENSITY = 1.2;
const ENV_BLUR = 0.04;
const KEY_INTENSITY = 1.75;
const FILL_INTENSITY = 0.4;
const SHADOW_MAP = 2048;
const SHADOW_RADIUS = 4;
const SHADOW_BIAS = -0.0005;
const FLOOR_Y = -1.0;

function Environment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const { texture } = pmrem.fromScene(room, ENV_BLUR);
    scene.environment = texture;
    scene.environmentIntensity = ENV_INTENSITY;
    return () => {
      scene.environment = null;
      texture.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

function Placeholder() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[0.6, 24, 24]} />
      <meshStandardMaterial color="#e9c9b6" roughness={0.9} />
    </mesh>
  );
}

export default function PupStage({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0.9, 4.2], fov: 32 }}
      dpr={[1, 2]}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      shadows={{ type: PCFShadowMap }}
      style={{ touchAction: "pan-y" }}
    >
      <Environment />
      <directionalLight
        castShadow
        color="#fff1e6"
        intensity={KEY_INTENSITY}
        position={[3, 5, 2]}
        shadow-bias={SHADOW_BIAS}
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-radius={SHADOW_RADIUS}
      />
      <directionalLight color="#ffe4f0" intensity={FILL_INTENSITY} position={[-3, 2, -2]} />
      <mesh position={[0, FLOOR_Y, 0]} receiveShadow rotation-x={-Math.PI / 2}>
        <planeGeometry args={[12, 12]} />
        <shadowMaterial opacity={0.25} transparent />
      </mesh>
      <Suspense fallback={<Placeholder />}>
        <PupModel reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}
