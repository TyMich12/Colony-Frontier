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
  solarLive,
  type SolarTier,
  type TerrainKind,
} from "./state";
import { makeCellEmissiveTexture, makeSolarCellTexture } from "./textures";

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
}

export function SolarFarm({
  deployTarget,
  dust,
  sunElevation,
  terrain,
  tier,
}: FarmProps) {
  const cellMap = useMemo(() => makeSolarCellTexture(), []);
  const cellEmissive = useMemo(() => makeCellEmissiveTexture(), []);

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
    const currentPower = calculatePowerKW({
      terrain,
      tier,
      deployment: solarLive.deploy,
      sunElevation,
      dust: solarLive.dust,
    });

    solarLive.powerKW = currentPower;
    solarLive.efficiency =
      (CELL_EFFICIENCY[tier] *
        INSTALLATION_LINEAR_SCALE[terrain] ** 2 *
        (terrain === "mars" ? 0.8 : 1) *
        solarLive.deploy *
        Math.max(0, Math.sin((sunElevation * Math.PI) / 180)) *
        dustFactor *
        0.92);

    solarLive.sunElevation = sunElevation;
    solarLive.irradiance =
      terrain === "moon" ? 1361 : 586.2;
    solarLive.activeAreaM2 = activeAreaForTerrain(terrain);

    const dustFrac = solarLive.dust / 100;
    pvMaterial.color.copy(CLEAN).lerp(DUST_COLOR[terrain], dustFrac * 0.85);
    pvMaterial.roughness = 0.32 + dustFrac * 0.6;
    pvMaterial.metalness = 0.55 * (1 - dustFrac * 0.6);
    pvMaterial.emissiveIntensity =
      0.15 + (1 - dustFrac) * Math.max(0, Math.sin((sunElevation * Math.PI) / 180)) * solarLive.deploy * 0.7;
  });

  return (
    <group scale={INSTALLATION_LINEAR_SCALE[terrain]}>
      <CentralHub />
      {Array.from({ length: 4 }, (_, i) => (
        <PanelWing
          key={i}
          angle={(i / 4) * Math.PI * 2}
          pvMaterial={pvMaterial}
          frameMaterial={frameMaterial}
          boomMaterial={boomMaterial}
        />
      ))}
    </group>
  );
}