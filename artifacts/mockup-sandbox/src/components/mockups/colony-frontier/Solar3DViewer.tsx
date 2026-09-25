import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { ScanLine } from "lucide-react";
import { tierMeta, type Tier } from "./_shared/gameData";

type SolarComponent = {
  id: string;
  name: string;
  short: string;
  function: string;
  principle: string;
  detail: string;
  realBasis: string;
  position: [number, number, number];
};

const NASA_REFERENCE =
  "https://www.nasa.gov/missions/station/new-solar-arrays-to-power-nasas-international-space-station-research/";

const COMPONENTS: SolarComponent[] = [
  {
    id: "blanket",
    name: "Roll-Out Photovoltaic Blanket",
    short: "PV ARRAY",
    function: "Converts sunlight into electrical power.",
    principle: "Photovoltaic effect",
    detail:
      "The flexible blanket carries many high-efficiency photovoltaic cells arranged as electrical strings. The real ROSA/iROSA architecture trades launch volume for a much larger deployed collecting area.",
    realBasis: "NASA/Boeing ROSA and ISS iROSA technology; III-V multi-junction space solar cells.",
    position: [-6.6, 1.0, 0.0],
  },
  {
    id: "booms",
    name: "Composite Roll-Out Booms",
    short: "DEPLOYMENT STRUCTURE",
    function: "Provides the stiffness and deployment path for each wing.",
    principle: "Stored elastic strain energy",
    detail:
      "The boom is represented as a slender composite structural member supporting the blanket. Roll-out solar arrays can package deployable structure compactly and recover a rigid operating shape after launch.",
    realBasis: "NASA/Boeing ROSA-style composite slit-tube deployment architecture.",
    position: [-4.3, 0.5, 0.0],
  },
  {
    id: "gimbal",
    name: "Rotary Solar-Array Drive",
    short: "GIMBAL",
    function: "Rotates the arrays to control solar incidence.",
    principle: "Angular kinematics",
    detail:
      "The drive rotates the wing about its root so the panel normal can track the changing Sun direction. Keeping the incidence angle close to zero maximises the useful component of incoming solar irradiance.",
    realBasis: "Spacecraft solar-array drive mechanisms and ISS solar-array pointing hardware.",
    position: [-3.0, 0.1, 0.0],
  },
  {
    id: "ppu",
    name: "Power Processing Unit",
    short: "POWER ELECTRONICS",
    function: "Conditions variable photovoltaic output for the electrical bus.",
    principle: "DC-DC conversion and maximum-power-point control",
    detail:
      "Photovoltaic voltage and current vary with illumination and operating conditions. Power electronics regulate the array output, maintain a useful operating point and interface generation with the spacecraft bus.",
    realBasis: "Spacecraft electrical power systems and photovoltaic power-conditioning electronics.",
    position: [0.4, 0.9, 0.7],
  },
  {
    id: "battery",
    name: "Rechargeable Battery Pack",
    short: "ENERGY STORAGE",
    function: "Stores energy for eclipse and peak-demand periods.",
    principle: "Electrochemical energy storage",
    detail:
      "During sunlight the battery can absorb surplus generation. During eclipse it returns stored electrical energy to the bus, allowing spacecraft loads to remain powered while the array is shadowed.",
    realBasis: "Aerospace lithium-ion battery packs and spacecraft battery-management systems.",
    position: [-0.4, 0.55, -0.1],
  },
  {
    id: "radiator",
    name: "Thermal Radiator",
    short: "THERMAL CONTROL",
    function: "Rejects waste heat from the power system.",
    principle: "Thermal radiation",
    detail:
      "Vacuum removes atmospheric convection as a major heat-transfer path, so the spacecraft presents radiator surfaces with a controlled emissivity to radiate thermal energy directly to space.",
    realBasis: "Spacecraft radiator panels and active/passive thermal-control systems.",
    position: [0.2, -0.45, -1.7],
  },
  {
    id: "avionics",
    name: "Power & Avionics Controller",
    short: "CONTROL",
    function: "Monitors system health and coordinates power operations.",
    principle: "Feedback control and fault management",
    detail:
      "Sensors report voltage, current, temperature, pointing and deployment state. The controller uses those measurements to command the power system, protect hardware and isolate abnormal branches.",
    realBasis: "Distributed spacecraft avionics, electrical power management and fault-detection architectures.",
    position: [1.25, 1.1, 0.2],
  },
  {
    id: "harness",
    name: "Electrical Harness & Wing Interface",
    short: "POWER ROUTING",
    function: "Carries generated power between moving wings and the spacecraft bus.",
    principle: "Electrical conduction with mechanical strain relief",
    detail:
      "Flexible electrical paths have to tolerate deployment motion, vibration and thermal cycling while carrying useful current. The interface therefore combines electrical continuity with mechanical accommodation.",
    realBasis: "Spacecraft power harnesses, rotary interfaces and solar-array electrical routing.",
    position: [-1.0, 0.35, 0.45],
  },
];

const componentById = Object.fromEntries(
  COMPONENTS.map((component) => [component.id, component]),
) as Record<string, SolarComponent>;

const SOLAR_TIERS: Record<Tier, { name: string; mass: number; cost: number; efficiency: string }> = {
  Foundation: { name: "Helios-1", mass: 850, cost: 3, efficiency: "Reliable normal-sun output" },
  Frontier: { name: "Helios-X", mass: 1250, cost: 6.5, efficiency: "Improved low-angle performance" },
  Apex: { name: "Helios-XR", mass: 1750, cost: 12, efficiency: "Automated tracking + dust tolerance" },
  Research: { name: "Helios-Nova", mass: 1600, cost: 15, efficiency: "Extreme output in difficult light" },
};

function useEarthTexture() {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const ocean = ctx.createLinearGradient(0, 0, 0, size);
    ocean.addColorStop(0, "#173c73");
    ocean.addColorStop(0.5, "#0b274e");
    ocean.addColorStop(1, "#071b38");
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, size, size);

    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "#47745a";
    const land = [
      [110, 135, 78, 44],
      [175, 170, 64, 88],
      [255, 135, 84, 42],
      [310, 205, 58, 92],
      [388, 150, 82, 54],
      [420, 245, 38, 76],
      [268, 300, 70, 42],
      [155, 320, 48, 68],
    ];
    for (const [x, y, w, h] of land) {
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, h / 2, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#dfe9ed";
    ctx.globalAlpha = 0.38;
    ctx.beginPath();
    ctx.ellipse(250, 38, 105, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(155, 474, 145, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, []);
}

function Earth() {
  const ref = useRef<THREE.Mesh>(null);
  const texture = useEarthTexture();

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.012;
  });

  return (
    <group position={[0, -38, 0]}>
      <mesh ref={ref} rotation={[0.22, 0.2, 0.04]}>
        <sphereGeometry args={[28, 64, 64]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? "#ffffff" : "#173d70"}
          roughness={0.92}
          metalness={0}
        />
      </mesh>
      <mesh scale={1.028}>
        <sphereGeometry args={[28, 64, 64]} />
        <meshBasicMaterial
          color="#50a9ef"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Sun({ sunDirection }: { sunDirection: React.MutableRefObject<THREE.Vector3> }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (ref.current) {
      ref.current.position.copy(sunDirection.current).multiplyScalar(58);
    }
  });

  return (
    <group ref={ref}>
      <pointLight intensity={2600} distance={170} decay={2} color="#fff2cc" />
      <mesh>
        <sphereGeometry args={[2.3, 40, 40]} />
        <meshBasicMaterial color="#fff6d4" toneMapped={false} />
      </mesh>
      <mesh scale={1.65}>
        <sphereGeometry args={[2.3, 32, 32]} />
        <meshBasicMaterial
          color="#ffb44d"
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function Panel({
  position,
  rotation,
  selected,
  onSelect,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  selected: boolean;
  onSelect: () => void;
}) {
  const cells = Array.from({ length: 48 }, (_, index) => index);

  return (
    <group position={position} rotation={rotation} onClick={(event) => {
      event.stopPropagation();
      onSelect();
    }}>
      <mesh>
        <boxGeometry args={[7.2, 0.16, 2.0]} />
        <meshStandardMaterial
          color="#102f69"
          roughness={0.26}
          metalness={0.55}
          emissive={selected ? "#c48b2d" : "#071a38"}
          emissiveIntensity={selected ? 0.5 : 0.16}
        />
      </mesh>
      {cells.map((cell) => {
        const col = cell % 12;
        const row = Math.floor(cell / 12);
        const x = -3.0 + col * 0.55;
        const z = -0.66 + row * 0.44;
        return (
          <mesh key={cell} position={[x, 0.11, z]}>
            <boxGeometry args={[0.49, 0.035, 0.36]} />
            <meshStandardMaterial
              color={col % 3 === 0 ? "#244b93" : "#173a7e"}
              roughness={0.22}
              metalness={0.72}
            />
          </mesh>
        );
      })}
      <mesh position={[0, -0.11, 0]}>
        <boxGeometry args={[7.55, 0.07, 0.07]} />
        <meshStandardMaterial color="#9ea6ad" metalness={0.82} roughness={0.32} />
      </mesh>
      <mesh position={[-3.74, -0.11, 0]}>
        <boxGeometry args={[0.07, 0.07, 2.18]} />
        <meshStandardMaterial color="#9ea6ad" metalness={0.82} roughness={0.32} />
      </mesh>
      <mesh position={[3.74, -0.11, 0]}>
        <boxGeometry args={[0.07, 0.07, 2.18]} />
        <meshStandardMaterial color="#9ea6ad" metalness={0.82} roughness={0.32} />
      </mesh>
    </group>
  );
}

function SolarWing({
  side,
  deployment,
  trackingAngle,
  selected,
  onSelectBlanket,
  onSelectBoom,
  onSelectGimbal,
}: {
  side: -1 | 1;
  deployment: React.MutableRefObject<number>;
  trackingAngle: React.MutableRefObject<number>;
  selected: string | null;
  onSelectBlanket: () => void;
  onSelectBoom: () => void;
  onSelectGimbal: () => void;
}) {
  const gimbal = useRef<THREE.Group>(null);
  const wingRefs = useRef<Array<THREE.Group | null>>([null, null]);

  useFrame(() => {
    if (gimbal.current) gimbal.current.rotation.x = trackingAngle.current;

    const d = Math.max(0.04, deployment.current);
    const length = 3.0 + 3.8 * d;

    wingRefs.current.forEach((wing, index) => {
      if (!wing) return;
      wing.position.x = side * (0.7 + length / 2);
      wing.scale.x = d;
      wing.position.z = index === 0 ? 1.15 : -1.15;
    });
  });

  return (
    <group position={[side * 2.85, 0, 0]}>
      <mesh
        rotation={[0, 0, Math.PI / 2]}
        onClick={(event) => {
          event.stopPropagation();
          onSelectGimbal();
        }}
      >
        <cylinderGeometry args={[0.30, 0.30, 0.48, 32]} />
        <meshStandardMaterial
          color={selected === "gimbal" ? "#d89a3b" : "#bcc4cb"}
          metalness={0.92}
          roughness={0.2}
          emissive={selected === "gimbal" ? "#8d5115" : "#000000"}
          emissiveIntensity={selected === "gimbal" ? 0.55 : 0}
        />
      </mesh>

      <group ref={gimbal}>
        <mesh position={[side * 0.18, 0, 0]}>
          <boxGeometry args={[0.22, 0.24, 2.75]} />
          <meshStandardMaterial color="#8d969e" metalness={0.86} roughness={0.31} />
        </mesh>

        {[1.15, -1.15].map((z, index) => (
          <group
            key={z}
            ref={(node) => {
              wingRefs.current[index] = node;
            }}
          >
            <Panel
              position={[0, 0, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              selected={selected === "blanket"}
              onSelect={onSelectBlanket}
            />
            <mesh
              position={[0, -0.15, z > 0 ? 1.48 : -1.48]}
              onClick={(event) => {
                event.stopPropagation();
                onSelectBoom();
              }}
            >
              <boxGeometry args={[7.15, 0.075, 0.07]} />
              <meshStandardMaterial
                color={selected === "booms" ? "#d4aa57" : "#3a4046"}
                metalness={0.72}
                roughness={0.4}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
function Spacecraft({
  deployment,
  trackingAngle,
  selected,
  onSelect,
}: {
  deployment: React.MutableRefObject<number>;
  trackingAngle: React.MutableRefObject<number>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <group>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect("ppu");
        }}
      >
        <cylinderGeometry args={[0.84, 0.84, 2.05, 8]} />
        <meshStandardMaterial
          color={selected === "ppu" ? "#e0ad50" : "#c5a03b"}
          metalness={0.95}
          roughness={0.34}
          emissive={selected === "ppu" ? "#78520c" : "#000000"}
          emissiveIntensity={selected === "ppu" ? 0.5 : 0}
        />
      </mesh>

      <mesh position={[0, 1.04, 0]}>
        <cylinderGeometry args={[0.62, 0.74, 0.12, 8]} />
        <meshStandardMaterial color="#e4e7eb" metalness={0.78} roughness={0.32} />
      </mesh>

      <mesh
        position={[0, -0.32, -1.38]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect("radiator");
        }}
      >
        <boxGeometry args={[1.05, 0.055, 1.55]} />
        <meshStandardMaterial
          color={selected === "radiator" ? "#3d9fb9" : "#c4d7dd"}
          metalness={0.16}
          roughness={0.68}
          emissive={selected === "radiator" ? "#164b5c" : "#000000"}
          emissiveIntensity={selected === "radiator" ? 0.45 : 0}
        />
      </mesh>

      <mesh
        position={[-0.48, 0.36, -0.1]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect("battery");
        }}
      >
        <boxGeometry args={[0.82, 0.68, 0.66]} />
        <meshStandardMaterial
          color={selected === "battery" ? "#5fa36f" : "#31573e"}
          metalness={0.48}
          roughness={0.48}
          emissive={selected === "battery" ? "#245a31" : "#07160b"}
          emissiveIntensity={selected === "battery" ? 0.48 : 0.14}
        />
      </mesh>

      <mesh
        position={[1.04, 0.58, 0.26]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect("avionics");
        }}
      >
        <boxGeometry args={[0.5, 0.58, 0.72]} />
        <meshStandardMaterial
          color={selected === "avionics" ? "#9f81d0" : "#5c4773"}
          metalness={0.55}
          roughness={0.4}
          emissive={selected === "avionics" ? "#4b2c72" : "#120b1b"}
          emissiveIntensity={selected === "avionics" ? 0.44 : 0.14}
        />
      </mesh>

      <mesh
        position={[-1.08, 0.33, 0.5]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect("harness");
        }}
      >
        <boxGeometry args={[1.45, 0.055, 0.055]} />
        <meshStandardMaterial
          color={selected === "harness" ? "#ee7f52" : "#8d341f"}
          emissive={selected === "harness" ? "#6e2814" : "#180703"}
          emissiveIntensity={selected === "harness" ? 0.5 : 0.12}
        />
      </mesh>

      <SolarWing
        side={-1}
        deployment={deployment}
        trackingAngle={trackingAngle}
        selected={selected}
        onSelectBlanket={() => onSelect("blanket")}
        onSelectBoom={() => onSelect("booms")}
        onSelectGimbal={() => onSelect("gimbal")}
      />
      <SolarWing
        side={1}
        deployment={deployment}
        trackingAngle={trackingAngle}
        selected={selected}
        onSelectBlanket={() => onSelect("blanket")}
        onSelectBoom={() => onSelect("booms")}
        onSelectGimbal={() => onSelect("gimbal")}
      />
    </group>
  );
}

function shortAngle(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function isEclipsed(dir: THREE.Vector3) {
  const earthCenter = new THREE.Vector3(0, -38, 0);
  const radius = 28;
  const t = dir.dot(earthCenter);
  if (t <= 0) return false;
  return earthCenter.lengthSq() - t * t < radius * radius;
}

function SimulationModel({
  selected,
  onSelect,
  onTelemetry,
  deploymentTarget,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  onTelemetry: (value: { power: number; incidence: number; eclipse: boolean; deployment: number }) => void;
  deploymentTarget: number;
}) {
  const deployment = useRef(0.05);
  const sunAngle = useRef((28 * Math.PI) / 180);
  const wingAngle = useRef(0);
  const sunDirection = useRef(new THREE.Vector3(0, 1, 0));
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    sunAngle.current += dt * 0.18;

    const angle = sunAngle.current;
    sunDirection.current.set(0, Math.cos(angle), Math.sin(angle)).normalize();

    deployment.current +=
      (deploymentTarget - deployment.current) * Math.min(1, dt * 1.8);

    const eclipse = isEclipsed(sunDirection.current);
    const targetWing = eclipse ? wingAngle.current : angle;
    wingAngle.current += shortAngle(wingAngle.current, targetWing) * Math.min(1, dt * 2.6);

    elapsed.current += dt;
    if (elapsed.current > 0.1) {
      elapsed.current = 0;
      const incidenceCos = Math.max(
        0,
        Math.cos(shortAngle(wingAngle.current, angle)),
      );
      const power = eclipse
        ? 0
        : 80 * deployment.current * incidenceCos;
      const incidence =
        (Math.acos(
          Math.min(1, Math.max(-1, Math.cos(shortAngle(wingAngle.current, angle)))),
        ) *
          180) /
        Math.PI;
      onTelemetry({
        power,
        incidence,
        eclipse,
        deployment: deployment.current,
      });
    }
  });

  return (
    <>
      <Sun sunDirection={sunDirection} />
      <Spacecraft
        deployment={deployment}
        trackingAngle={wingAngle}
        selected={selected}
        onSelect={onSelect}
      />
    </>
  );
}

function SolarScene({
  selected,
  onSelect,
  onTelemetry,
  deploymentTarget,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  onTelemetry: (value: { power: number; incidence: number; eclipse: boolean; deployment: number }) => void;
  deploymentTarget: number;
}) {
  return (
    <Canvas
      camera={{ position: [10.5, 4.7, 13.8], fov: 47, near: 0.1, far: 500 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      aria-label="Interactive 3D simulation of a deployable spacecraft solar array"
    >
      <color attach="background" args={["#02050a"]} />
      <ambientLight intensity={0.16} />
      <hemisphereLight intensity={0.36} color="#bfd6ff" groundColor="#08131c" />
      <directionalLight position={[-8, 9, 7]} intensity={2.1} color="#ffffff" />
      <Stars radius={170} depth={70} count={6500} factor={3.2} saturation={0} fade speed={0.34} />

      <Earth />

      <gridHelper
        args={[34, 17, "#13242c", "#081117"]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, -2.8, 0]}
      />

      <group position={[0, 0, 0]}>
        <group scale={0.82}>
          <SimulationModel
            selected={selected}
            onSelect={onSelect}
            onTelemetry={onTelemetry}
            deploymentTarget={deploymentTarget}
          />
        </group>
      </group>

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={6.5}
        maxDistance={40}
        enablePan={false}
        rotateSpeed={0.68}
        zoomSpeed={0.9}
      />
    </Canvas>
  );
}

function InspectPanel({
  component,
  tier,
  onClose,
}: {
  component: SolarComponent;
  tier: Tier;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#010609]/94 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={component.name}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-[#526e68] bg-[#07151c] shadow-[0_30px_120px_rgba(0,0,0,.92)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-[#29434a] bg-[#0a2028] p-5 md:p-7">
          <p
            className="text-[9px] font-bold uppercase tracking-[.22em]"
            style={{ color: tierMeta[tier].color }}
          >
            Solar system inspection · {tier} tier
          </p>
          <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[.08em] text-[#eef3e7]">
            {component.name}
          </h2>
          <p className="mt-2 text-sm uppercase tracking-[.13em] text-[#72b9d4]">
            {component.short} · {component.function}
          </p>
        </div>

        <div className="grid gap-5 p-5 md:p-7 lg:grid-cols-[1.12fr_.88fr]">
          <section className="border border-[#3d5b50] bg-[#0c2028] p-5">
            <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#efb658]">
              Engineering principle
            </p>
            <h3 className="mt-2 text-lg font-semibold text-[#e6eee8]">
              {component.principle}
            </h3>
            <p className="mt-4 text-sm leading-7 text-[#b7c8c0]">
              {component.detail}
            </p>
          </section>

          <section className="border border-[#29434a] bg-[#0a1920] p-5">
            <p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#738b84]">
              Real-world basis
            </p>
            <p className="mt-3 text-sm leading-6 text-[#aabdb6]">
              {component.realBasis}
            </p>
            <div className="mt-5 border-l-2 border-[#efb658] bg-[#13252b] px-4 py-3">
              <p className="text-[8px] font-bold uppercase tracking-[.17em] text-[#efb658]">
                Reference
              </p>
              <a
                href={NASA_REFERENCE}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-[10px] font-semibold uppercase tracking-[.11em] text-[#cfe1d7] underline decoration-[#4d7166] underline-offset-4 hover:text-[#f2f5ea]"
              >
                NASA ROSA / iROSA mission reference
              </a>
            </div>
          </section>
        </div>

        <div className="border-t border-[#29434a] bg-[#061119] px-5 py-4 text-[9px] leading-5 uppercase tracking-[.11em] text-[#718b86]">
          Educational engineering model. The visualisation is an abstraction of real spacecraft technology, not a NASA-certified flight design.
        </div>
      </div>
    </div>
  );
}

export function Solar3DViewer({ tier }: { tier: Tier }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [deploymentTarget, setDeploymentTarget] = useState(1);
  const [telemetry, setTelemetry] = useState({
    power: 0,
    incidence: 0,
    eclipse: false,
    deployment: 0,
  });

  const selectedComponent = selected ? componentById[selected] : null;
  const accent = tierMeta[tier].color;
  const gameTier = SOLAR_TIERS[tier];

  return (
    <div className="relative overflow-hidden border border-[#2e4a50] bg-[#02060b]">
      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="absolute left-5 top-5 max-w-md md:left-7 md:top-7">
          <p
            className="text-[9px] font-bold uppercase tracking-[.22em]"
            style={{ color: accent }}
          >
            NASA-inspired integrated 3D simulation
          </p>
          <h2 className="mt-2 text-2xl font-semibold uppercase tracking-[.08em] text-[#edf2e9] md:text-3xl">
            {gameTier.name} · ROSA-class roll-out solar power system
          </h2>
          <p className="mt-2 max-w-xl text-[11px] leading-5 text-[#819b94] md:text-xs">
            Drag to orbit. Scroll to zoom. Use the deployment slider below. Click the 3D hardware to select a component. This is the Solar technology family used by the game; each tier changes the loadout specification and capability.
          </p>
        </div>

        <div className="absolute right-5 top-5 w-52 border border-[#3b5559] bg-[#061118]/80 p-4 backdrop-blur-md md:right-7 md:top-7">
          <p className="text-[8px] font-bold uppercase tracking-[.18em] text-[#708a83]">
            Live telemetry
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-mono text-3xl font-semibold tabular-nums text-[#efb658]">
              {telemetry.power.toFixed(1)}
            </span>
            <span className="pb-1 text-[10px] uppercase tracking-[.12em] text-[#8aa29b]">
              kW
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden bg-white/10">
            <div
              className="h-full bg-[#efb658] transition-[width] duration-150"
              style={{ width: `${Math.max(0, Math.min(100, (telemetry.power / 80) * 100))}%` }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-[8px] uppercase tracking-[.12em]">
            <div>
              <p className="text-[#708a83]">Deployment</p>
              <p className="mt-1 font-mono text-[#dde7df]">
                {Math.round(telemetry.deployment * 100)}%
              </p>
            </div>
            <div>
              <p className="text-[#708a83]">Incidence</p>
              <p className="mt-1 font-mono text-[#dde7df]">
                {telemetry.incidence.toFixed(0)}°
              </p>
            </div>
          </div>
          <p
            className={`mt-3 text-[8px] font-bold uppercase tracking-[.15em] ${
              telemetry.eclipse ? "text-[#79b8dd]" : "text-[#79c58d]"
            }`}
          >
            {telemetry.eclipse ? "ECLIPSE" : "SUNLIT"}
          </p>
        </div>


        <div className="absolute right-5 top-56 w-52 border border-[#30494f] bg-[#061118]/72 p-3 backdrop-blur-md md:right-7 md:top-60">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[8px] font-bold uppercase tracking-[.16em] text-[#708a83]">Game loadout</span>
            <span className="text-[9px] font-mono text-[#dde7df]">{gameTier.cost}M</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[8px] uppercase tracking-[.1em]">
            <div>
              <p className="text-[#708a83]">Mass</p>
              <p className="mt-1 font-mono text-[#dde7df]">{gameTier.mass.toLocaleString()} kg</p>
            </div>
            <div>
              <p className="text-[#708a83]">Tier</p>
              <p className="mt-1 text-[#dde7df]">{tier}</p>
            </div>
          </div>
          <p className="mt-2 text-[8px] leading-4 text-[#78918b]">{gameTier.efficiency}</p>
        </div>
        <div className="absolute bottom-24 left-5 border border-[#30494f] bg-[#061118]/75 px-3 py-2 text-[8px] uppercase tracking-[.14em] text-[#78918b] backdrop-blur-md md:left-7">
          {selectedComponent
            ? `Selected · ${selectedComponent.name}`
            : "Select a component in the 3D model"}
        </div>

        <div className="absolute bottom-4 left-5 right-5 text-[8px] uppercase tracking-[.14em] text-[#6f8983] md:left-7 md:right-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>ROSA / iROSA engineering abstraction · educational simulation</span>
            <span>Click hardware to inspect · drag to orbit · wheel to zoom</span>
          </div>
        </div>
      </div>

      <div className="h-[560px] w-full md:h-[620px]">
        <SolarScene
          selected={selected}
          onSelect={setSelected}
          onTelemetry={setTelemetry}
          deploymentTarget={deploymentTarget}
        />
      </div>

      <div className="border-t border-[#29434a] bg-[#07151c] px-5 py-4 md:px-7 md:py-5">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4 border border-[#30494f] bg-[#0a1920] px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="solar-deployment" className="text-[9px] font-bold uppercase tracking-[.18em] text-[#d4e2da]">
                Wing deployment
              </label>
              <span className="font-mono text-[10px] tabular-nums text-[#efb658]">
                {Math.round(deploymentTarget * 100)}%
              </span>
            </div>
            <input
              id="solar-deployment"
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(deploymentTarget * 100)}
              onChange={(event) => setDeploymentTarget(Number(event.target.value) / 100)}
              className="mt-3 h-1.5 w-full cursor-pointer accent-[#efb658]"
              aria-label="Solar wing deployment"
            />
            <div className="mt-2 flex justify-between text-[7px] uppercase tracking-[.14em] text-[#647d77]">
              <span>STOWED</span>
              <span>PARTIAL</span>
              <span>DEPLOYED</span>
            </div>
          </div>

          <button
            type="button"
            disabled={!selectedComponent}
            onClick={() => {
              if (selectedComponent) setInspectOpen(true);
            }}
            className="flex w-full items-center justify-center gap-2 border border-[#536d61] bg-[#11252a] px-5 py-3.5 text-[10px] font-bold uppercase tracking-[.18em] text-[#d4e2da] transition-colors hover:border-[#efb658] hover:bg-[#162e34] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ScanLine className="h-4 w-4 text-[#efb658]" />
            {selectedComponent
              ? `Inspect ${selectedComponent.name}`
              : "Select a component to inspect"}
          </button>
        </div>
      </div>
      {inspectOpen && selectedComponent && (
        <InspectPanel
          component={selectedComponent}
          tier={tier}
          onClose={() => setInspectOpen(false)}
        />
      )}
    </div>
  );
}

export default Solar3DViewer;
