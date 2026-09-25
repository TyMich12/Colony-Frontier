import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CentralHub } from "./central-hub";
import { PanelWing } from "./panel-wing";
import {
  activeAreaForTerrain,
  calculatePowerKW,
  CELL_EFFICIENCY,
  dustEfficiency,
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
const DUST_COLOR: Record<TerrainKind, THREE.Color> = {
  moon: new THREE.Color("#b7b1a4"),
  mars: new THREE.Color("#c08a5c"),
};

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
    [cellMap, cellEmissive],
  );

  const dustMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: dustTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        roughness: 0.95,
        metalness: 0,
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

    const dustFactor = dustEfficiency(solarLive.dust);
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

    dustMaterial.opacity = Math.min(0.98, Math.max(0, solarLive.dust / 100) * 1.15);
    dustMaterial.needsUpdate = true;

    solarLive.efficiency =
      CELL_EFFICIENCY[tier] *
      0.92 *
      surfaceResourceFactor *
      solarLive.deploy *
      dustFactor;

    solarLive.sunElevation = sunElevation;
    solarLive.irradiance = topOfAtmosphereIrradiance;
    solarLive.activeAreaM2 = activeAreaForTerrain(terrain);
    solarLive.atmosphericTau =
      terrain === "mars" ? MARS_DEFAULT_OPTICAL_DEPTH : 0;
    solarLive.atmosphericTransmission =
      terrain === "mars" ? marsDirectTransmission(sunElevation) : 1;
    solarLive.surfaceIrradiance = surfaceIrradiance;

    const dustFrac = solarLive.dust / 100;
    pvMaterial.color.copy(CLEAN).lerp(DUST_COLOR[terrain], Math.min(1, dustFrac * 1.05));
    pvMaterial.roughness = 0.32 + dustFrac * 0.6;
    pvMaterial.metalness = 0.55 * (1 - dustFrac * 0.6);
    pvMaterial.emissiveIntensity =
      0.15 + (1 - dustFrac) * Math.max(0, Math.sin((sunElevation * Math.PI) / 180)) * solarLive.deploy * 0.7;
  });

  return (
    <group scale={INSTALLATION_LINEAR_SCALE[terrain]}>
      <CentralHub onSelect={onComponentSelect} selected={selectedComponentName === "Central power hub"} />
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