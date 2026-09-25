import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { solarLive, type TerrainKind } from "./state";
import { makeDustTexture } from "./textures";

type HubProps = {
  dust: number;
  terrain: TerrainKind;
  onSelect?: (name: string, role: string, explanation: string) => void;
  selectedComponentName?: string | null;
};

const details = {
  base: ["Central structural base", "Anchors the four array wings and transfers loads into the installation.", "The base plate and primary structure distribute array bending moments, deployment loads and thermal-mechanical stresses into the foundation or spacecraft/lander structure."],
  power: ["Power conditioning enclosure", "Contains the electrical power-management hardware.", "Power electronics perform regulation and protection between the photovoltaic strings and the DC distribution bus. Maximum-power-point tracking can keep the array near its useful operating point while converters manage voltage compatibility."],
  avionics: ["Avionics and monitoring unit", "Monitors array health, temperatures, voltage and current.", "Flight computers and instrumentation monitor electrical and thermal telemetry, detect abnormal conditions and command safe operating states. Current, voltage and temperature are key observables for diagnosing array performance."],
  radiator: ["Thermal radiator panel", "Rejects waste heat from electronics.", "Electrical conversion is not lossless. Radiator surfaces provide a path for heat to leave through infrared radiation, which is essential in vacuum because there is no convective cooling."],
  drive: ["Wing deployment drive", "Provides controlled mechanical motion during array deployment.", "The deployment drive or actuator controls the transition from stowed to deployed geometry. Its interfaces must handle launch restraints, deployment loads and long-term thermal cycling."],
};

function HubHighlight({ name, selected }: { name: string; selected: boolean }) {
  if (!selected) return null;
  const material = (
    <meshBasicMaterial
      color="#45f3ff"
      transparent
      opacity={0.62}
      depthWrite={false}
      blending={THREE.AdditiveBlending}
    />
  );
  if (name === details.radiator[0]) {
    return <mesh position={[2.4, 2.6, 0]} scale={1.055}>{material}<boxGeometry args={[2.6, 1.6, 0.05]} /></mesh>;
  }
  if (name === details.drive[0]) {
    return <mesh position={[2.6, 0.75, 0]} scale={1.07}>{material}<boxGeometry args={[1.1, 1.3, 1.6]} /></mesh>;
  }
  if (name === details.power[0]) {
    return <mesh position={[0, 1.7, 0]} scale={1.025}>{material}<cylinderGeometry args={[1.5, 1.8, 3.1, 12]} /></mesh>;
  }
  if (name === details.avionics[0]) {
    return <mesh position={[0, 4.2, 0]} scale={1.04}>{material}<boxGeometry args={[1.2, 1.2, 1.2]} /></mesh>;
  }
  return <mesh position={[0, 0.05, 0]} scale={1.045}>{material}<cylinderGeometry args={[3.4, 3.8, 0.3, 40]} /></mesh>;
}

export function CentralHub({ dust, terrain, onSelect, selectedComponentName }: HubProps) {
  const indicatorRef = useRef<THREE.MeshStandardMaterial>(null);
  const gridRef = useRef<THREE.MeshStandardMaterial>(null);
  const dustTexture = useMemo(() => makeDustTexture(terrain), [terrain]);
  const dustMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: dustTexture,
        color: "#ffffff",
        roughness: 1,
        metalness: 0,
        transparent: true,
        alphaTest: 0.01,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [dustTexture],
  );

  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c9ccd2", metalness: 0.85, roughness: 0.35 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a3d44", metalness: 0.7, roughness: 0.5 }), []);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#caa14a", metalness: 0.9, roughness: 0.25 }), []);

  const select = (event: { stopPropagation: () => void }, info: string[]) => {
    event.stopPropagation();
    onSelect?.(info[0], info[1], info[2]);
  };

  useFrame((state) => {
    const dustFrac = Math.max(0, Math.min(100, dust)) / 100;
    dustMaterial.opacity = dustFrac <= 0 ? 0 : Math.min(1, Math.pow(dustFrac, 0.52) * 1.18);
    dustMaterial.alphaTest = 0.01;
    dustMaterial.needsUpdate = true;
    const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.2);
    if (indicatorRef.current) indicatorRef.current.emissiveIntensity = 0.6 + pulse * 1.4;
    if (gridRef.current) gridRef.current.emissiveIntensity = 0.15 + (solarLive.powerKW / 100) * 0.9;
  });

  return (
    <group>
      <mesh position={[0, 0.05, 0]} receiveShadow material={dark} onClick={(e) => select(e, details.base)}>
        <cylinderGeometry args={[3.4, 3.8, 0.3, 40]} />
      </mesh>
      <HubHighlight name={details.base[0]} selected={selectedComponentName === details.base[0]} />
      <mesh position={[0, 0.205, 0]} material={dustMaterial}>
        <cylinderGeometry args={[3.4, 3.4, 0.012, 40]} />
      </mesh>



      <mesh position={[0, 1.7, 0]} castShadow receiveShadow material={metal} onClick={(e) => select(e, details.power)}>
        <cylinderGeometry args={[1.5, 1.8, 3.1, 12]} />
      </mesh>
      <mesh position={[0, 1.7, 0]} scale={[1.002, 1.002, 1.002]} material={dustMaterial}>
        <cylinderGeometry args={[1.5, 1.8, 3.1, 12]} />
      </mesh>
      <mesh position={[0, 1.35, 0]} material={dustMaterial}>
        <cylinderGeometry args={[1.85, 1.85, 0.012, 12]} />
      </mesh>
      <mesh position={[0, 3.602, 0]} material={dustMaterial}>
        <cylinderGeometry args={[2.15, 2.15, 0.012, 12]} />
      </mesh>
      <HubHighlight name={details.power[0]} selected={selectedComponentName === details.power[0]} />

      <mesh position={[0, 0.9, 0]} castShadow material={gold} onClick={(e) => select(e, details.power)}>
        <cylinderGeometry args={[1.85, 1.85, 0.9, 12]} />
      </mesh>

      <mesh position={[0, 3.35, 0]} castShadow material={metal} onClick={(e) => select(e, details.power)}>
        <cylinderGeometry args={[2.15, 1.6, 0.5, 12]} />
      </mesh>

      <mesh position={[0, 4.2, 0]} castShadow material={metal} onClick={(e) => select(e, details.avionics)}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
      </mesh>
      <mesh position={[0, 4.2, 0]} scale={[1.003, 1.003, 1.003]} material={dustMaterial}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
      </mesh>
      <mesh position={[0, 4.805, 0]} material={dustMaterial}>
        <boxGeometry args={[1.2, 0.012, 1.2]} />
      </mesh>
      <HubHighlight name={details.avionics[0]} selected={selectedComponentName === details.avionics[0]} />

      <mesh position={[0, 4.2, 0.62]} onClick={(e) => select(e, details.avionics)}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshStandardMaterial ref={gridRef} color="#0b2a55" emissive="#2f7bff" emissiveIntensity={0.3} metalness={0.3} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.2, 0.626]} material={dustMaterial}>
        <planeGeometry args={[0.9, 0.9]} />
      </mesh>

      {[-0.5, 0, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 4.85, 0.4]} onClick={(e) => select(e, details.avionics)}>
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
            <mesh position={[2.6, 0.75, 0]} castShadow receiveShadow material={dark} onClick={(e) => select(e, details.drive)}>
              <boxGeometry args={[1.1, 1.3, 1.6]} />
            </mesh>
            <HubHighlight name={details.drive[0]} selected={selectedComponentName === details.drive[0]} />
            <mesh position={[2.6, 1.405, 0]} material={dustMaterial}>
              <boxGeometry args={[1.1, 0.012, 1.6]} />
            </mesh>
            <mesh position={[2.6, 0.75, 0]} scale={[1.003, 1.003, 1.003]} material={dustMaterial}>
              <boxGeometry args={[1.1, 1.3, 1.6]} />
            </mesh>
            {[-0.5, -0.17, 0.17, 0.5].map((z, j) => (
              <group key={j}>
                <mesh position={[3.18, 0.75, z]} castShadow material={metal}>
                  <boxGeometry args={[0.06, 1.1, 0.22]} />
                </mesh>
                <mesh position={[3.18, 0.75, z]} scale={[1.01, 1.01, 1.01]} material={dustMaterial}>
                  <boxGeometry args={[0.06, 1.1, 0.22]} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}

      {[0, 1].map((i) => {
        const a = i === 0 ? Math.PI / 4 : -Math.PI / 4 + Math.PI;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[2.4, 2.6, 0]} castShadow material={metal} onClick={(e) => select(e, details.radiator)}>
              <boxGeometry args={[2.6, 1.6, 0.05]} />
            </mesh>
            <HubHighlight name={details.radiator[0]} selected={selectedComponentName === details.radiator[0]} />
            <mesh position={[2.4, 2.6, 0]} scale={[1.003, 1.003, 1.02]} material={dustMaterial}>
              <boxGeometry args={[2.6, 1.6, 0.05]} />
            </mesh>
            {[-0.6, -0.2, 0.2, 0.6].map((y, j) => (
              <group key={j}>
                <mesh position={[2.4, 2.6 + y, 0.05]} material={dark}>
                  <boxGeometry args={[2.5, 0.06, 0.06]} />
                </mesh>
                <mesh position={[2.4, 2.6 + y, 0.05]} scale={[1.01, 1.01, 1.01]} material={dustMaterial}>
                  <boxGeometry args={[2.5, 0.06, 0.06]} />
                </mesh>
              </group>
            ))}
          </group>
        );
      })}

      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh position={[2.4, 0.0, 0]} rotation={[0, 0, Math.PI / 5]} castShadow material={metal} />
            <mesh position={[2.4, 0.01, 0]} rotation={[0, 0, Math.PI / 5]} material={dustMaterial}>
              <boxGeometry args={[0.34, 1.1, 0.02]} />
            </mesh>
            <mesh position={[3.2, -0.85, 0]} castShadow material={dark} />
            <mesh position={[3.2, -0.85, 0]} scale={[1.003, 1.003, 1.003]} material={dustMaterial}>
              <boxGeometry args={[0.7, 0.4, 0.7]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
