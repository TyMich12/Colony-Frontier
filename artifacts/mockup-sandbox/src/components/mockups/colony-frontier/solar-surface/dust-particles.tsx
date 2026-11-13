import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mulberry32 } from "./noise";
import { terrainHeight } from "./terrain";
import type { TerrainKind } from "./state";

const COUNT = 2400;

export function DustParticles({ kind, dust }: { kind: TerrainKind; dust: number }) {
  const matRef = useRef<THREE.PointsMaterial>(null);

  const { positions, speeds } = useMemo(() => {
    const rnd = mulberry32(kind === "moon" ? 3 : 42);
    const pos = new Float32Array(COUNT * 3);
    const spd = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i += 1) {
      const angle = rnd() * Math.PI * 2;
      const radius = rnd() * 50;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      pos[i * 3] = x;
      pos[i * 3 + 1] = terrainHeight(x, z) + 0.4 + rnd() * 14;
      pos[i * 3 + 2] = z;
      spd[i] = 0.08 + rnd() * 0.55;
    }

    return { positions: pos, speeds: spd };
  }, [kind]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useFrame((_, delta) => {
    const arr = geometry.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < COUNT; i += 1) {
      let y = arr.getY(i) + speeds[i] * delta;
      const x = arr.getX(i);
      const z = arr.getZ(i);
      const floor = terrainHeight(x, z);
      if (y > floor + 14) y = floor + 0.4;
      arr.setY(i, y);
    }

    arr.needsUpdate = true;
    if (matRef.current) {
      matRef.current.opacity = 0.12 + (dust / 100) * 0.78;
    }
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial
        ref={matRef}
        size={0.15}
        color={kind === "moon" ? "#b8b2a6" : "#c98a5e"}
        transparent
        opacity={0.2}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}