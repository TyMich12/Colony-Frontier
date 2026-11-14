import { Fragment, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  solarLive,
  smoothstep,
  lerp,
} from "./state";

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
  onSelect?: (name: string, role: string, explanation: string) => void;
  selectedComponentName?: string | null;
}

const panelInfo = (segmentIndex: number) => ({
  name: "PV cell matrix · segment " + (segmentIndex + 1),
  role: "Converts incident sunlight into DC electrical power.",
  explanation:
    "The dark blue surface represents an interconnected photovoltaic cell matrix. Individual semiconductor cells generate current when photons create electron-hole pairs; cells are wired in series and parallel to produce the required array voltage and current. The front surface is covered by a protective cover layer in real spacecraft arrays, while the backplane supports wiring and mechanical loads.",
});

const frameInfo = (segmentIndex: number) => ({
  name: "Composite panel frame · segment " + (segmentIndex + 1),
  role: "Carries mechanical loads around the photovoltaic surface.",
  explanation:
    "The frame and stiffening members resist bending and torsion while keeping the photovoltaic substrate within its allowable strain. Space arrays are designed around extremely low mass, thermal cycling and launch vibration, so the structural members are not simply cosmetic borders.",
});

const busInfo = (segmentIndex: number) => ({
  name: "Cell interconnect / bus network · segment " + (segmentIndex + 1),
  role: "Collects current from many photovoltaic cells.",
  explanation:
    "Metal interconnects and bus paths join cell strings and route generated current toward the array harness. Their resistance matters because electrical losses become heat and reduce the net power delivered to the spacecraft bus.",
});

function Highlight({
  type,
  position = [0, 0, 0],
}: {
  type: "panel" | "cylinder" | "actuator" | "frame" | "bus";
  position?: [number, number, number];
}) {
  const material = (
    <meshBasicMaterial
      color="#45f3ff"
      transparent
      opacity={0.72}
      depthWrite={false}
      blending={THREE.AdditiveBlending}
    />
  );

  if (type === "panel") {
    return (
      <mesh position={[SEG_LEN / 2, 0.105, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SEG_LEN * 0.94, SEG_WIDTH * 0.94]} />
        {material}
      </mesh>
    );
  }

  if (type === "frame") {
    return (
      <group>
        <mesh position={[SEG_LEN / 2, 0.055, SEG_WIDTH / 2 - 0.05]}>{material}<boxGeometry args={[SEG_LEN - 0.08, 0.13, 0.10]} /></mesh>
        <mesh position={[SEG_LEN / 2, 0.055, -SEG_WIDTH / 2 + 0.05]}>{material}<boxGeometry args={[SEG_LEN - 0.08, 0.13, 0.10]} /></mesh>
        <mesh position={[0.05, 0.055, 0]}>{material}<boxGeometry args={[0.10, 0.13, SEG_WIDTH]} /></mesh>
        <mesh position={[SEG_LEN - 0.05, 0.055, 0]}>{material}<boxGeometry args={[0.10, 0.13, SEG_WIDTH]} /></mesh>
      </group>
    );
  }

  if (type === "bus") {
    return (
      <group>
        {[-SEG_WIDTH / 3, 0, SEG_WIDTH / 3].map((z) => (
          <mesh key={z} position={[SEG_LEN / 2, 0.015, z]}>
            <boxGeometry args={[SEG_LEN - 0.2, 0.16, 0.11]} />
            {material}
          </mesh>
        ))}
      </group>
    );
  }

  if (type === "actuator") {
    return (
      <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.315, 0.315, 0.72, 20]} />
        {material}
      </mesh>
    );
  }

  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.13, 0.13, 0.52, 16]} />
      {material}
    </mesh>
  );
}

function PanelSegment({
  pvMaterial,
  frameMaterial,
  segmentIndex,
  onSelect,
  selectedComponentName,
}: {
  pvMaterial: THREE.Material;
  frameMaterial: THREE.Material;
  segmentIndex: number;
  onSelect?: (name: string, role: string, explanation: string) => void;
  selectedComponentName?: string | null;
}) {
  const info = panelInfo(segmentIndex);

  const frame = frameInfo(segmentIndex);
  const bus = busInfo(segmentIndex);
  const panelSelected = selectedComponentName === info.name;
  const frameSelected = selectedComponentName === frame.name;
  const busSelected = selectedComponentName === bus.name;

  return (
    <group>
      <mesh
        position={[SEG_LEN / 2, 0, 0]}
        material={frameMaterial}
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.(frame.name, frame.role, frame.explanation);
        }}
      >
        <boxGeometry args={[SEG_LEN - 0.08, 0.1, SEG_WIDTH]} />
      </mesh>

      {frameSelected && <Highlight type="frame" />}

      {[-SEG_WIDTH / 3, 0, SEG_WIDTH / 3].map((z) => (
        <mesh
          key={z}
          position={[SEG_LEN / 2, -0.11, z]}
          material={frameMaterial}
          castShadow
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(bus.name, bus.role, bus.explanation);
          }}
        >
          <boxGeometry args={[SEG_LEN - 0.32, 0.14, 0.08]} />
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
          onSelect?.(info.name, info.role, info.explanation);
        }}
      >
        <planeGeometry args={[SEG_LEN * 0.9, SEG_WIDTH * 0.9]} />
      </mesh>

      {panelSelected && <Highlight type="panel" />}

      {busSelected && <Highlight type="bus" />}

      {segmentIndex < NUM_SEG - 1 && (
        <>
          {[-SEG_WIDTH / 2 + 0.3, SEG_WIDTH / 2 - 0.3].map((z) => (
            <Fragment key={z}>
              <mesh
                position={[SEG_LEN, 0.13, z]}
                rotation={[Math.PI / 2, 0, 0]}
                material={frameMaterial}
                castShadow
                onClick={(event) => {
                  event.stopPropagation();
                  const hingeName = "Panel hinge · between segments " + (segmentIndex + 1) + "–" + (segmentIndex + 2);
                  onSelect?.(hingeName, "Controls folding between panel segments.", "The hinge transfers deployment loads while allowing the blanket to fold for launch and unfold on the surface. Bearings, flexures or geared joints must survive repeated thermal cycling and dust exposure.");
                }}
              >
                <cylinderGeometry args={[0.12, 0.12, 0.5, 12]} />
              </mesh>
            </Fragment>
          ))}
          {selectedComponentName === "Panel hinge · between segments " + (segmentIndex + 1) + "–" + (segmentIndex + 2) && (
            <>
              <Highlight type="cylinder" position={[SEG_LEN, 0.13, -SEG_WIDTH / 2 + 0.3]} />
              <Highlight type="cylinder" position={[SEG_LEN, 0.13, SEG_WIDTH / 2 - 0.3]} />
            </>
          )}
        </>
      )}
    </group>
  );
}

export function PanelWing({
  angle,
  pvMaterial,
  frameMaterial,
  boomMaterial,
  onSelect,
  selectedComponentName,
}: WingProps) {
  const liftRef = useRef<THREE.Group>(null);
  const segRefs = useRef<(THREE.Group | null)[]>([]);

  const stowedAngles = useMemo(
    () => Array.from({ length: NUM_SEG }, (_, i) => (i % 2 === 0 ? 1 : -1) * Math.PI * 0.95),
    [],
  );

  useFrame(() => {
    const t = solarLive.deploy;
    const phaseLift = smoothstep(0, 0.4, t);
    const phaseUnfold = smoothstep(0.4, 1, t);
    if (liftRef.current) liftRef.current.rotation.z = lerp(STOWED_LIFT, 0, phaseLift);
    for (let i = 0; i < NUM_SEG; i += 1) {
      const g = segRefs.current[i];
      if (g) g.rotation.z = stowedAngles[i] * (1 - phaseUnfold);
    }
  });

  const boomName = "Array deployment boom";
  const boomRole = "Supports, deploys and carries the solar wing load path.";
  const boomExplanation =
    "The deployment boom is the primary structural member between the hub and the photovoltaic blanket. It carries bending and torsional loads generated by the panel mass, solar-pressure forces, deployment transients and spacecraft motion. Real deployable arrays use lightweight high-stiffness structures and controlled deployment mechanisms.";

  const buildChain = (i: number): React.ReactNode => {
    if (i >= NUM_SEG) return null;
    return (
      <group
        ref={(element) => { segRefs.current[i] = element; }}
        position={i === 0 ? [BOOM_LEN, 0, 0] : [SEG_LEN, 0, 0]}
      >
        <PanelSegment
          pvMaterial={pvMaterial}
          frameMaterial={frameMaterial}
          segmentIndex={i}
          onSelect={onSelect}
          selectedComponentName={selectedComponentName}
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
            onSelect?.(boomName, boomRole, boomExplanation);
          }}
        >
          <boxGeometry args={[BOOM_LEN, 0.22, 0.22]} />
        </mesh>
        {selectedComponentName === boomName && (
          <mesh position={[BOOM_LEN / 2, 0, 0]}>
            <boxGeometry args={[BOOM_LEN, 0.22, 0.22]} />
            <meshBasicMaterial color="#45f3ff" transparent opacity={0.78} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        )}

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
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.("Array deployment actuator", "Drives or controls controlled deployment.", "A deployment actuator or stored-energy mechanism provides controlled motion during unfolding. Real mechanisms must tolerate launch vibration, repeated thermal cycles and vacuum lubrication constraints.");
          }}
        >
          <cylinderGeometry args={[0.3, 0.3, 0.7, 16]} />
        </mesh>
        {selectedComponentName === "Array deployment actuator" && <Highlight type="actuator" position={[0.1, 0, 0]} />}

        <mesh position={[BOOM_LEN / 2, -0.14, 0.09]} material={boomMaterial}>
          <boxGeometry args={[BOOM_LEN, 0.05, 0.05]} />
        </mesh>

        {buildChain(0)}
      </group>
    </group>
  );
}

export { NUM_SEG, SEG_LEN, SEG_WIDTH };
