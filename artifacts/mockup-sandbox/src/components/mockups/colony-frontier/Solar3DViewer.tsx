import { SolarSurfaceSimulation } from "./SolarSurfaceSimulation";
import type { Tier } from "./_shared/gameData";

export function Solar3DViewer({ tier }: { tier: Tier }) {
  return <SolarSurfaceSimulation tier={tier} />;
}

export default Solar3DViewer;
