import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CentralHub } from "./central-hub";
import { PanelWing } from "./panel-wing";
import {
  activeAreaForTerrain,
  calculatePowerKW,
  CELL_EFFICIENCY,
  dustRemainingFraction,
  INSTALLATION_LINEAR_SCALE,
  marsDirectTransmission,
  MARS_DEFAULT_OPTICAL_DEPTH,
  SOLAR_IRRADIANCE_W_M2,
  surfaceIrradianceForTerrain,
  solarLive,
  type SolarTier,
  type TerrainKind,
} from "./state";
import { makeCellEmissiveTexture, makeSolarCellTexture, makeDustTexture } from "./textures";


const CLEAN = new THREE.Color("#ffffff");
interface FarmProps {
  deployTarget: number;
  dust: number;
  sunElevation: number;
  terrain: TerrainKind;
  tier: SolarTier;
  onComponentSelect?: (name: string, role: string, explanation: string) => void;
  selectedComponentName?: string | null;
}

export function SolarFarm({
  deployTarget,
  dust,
  sunElevation,
  terrain,
  tier,
  onComponentSelect,
  selectedComponentName,
}: FarmProps) {
  const cellMap = useMemo(() => makeSolarCellTexture(), []);
  const cellEmissive = useMemo(() => makeCellEmissiveTexture(), []);
  const dustTexture = useMemo(() => makeDustTexture(terrain), [terrain]);

  const pvMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: cellMap,
        emissiveMap: cellEmissive,
        emissive: new THREE.Color("#2f6bff"),
        emissiveIntensity: 0.4,
        metalness: 0.55,
        roughness: 0.32,
        color: CLEAN.clone(),
      }),
    [cellMap, cellEmissive, dustTexture, terrain],
  );

  const dustMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: dustTexture,
        color: "#ffffff",
        roughness: 1,
        metalness: 0,
        alphaTest: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [dustTexture],
  );

  const frameMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#b9bcc3",
        metalness: 0.8,
        roughness: 0.4,
      }),
    [],
  );

  const boomMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#8d9098",
        metalness: 0.85,
        roughness: 0.45,
      }),
    [],
  );

  useFrame((_, delta) => {
    solarLive.deploy = THREE.MathUtils.damp(solarLive.deploy, deployTarget, 2.2, delta);
    solarLive.dust = THREE.MathUtils.damp(solarLive.dust, dust, 3, delta);

    const dustFrac = solarLive.dust / 100;
    dustMaterial.alphaTest = Math.max(
      0.08,
      0.9 - Math.pow(Math.max(0, dustFrac), 0.58) * 0.78,
    );
    dustMaterial.needsUpdate = true;
    const dustRemaining = dustRemainingFraction(terrain, solarLive.dust);
    const surfaceIrradiance = surfaceIrradianceForTerrain(terrain, sunElevation);
    const currentPower = calculatePowerKW({
      terrain,
      tier,
      deployment: solarLive.deploy,
      sunElevation,
      dust: solarLive.dust,
    });

    solarLive.powerKW = currentPower;

    const topOfAtmosphereIrradiance = SOLAR_IRRADIANCE_W_M2[terrain];
    const surfaceResourceFactor =
      topOfAtmosphereIrradiance > 0 ? surfaceIrradiance / topOfAtmosphereIrradiance : 0;

    solarLive.efficiency =
      CELL_EFFICIENCY[tier] *
      0.92 *
      surfaceResourceFactor *
      solarLive.deploy *
      dustRemaining;
    solarLive.dustRemainingFraction = dustRemaining;
    solarLive.dustLossPct = (1 - dustRemaining) * 100;

    solarLive.sunElevation = sunElevation;
    solarLive.irradiance = topOfAtmosphereIrradiance;
    solarLive.activeAreaM2 = activeAreaForTerrain(terrain);
    solarLive.atmosphericTau =
      terrain === "mars" ? MARS_DEFAULT_OPTICAL_DEPTH : 0;
    solarLive.atmosphericTransmission =
      terrain === "mars" ? marsDirectTransmission(sunElevation) : 1;
    solarLive.surfaceIrradiance = surfaceIrradiance;
    pvMaterial.color.copy(CLEAN);
    pvMaterial.roughness = 0.32;
    pvMaterial.metalness = 0.55;
    pvMaterial.emissiveIntensity =
      0.15 + (1 - dustFrac) * Math.max(0, Math.sin((sunElevation * Math.PI) / 180)) * solarLive.deploy * 0.7;
  });

  return (
    <group scale={INSTALLATION_LINEAR_SCALE[terrain]}>
      <CentralHub dust={dust} terrain={terrain} onSelect={onComponentSelect} selectedComponentName={selectedComponentName} />
      {Array.from({ length: 4 }, (_, i) => (
        <PanelWing
          key={i}
          angle={(i / 4) * Math.PI * 2}
          pvMaterial={pvMaterial}
          frameMaterial={frameMaterial}
          boomMaterial={boomMaterial}
          dustMaterial={dustMaterial}
          onSelect={onComponentSelect}
          selectedComponentName={selectedComponentName}
        />
      ))}
    </group>
  );
}