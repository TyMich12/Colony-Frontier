import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { solarLive } from "./state";

export function CentralHub({ onSelect }: { onSelect?: (name: string, role: string, explanation: string) => void }) {
  const indicatorRef = useRef<THREE.MeshStandardMaterial>(null);
  const gridRef = useRef<THREE.MeshStandardMaterial>(null);

  const metal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c9ccd2",
        metalness: 0.85,
        roughness: 0.35,
      }),
    [],
  );
  const dark = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#3a3d44",
        metalness: 0.7,
        roughness: 0.5,
      }),
    [],
  );
  const gold = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#caa14a",
        metalness: 0.9,
        roughness: 0.25,
      }),
    [],
  );

  useFrame((state) => {
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.2);

    if (indicatorRef.current) {
      indicatorRef.current.emissiveIntensity = 0.6 + pulse * 1.4;
    }

    if (gridRef.current) {
      gridRef.current.emissiveIntensity = 0.15 + (solarLive.powerKW / 100) * 0.9;
    }
  });

  return (
    <group onClick={(event) => {
      event.stopPropagation();
      onSelect?.(
        "Central power hub",
        "Collects, conditions and distributes the array output.",
        "The central hub connects the solar wings to the colony electrical system. It houses structural interfaces, power routing, monitoring hardware and deployment mechanisms that keep the four array wings operating as one power plant.",
      );
    }} onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
      <mesh position={[0, 0.05, 0]} receiveShadow material={dark}>
        <cylinderGeometry args={[3.4, 3.8, 0.3, 40]} />
      </mesh>

      <mesh position={[0, 1.7, 0]} castShadow receiveShadow material={metal}>
        <cylinderGeometry args={[1.5, 1.8, 3.1, 12]} />
      </mesh>

      <mesh position={[0, 0.9, 0]} castShadow material={gold}>
        <cylinderGeometry args={[1.85, 1.85, 0.9, 12]} />
      </mesh>

      <mesh position={[0, 3.35, 0]} castShadow material={metal}>
        <cylinderGeometry args={[2.15, 1.6, 0.5, 12]} />
      </mesh>

      <mesh position={[0, 4.2, 0]} castShadow material={metal}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
      </mesh>

      <mesh position={[0, 4.2, 0.62]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial
          ref={gridRef}
          color="#0b2a55"
          emissive="#2f7bff"
          emissiveIntensity={0.3}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>

      {[-0.5, 0, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 4.85, 0.4]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            ref={i === 1 ? indicatorRef : undefined}
            color="#0a1f0a"
            emissive={i === 1 ? "#38ff8a" : "#ff5a3c"}
            emissiveIntensity={1}
          />
        </mesh>
      ))}

      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[2.6, 0.75, 0]} castShadow receiveShadow material={dark}>
              <boxGeometry args={[1.1, 1.3, 1.6]} />
            </mesh>
            {[-0.5, -0.17, 0.17, 0.5].map((z, j) => (
              <mesh key={j} position={[3.18, 0.75, z]} castShadow material={metal}>
                <boxGeometry args={[0.06, 1.1, 0.22]} />
              </mesh>
            ))}
            <mesh position={[1.9, 0.35, 0]} material={dark}>
              <boxGeometry args={[0.5, 0.08, 0.08]} />
            </mesh>
          </group>
        );
      })}

      {[0, 1].map((i) => {
        const a = i === 0 ? Math.PI / 4 : -Math.PI / 4 + Math.PI;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[2.4, 2.6, 0]} castShadow material={metal}>
              <boxGeometry args={[2.6, 1.6, 0.05]} />
            </mesh>
            {[-0.6, -0.2, 0.2, 0.6].map((y, j) => (
              <mesh key={j} position={[2.4, 2.6 + y, 0.05]} material={dark}>
                <boxGeometry args={[2.5, 0.06, 0.06]} />
              </mesh>
            ))}
          </group>
        );
      })}

      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[2.4, 0.0, 0]} rotation={[0, 0, Math.PI / 5]} castShadow material={metal}>
              <cylinderGeometry args={[0.12, 0.12, 2.2, 10]} />
            </mesh>
            <mesh position={[3.2, -0.85, 0]} castShadow material={dark}>
              <cylinderGeometry args={[0.4, 0.5, 0.25, 14]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}