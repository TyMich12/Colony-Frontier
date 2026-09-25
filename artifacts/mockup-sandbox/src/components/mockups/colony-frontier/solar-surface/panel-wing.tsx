import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { solarLive, smoothstep, lerp } from "./state";

const BOOM_LEN = 3.4;
const SEG_LEN = 2.8;
const SEG_WIDTH = 3.2;
const NUM_SEG = 5;
const ATTACH_RADIUS = 2.15;
const ATTACH_HEIGHT = 3.2;
const STOWED_LIFT = 1.4;

interface WingProps {
  angle: number;
  pvMaterial: THREE.Material;
  frameMaterial: THREE.Material;
  boomMaterial: THREE.Material;
  dustMaterial: THREE.Material;
  onSelect?: (name: string, role: string, explanation: string) => void;
}

function PanelSegment({
  pvMaterial,
  frameMaterial,
  dustMaterial,
  segmentIndex,
  onSelect,
}: {
  pvMaterial: THREE.Material;
  frameMaterial: THREE.Material;
  dustMaterial: THREE.Material;
  segmentIndex: number;
  onSelect?: (name: string, role: string, explanation: string) => void;
}) {
  return (
    <group>
      <mesh position={[SEG_LEN / 2, 0, 0]} material={frameMaterial} castShadow receiveShadow>
        <boxGeometry args={[SEG_LEN - 0.08, 0.1, SEG_WIDTH]} />
      </mesh>
      {[-SEG_WIDTH / 3, 0, SEG_WIDTH / 3].map((z) => (
        <mesh key={z} position={[SEG_LEN / 2, -0.11, z]} material={frameMaterial} castShadow>
          <boxGeometry args={[SEG_LEN - 0.2, 0.14, 0.08]} />
        </mesh>
      ))}
      <mesh
        position={[SEG_LEN / 2, 0.075, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pvMaterial}
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(
            "Solar panel segment " + (segmentIndex + 1),
            "Converts sunlight into electrical power for the colony.",
            "Photovoltaic cells absorb photons and create charge carriers. The panel strings combine many cells so generated DC power can be routed into the colony power system. Dust progressively blocks and scatters incoming light, reducing output.",
          );
        }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = ""; }}
      >
        <planeGeometry args={[SEG_LEN * 0.9, SEG_WIDTH * 0.9]} />
      </mesh>
      <mesh
        position={[SEG_LEN / 2, 0.091, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={dustMaterial}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(
            "Solar panel segment " + (segmentIndex + 1),
            "Converts sunlight into electrical power for the colony.",
            "Photovoltaic cells absorb photons and create charge carriers. The panel strings combine many cells so generated DC power can be routed into the colony power system. Dust progressively blocks and scatters incoming light, reducing output.",
          );
        }}
      >
        <planeGeometry args={[SEG_LEN * 0.9, SEG_WIDTH * 0.9]} />
      </mesh>
      {[-SEG_WIDTH / 2 + 0.3, SEG_WIDTH / 2 - 0.3].map((z) => (
        <mesh
          key={z}
          position={[0, 0, z]}
          rotation={[Math.PI / 2, 0, 0]}
          material={frameMaterial}
          castShadow
        >
          <cylinderGeometry args={[0.12, 0.12, 0.5, 12]} />
        </mesh>
      ))}
    </group>
  );
}

export function PanelWing({
  angle,
  pvMaterial,
  frameMaterial,
  boomMaterial,
  dustMaterial,
  onSelect,
}: WingProps) {
  const liftRef = useRef<THREE.Group>(null);
  const segRefs = useRef<(THREE.Group | null)[]>([]);

  const stowedAngles = useMemo(
    () =>
      Array.from({ length: NUM_SEG }, (_, i) =>
        (i % 2 === 0 ? 1 : -1) * Math.PI * 0.95,
      ),
    [],
  );

  useFrame(() => {
    const t = solarLive.deploy;
    const phaseLift = smoothstep(0, 0.4, t);
    const phaseUnfold = smoothstep(0.4, 1, t);

    if (liftRef.current) {
      liftRef.current.rotation.z = lerp(STOWED_LIFT, 0, phaseLift);
    }

    for (let i = 0; i < NUM_SEG; i += 1) {
      const g = segRefs.current[i];
      if (g) g.rotation.z = stowedAngles[i] * (1 - phaseUnfold);
    }
  });

  const buildChain = (i: number): React.ReactNode => {
    if (i >= NUM_SEG) return null;

    return (
      <group
        ref={(element) => {
          segRefs.current[i] = element;
        }}
        position={i === 0 ? [BOOM_LEN, 0, 0] : [SEG_LEN, 0, 0]}
      >
        <PanelSegment
          pvMaterial={pvMaterial}
          frameMaterial={frameMaterial}
          dustMaterial={dustMaterial}
          segmentIndex={i}
          onSelect={onSelect}
        />
        {buildChain(i + 1)}
      </group>
    );
  };

  return (
    <group rotation={[0, angle, 0]}>
      <group ref={liftRef} position={[ATTACH_RADIUS, ATTACH_HEIGHT, 0]}>
        <mesh
          position={[BOOM_LEN / 2, 0, 0]}
          material={boomMaterial}
          castShadow
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(
              "Array deployment boom",
              "Supports and deploys the solar wing.",
              "The boom carries the panel blanket away from the central hub and provides structural support during deployment and operation. Its geometry transfers bending and torsional loads back into the spacecraft structure.",
            );
          }}
          onPointerOver={() => { document.body.style.cursor = "pointer"; }}
          onPointerOut={() => { document.body.style.cursor = ""; }}
        >
          <boxGeometry args={[BOOM_LEN, 0.22, 0.22]} />
        </mesh>
        {[0.6, 1.5, 2.4].map((x) => (
          <mesh key={x} position={[x, 0, 0]} material={boomMaterial} castShadow>
            <boxGeometry args={[0.06, 0.34, 0.34]} />
          </mesh>
        ))}
        <mesh
          position={[0.1, 0, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          material={boomMaterial}
          castShadow
        >
          <cylinderGeometry args={[0.3, 0.3, 0.7, 16]} />
        </mesh>
        <mesh position={[BOOM_LEN / 2, -0.14, 0.09]} material={boomMaterial}>
          <boxGeometry args={[BOOM_LEN, 0.05, 0.05]} />
        </mesh>
        {buildChain(0)}
      </group>
    </group>
  );
}

export { NUM_SEG, SEG_LEN, SEG_WIDTH };