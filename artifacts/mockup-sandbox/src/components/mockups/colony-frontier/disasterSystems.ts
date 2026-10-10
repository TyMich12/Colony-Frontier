import type { Tier } from "./_shared/gameData";
import { dustRemainingFraction } from "./solar-surface/state";

export const TIER_ORDER: Tier[] = ["Foundation", "Frontier", "Apex", "Research"];
type Triple = [number, number, number];
type Baseline = { label: string; unit: string; values: Record<Tier, Triple>; lowerIsBetter?: boolean };

export const SYSTEM_BASELINES: Record<string, Baseline> = {
  solar:{label:"Rated solar output at reference noon",unit:"kW",values:{Foundation:[8,9,10],Frontier:[12,13.5,15],Apex:[18,20,22],Research:[25,27,29]}},
  battery:{label:"Usable storage capacity",unit:"kWh",values:{Foundation:[40,44,48],Frontier:[60,66,72],Apex:[90,99,108],Research:[130,143,156]}},
  oxygen:{label:"Oxygen processing capacity",unit:"kg O₂/day",values:{Foundation:[3.6,3.8,4],Frontier:[4,4.2,4.4],Apex:[4.4,4.7,5],Research:[5.1,5.4,5.7]}},
  water:{label:"Water recovery",unit:"%",values:{Foundation:[60,64,68],Frontier:[70,74,78],Apex:[80,84,88],Research:[90,93,96]}},
  co2:{label:"CO₂ removal capacity",unit:"kg CO₂/day",values:{Foundation:[4,4.2,4.4],Frontier:[4.5,4.7,4.9],Apex:[5,5.2,5.4],Research:[5.5,5.7,5.9]}},
  thermal:{label:"Heat rejection capacity",unit:"kW thermal",values:{Foundation:[4,4.5,5],Frontier:[6,6.5,7],Apex:[9,9.5,10],Research:[12,12.5,13]}},
  comms:{label:"Data-link throughput",unit:"Mbit/s",values:{Foundation:[1,2,3],Frontier:[5,7,9],Apex:[20,25,30],Research:[100,115,130]}},
  habitat:{label:"Pressure-control deviation (lower is better)",unit:"kPa from target",lowerIsBetter:true,values:{Foundation:[2,1.8,1.6],Frontier:[1.5,1.3,1.1],Apex:[1,.85,.7],Research:[.5,.4,.3]}},
  radiation:{label:"Dose reduction in reference exposure",unit:"%",values:{Foundation:[20,24,28],Frontier:[30,34,38],Apex:[40,44,48],Research:[50,54,58]}},
  grid:{label:"Power distribution efficiency",unit:"%",values:{Foundation:[85,87,89],Frontier:[90,91,92],Apex:[94,95,96],Research:[97,98,99]}},
  science:{label:"Sample-analysis throughput",unit:"samples/day",values:{Foundation:[1,1.2,1.4],Frontier:[2,2.3,2.6],Apex:[3,3.4,3.8],Research:[4,4.5,5]}},
  navigation:{label:"Position uncertainty (lower is better)",unit:"m",lowerIsBetter:true,values:{Foundation:[50,40,30],Frontier:[20,16,12],Apex:[5,4,3],Research:[1,.75,.5]}},
  rover:{label:"Safe surface cruise speed",unit:"km/h",values:{Foundation:[3,3.5,4],Frontier:[5,5.7,6.4],Apex:[7,7.8,8.6],Research:[10,11,12]}},
  extraction:{label:"Core recovery rate",unit:"kg/h",values:{Foundation:[10,12,14],Frontier:[20,23,26],Apex:[35,39,43],Research:[55,60,65]}},
  isru:{label:"Oxygen-equivalent local product",unit:"kg/day",values:{Foundation:[2,2.5,3],Frontier:[4,4.8,5.6],Apex:[8,9,10],Research:[12,13,14]}},
  agriculture:{label:"Edible biomass output",unit:"kg/day",values:{Foundation:[.5,.7,.9],Frontier:[1,1.3,1.6],Apex:[1.8,2.1,2.4],Research:[2.5,2.9,3.3]}},
  maintenance:{label:"Repair throughput",unit:"condition points/action",values:{Foundation:[10,12,14],Frontier:[15,17,19],Apex:[20,22,24],Research:[25,28,31]}},
};
export function getSystemOutput(systemId:string,tier:Tier,retrofitLevel:number) {
  const data=SYSTEM_BASELINES[systemId];
  if(!data) return {label:"Nominal system throughput",value:"—",numeric:0,unit:""};
  const level=Math.max(0,Math.min(2,Math.floor(retrofitLevel)));
  const numeric=data.values[tier][level];
  return {label:data.label,numeric,unit:data.unit,value:String(Number(numeric.toFixed(2)))+" "+data.unit};
}

export type RetrofitConfig={powerCost:number;batteryCost:number;durationSeconds:number};
const RETROFITS:Record<string,{first:RetrofitConfig;second:RetrofitConfig}>={
  solar:{first:{powerCost:3,batteryCost:1,durationSeconds:20},second:{powerCost:4,batteryCost:2,durationSeconds:25}},
  battery:{first:{powerCost:3,batteryCost:2,durationSeconds:22},second:{powerCost:4,batteryCost:2,durationSeconds:28}},
  grid:{first:{powerCost:4,batteryCost:2,durationSeconds:22},second:{powerCost:4,batteryCost:3,durationSeconds:28}},
  habitat:{first:{powerCost:2,batteryCost:1,durationSeconds:24},second:{powerCost:3,batteryCost:1,durationSeconds:30}},
  water:{first:{powerCost:3,batteryCost:1,durationSeconds:18},second:{powerCost:3,batteryCost:2,durationSeconds:23}},
  oxygen:{first:{powerCost:3,batteryCost:1,durationSeconds:18},second:{powerCost:4,batteryCost:2,durationSeconds:24}},
  co2:{first:{powerCost:2,batteryCost:1,durationSeconds:17},second:{powerCost:3,batteryCost:1,durationSeconds:22}},
  thermal:{first:{powerCost:4,batteryCost:2,durationSeconds:22},second:{powerCost:5,batteryCost:2,durationSeconds:29}},
  comms:{first:{powerCost:2,batteryCost:1,durationSeconds:16},second:{powerCost:3,batteryCost:1,durationSeconds:21}},
  radiation:{first:{powerCost:2,batteryCost:1,durationSeconds:24},second:{powerCost:3,batteryCost:1,durationSeconds:30}},
  science:{first:{powerCost:3,batteryCost:1,durationSeconds:20},second:{powerCost:4,batteryCost:2,durationSeconds:26}},
  navigation:{first:{powerCost:2,batteryCost:1,durationSeconds:17},second:{powerCost:3,batteryCost:1,durationSeconds:22}},
  rover:{first:{powerCost:3,batteryCost:2,durationSeconds:22},second:{powerCost:4,batteryCost:2,durationSeconds:29}},
  extraction:{first:{powerCost:4,batteryCost:2,durationSeconds:25},second:{powerCost:5,batteryCost:3,durationSeconds:32}},
  isru:{first:{powerCost:4,batteryCost:2,durationSeconds:25},second:{powerCost:5,batteryCost:3,durationSeconds:32}},
  agriculture:{first:{powerCost:3,batteryCost:1,durationSeconds:21},second:{powerCost:4,batteryCost:2,durationSeconds:27}},
  maintenance:{first:{powerCost:3,batteryCost:1,durationSeconds:21},second:{powerCost:4,batteryCost:2,durationSeconds:27}},
};
export function getRetrofitConfig(systemId:string,targetLevel:number):RetrofitConfig {
  const row=RETROFITS[systemId]??RETROFITS.maintenance;
  return targetLevel<=1?row.first:row.second;
}

export type RepairChannel="condition"|"dust"|"alignment"|"stringLoss"|"power"|"battery"|"oxygen"|"water"|"food"|"habitat"|"radiation"|"temperature"|"score"|"yield"|"otherCondition";
export type RepairEffects=Record<RepairChannel,number>;
type EffectDefinition={channel:RepairChannel;values:[number,number,number,number];step?:number;explanation:(amount:number)=>string};
type HelperDefinition={name:string;description:string;effect:EffectDefinition};
type SystemRepairDefinition={standaloneName:string;standaloneDescription:string;integratedName:string;standalone:EffectDefinition[];helpers:Record<string,HelperDefinition>};
const effect=(channel:RepairChannel,values:[number,number,number,number],explanation:(amount:number)=>string,step=0):EffectDefinition=>({channel,values,explanation,step});
const conditionEffect=(values:[number,number,number,number],step=1)=>effect("condition",values,n=>"Equipment condition +"+n+" points",step);

export const REPAIR_SUPPORT_PROFILES:Record<string,[string,string,string]>={
  solar:["navigation","maintenance","science"],battery:["solar","thermal","grid"],grid:["solar","battery","science"],
  habitat:["maintenance","thermal","radiation"],water:["thermal","science","isru"],oxygen:["water","grid","science"],
  co2:["oxygen","science","grid"],thermal:["grid","maintenance","habitat"],comms:["navigation","grid","science"],
  radiation:["habitat","extraction","science"],rover:["navigation","grid","maintenance"],extraction:["rover","navigation","grid"],
  isru:["extraction","grid","science"],agriculture:["water","thermal","science"],maintenance:["science","rover","extraction"],
  science:["comms","navigation","maintenance"],navigation:["comms","science","grid"],
};

const D:Record<string,SystemRepairDefinition>={
 solar:{standaloneName:"Manual panel-string inspection",standaloneDescription:"Brush a small accessible panel section; generation improves only because the dust loss is reduced.",integratedName:"Helios Coordinated Recovery",standalone:[effect("dust",[4,5,7,9],n=>"Solar dust index −"+n+" points",1),conditionEffect([1,2,2,3])],helpers:{
  navigation:{name:"Sun-vector recalibration",description:"Corrects array pointing error so the panel plane faces the Sun more directly.",effect:effect("alignment",[2,3,5,7],n=>"Pointing error −"+n+"°",1)},
  maintenance:{name:"Electrostatic dust mitigation",description:"Uses dry-contact or electrostatic cleaning tools to remove adhered lunar regolith.",effect:effect("dust",[7,11,16,23],n=>"Solar dust index −"+n+" points",2)},
  science:{name:"Cell-string diagnostics",description:"Finds a weak or isolated electrical string and restores only that measured loss.",effect:effect("stringLoss",[1,2,3,5],n=>"Cell-string loss −"+n+" percentage points",1)}
 }},
 battery:{standaloneName:"Isolate weak module and rebalance cells",standaloneDescription:"Disconnects a weak module and balances safe cells; it does not create energy.",integratedName:"Cell-Bank Coordinated Recovery",standalone:[conditionEffect([3,4,5,6]),effect("battery",[1,1.5,2,2.5],n=>"Usable reserve +"+n+" reserve points",.5)],helpers:{
  solar:{name:"Solar-fed charge recovery",description:"Uses measured available solar surplus to restore a controlled amount of charge.",effect:effect("battery",[2,3,4,5],n=>"Usable reserve +"+n+" reserve points",1)},
  thermal:{name:"Cell-temperature conditioning",description:"Returns cells toward their preferred temperature band and limits further capacity loss.",effect:conditionEffect([2,3,4,5])},
  grid:{name:"Charge-path rebalancing",description:"Redistributes current between healthy strings without exceeding safe limits.",effect:effect("battery",[2,3,4,6],n=>"Usable reserve +"+n+" reserve points",1)}
 }},
 grid:{standaloneName:"Manual breaker isolation and bus test",standaloneDescription:"Separates a suspect branch and restores only safe load that was unnecessarily isolated.",integratedName:"Smart-Bus Coordinated Recovery",standalone:[conditionEffect([3,4,5,6]),effect("power",[1,1.5,2,2.5],n=>"Available power margin +"+n+" reserve points",.5)],helpers:{
  solar:{name:"Generation-source stabilisation",description:"Schedules the bus from measured solar availability instead of assuming constant input.",effect:effect("power",[1,2,3,4],n=>"Available power margin +"+n+" reserve points",.5)},
  battery:{name:"Stored-energy black start",description:"Uses a safe battery-backed start sequence to bring the distribution bus online.",effect:effect("battery",[1,2,3,4],n=>"Battery reserve +"+n+" reserve points",.5)},
  science:{name:"Bus impedance and load scan",description:"Measures branch losses and identifies the overloading load before it is re-energised.",effect:effect("score",[1,2,3,4],n=>"Diagnostic score +"+n+" points",1)}
 }},
 habitat:{standaloneName:"Locate leak and apply emergency patch",standaloneDescription:"Applies a limited mechanical patch and checks pressure decay; this is not a full structural rebuild.",integratedName:"Habitat Integrity Recovery",standalone:[conditionEffect([4,5,6,7]),effect("habitat",[1,2,2.5,3],n=>"Habitat integrity +"+n+" points",.5)],helpers:{
  maintenance:{name:"Composite leak patch",description:"Fits a structural patch at the leak and pressure-tests the seal.",effect:conditionEffect([3,4,5,6])},
  thermal:{name:"Thermally controlled cure",description:"Controls patch temperature during curing to reduce shrinkage and improve the seal.",effect:effect("habitat",[1,2,3,4],n=>"Habitat integrity +"+n+" points",.5)},
  radiation:{name:"Shielding and pressure-boundary survey",description:"Maps damaged shielding adjacent to the leak so vulnerable panels can be isolated.",effect:effect("radiation",[1,1.5,2,3],n=>"Radiation exposure index −"+n+" points",.5)}
 }},
 water:{standaloneName:"Isolate filter loop and clear blockage",standaloneDescription:"Restores limited flow using a manual bypass and basic contamination check.",integratedName:"Water-Recovery Loop Restoration",standalone:[conditionEffect([3,4,5,6]),effect("water",[1,1.5,2,2.5],n=>"Usable water reserve +"+n+" reserve points",.5)],helpers:{
  thermal:{name:"Waste-heat distillate recovery",description:"Uses available waste heat to recover condensate while monitoring thermal load.",effect:effect("water",[2,3,4,5],n=>"Usable water reserve +"+n+" reserve points",1)},
  science:{name:"Purity assay and recovery calibration",description:"Checks conductivity and contaminants to avoid returning unsafe water.",effect:effect("water",[1,2,3,4],n=>"Verified water reserve +"+n+" reserve points",1)},
  isru:{name:"Local volatile-feed recovery",description:"Adds verified local volatile feed only if suitable feedstock has already been collected.",effect:effect("water",[1,2,3,4],n=>"Water reserve supported by local feed +"+n+" reserve points",1)}
 }},
 oxygen:{standaloneName:"Switch to emergency oxygen buffer",standaloneDescription:"Releases a finite amount of stored oxygen while the normal regeneration loop restarts.",integratedName:"Oxygen-Loop Regeneration",standalone:[conditionEffect([2,3,4,5]),effect("oxygen",[1,1.5,2,2.5],n=>"Oxygen reserve +"+n+" reserve points",.5)],helpers:{
  water:{name:"Feed-water conditioning",description:"Checks recovered-water quality before the oxygen loop resumes and rejects unsafe feed.",effect:effect("oxygen",[1,2,3,4],n=>"Oxygen reserve protected / restored +"+n+" points",1)},
  grid:{name:"Stable electrolysis power",description:"Restores stable electrical supply to electrolysis and gas-handling controllers.",effect:effect("power",[1,1.5,2,3],n=>"Available power margin +"+n+" reserve points",.5)},
  science:{name:"Oxygen sensor and catalyst calibration",description:"Calibrates oxygen purity and sensor readings before the loop is declared stable.",effect:conditionEffect([2,3,4,5])}
 }},
 co2:{standaloneName:"Replace or regenerate passive sorbent",standaloneDescription:"Restores limited CO₂ capture with a manual cartridge; adsorption capacity remains finite.",integratedName:"CO₂ Scrubber Recovery",standalone:[conditionEffect([3,4,5,6]),effect("oxygen",[.5,1,1.5,2],n=>"Cabin-air safety reserve +"+n+" points",.5)],helpers:{
  oxygen:{name:"Air-loop pressure rebalance",description:"Balances airflow between oxygen delivery and CO₂ capture to restore usable circulation.",effect:effect("oxygen",[1,1.5,2,2.5],n=>"Life-support reserve +"+n+" points",.5)},
  science:{name:"Sorbent breakthrough diagnostics",description:"Measures sorbent saturation and replaces only the exhausted section.",effect:conditionEffect([2,3,4,5])},
  grid:{name:"Powered sorbent regeneration",description:"Restores the electrical / thermal regeneration cycle for reusable sorbent beds.",effect:effect("power",[1,2,3,4],n=>"Available power margin +"+n+" reserve points",.5)}
 }},
 thermal:{standaloneName:"Close passive insulation shutters",standaloneDescription:"Reduces radiative exchange passively; it cannot actively heat or cool the habitat.",integratedName:"Thermal-Balance Recovery",standalone:[conditionEffect([2,3,4,5]),effect("temperature",[.4,.6,.8,1],n=>"Habitat temperature moves "+n+"°C toward 21°C",.1)],helpers:{
  grid:{name:"Adaptive thermal-load scheduling",description:"Staggers heater and radiator loads so thermal control is less likely to brown out.",effect:effect("power",[1,1.5,2,3],n=>"Available power margin +"+n+" reserve points",.5)},
  maintenance:{name:"Heat-exchanger service",description:"Clears a restricted exchanger and checks pump and radiator flow.",effect:conditionEffect([3,4,5,6])},
  habitat:{name:"Passive insulation isolation",description:"Isolates a damaged thermal bridge so habitat temperature drift slows.",effect:effect("temperature",[.5,.8,1.1,1.4],n=>"Additional thermal correction "+n+"°C toward target",.1)}
 }},
 comms:{standaloneName:"Reset local low-rate beacon",standaloneDescription:"Restores emergency local telemetry; high-rate relay communications are not guaranteed.",integratedName:"Communications-Link Recovery",standalone:[conditionEffect([3,4,5,6])],helpers:{
  navigation:{name:"Line-of-sight antenna pointing",description:"Corrects pointing error and restores the best available relay geometry.",effect:effect("score",[1,2,3,4],n=>"Verified link confidence +"+n+" points",1)},
  grid:{name:"Transceiver power-rail repair",description:"Stabilises the transceiver voltage rail and removes a brownout source.",effect:effect("power",[1,1.5,2,3],n=>"Available power margin +"+n+" reserve points",.5)},
  science:{name:"Signal-quality diagnostic sweep",description:"Uses signal-to-noise samples to isolate antenna, cable or interference faults.",effect:effect("score",[1,2,3,4],n=>"Signal diagnostic score +"+n+" points",1)}
 }},
 radiation:{standaloneName:"Move crew behind existing passive shielding",standaloneDescription:"Reduces future exposure; dose already received is not erased.",integratedName:"Radiation-Protection Recovery",standalone:[conditionEffect([2,3,4,5]),effect("radiation",[1,1.5,2,2.5],n=>"Radiation exposure index −"+n+" points",.5)],helpers:{
  habitat:{name:"Shelter-seal coordination",description:"Closes shelter penetrations and moves crew into the best protected habitat volume.",effect:effect("radiation",[1,2,3,4],n=>"Radiation exposure index −"+n+" points",.5)},
  extraction:{name:"Regolith berm placement",description:"Uses available excavated regolith to add shielding mass over the exposed side.",effect:effect("radiation",[2,3,4,5],n=>"Radiation exposure index −"+n+" points",.5)},
  science:{name:"Dose survey and gap mapping",description:"Maps local dose-rate variation and identifies poorly shielded sectors.",effect:effect("radiation",[1,2,3,4],n=>"Radiation exposure index −"+n+" points",.5)}
 }},
 rover:{standaloneName:"Release wheel latch and clear drive fault",standaloneDescription:"Restores limited mobility after a local wheel / encoder check; it does not map a new route.",integratedName:"Surface-Rover Recovery",standalone:[conditionEffect([3,4,5,6])],helpers:{
  navigation:{name:"Wheel-odometry recalibration",description:"Reconciles wheel encoders with inertial motion estimates to limit position drift.",effect:effect("score",[1,2,3,4],n=>"Navigation confidence +"+n+" points",1)},
  grid:{name:"Drive-bus and charge-path check",description:"Restores a stable electrical path to traction motors and protects against a drive short.",effect:effect("battery",[1,1.5,2,3],n=>"Battery reserve +"+n+" points",.5)},
  maintenance:{name:"Wheel and suspension service",description:"Removes a mechanical obstruction and verifies wheel / suspension movement.",effect:conditionEffect([3,4,5,6])}
 }},
 extraction:{standaloneName:"Unload drill torque latch",standaloneDescription:"Safely releases a jammed drill actuator; this recovery does not extract resources.",integratedName:"Core-Drill Recovery",standalone:[conditionEffect([2,3,4,5])],helpers:{
  rover:{name:"Reposition over surveyed deposit",description:"Moves and stabilises the rover at a verified sample point before drilling resumes.",effect:effect("yield",[1,2,3,4],n=>"Verified feedstock opportunity +"+n+" units",1)},
  navigation:{name:"Drill-axis correction",description:"Corrects drill attitude against the surveyed surface normal to avoid a misaligned bore.",effect:effect("score",[1,2,3,4],n=>"Drill alignment confidence +"+n+" points",1)},
  grid:{name:"Torque-current control",description:"Restores controlled motor current to reduce stalling and core damage.",effect:effect("power",[1,1.5,2,3],n=>"Available power margin +"+n+" reserve points",.5)}
 }},
 isru:{standaloneName:"Isolate and purge process line",standaloneDescription:"Closes local valves and purges a contaminated line; no feedstock is created.",integratedName:"Local-Resource Processing Recovery",standalone:[conditionEffect([3,4,5,6])],helpers:{
  extraction:{name:"Verified feedstock-line recovery",description:"Restores transfer from already collected and verified local feedstock.",effect:effect("yield",[1,2,3,4],n=>"Usable feedstock +"+n+" units",1)},
  grid:{name:"Heater and pump supply restoration",description:"Restores stable electrical power to process heaters and pumps.",effect:effect("power",[1,1.5,2,3],n=>"Available power margin +"+n+" reserve points",.5)},
  science:{name:"Process assay retuning",description:"Uses verified composition data to set appropriate separation parameters.",effect:effect("yield",[1,2,3,4],n=>"Process yield +"+n+" units",1)}
 }},
 agriculture:{standaloneName:"Recover already-mature edible biomass",standaloneDescription:"Collects ready food; it does not accelerate immature crop growth.",integratedName:"Controlled-Crop Recovery",standalone:[conditionEffect([2,3,4,5]),effect("food",[1,1.5,2,2.5],n=>"Food reserve +"+n+" reserve points",.5)],helpers:{
  water:{name:"Irrigation-loop recovery",description:"Restores controlled water delivery and reduces loss from a damaged irrigation path.",effect:effect("water",[1,2,3,4],n=>"Usable water reserve +"+n+" points",1)},
  thermal:{name:"Root-zone temperature correction",description:"Returns the growth chamber toward the configured crop-temperature band.",effect:effect("temperature",[.4,.6,.8,1],n=>"Thermal correction "+n+"°C",.1)},
  science:{name:"Crop-health and light diagnosis",description:"Identifies stressed plants and adjusts the crop plan from observed light and nutrient conditions.",effect:effect("food",[1,2,3,4],n=>"Recoverable food reserve +"+n+" points",1)}
 }},
 maintenance:{standaloneName:"Manual walk-around service",standaloneDescription:"Inspects and makes a minor adjustment on the weakest deployed healthy module.",integratedName:"Colony-Wide Preventive Service",standalone:[conditionEffect([3,4,5,6]),effect("otherCondition",[1,1.5,2,3],n=>"Weakest other system condition +"+n+" points",.5)],helpers:{
  science:{name:"Condition-based fault diagnostics",description:"Uses sensor trends to identify which component needs service first.",effect:effect("score",[1,2,3,4],n=>"Maintenance diagnostic score +"+n+" points",1)},
  rover:{name:"Tool and spare delivery",description:"Moves tools and spares to the affected module without an additional crew trip.",effect:effect("otherCondition",[2,3,4,5],n=>"Weakest other system condition +"+n+" points",1)},
  extraction:{name:"Local spare-stock recovery",description:"Provides in-situ replacement stock when suitable recovered material is available.",effect:effect("otherCondition",[1,2,3,4],n=>"Weakest other system condition +"+n+" points",1)}
 }},
 science:{standaloneName:"Re-zero onboard reference standard",standaloneDescription:"Restores the instrument baseline; no physical sample is analysed or consumed.",integratedName:"Science-Instrument Recovery",standalone:[conditionEffect([3,4,5,6]),effect("score",[1,1.5,2,3],n=>"Verified research score +"+n+" points",.5)],helpers:{
  comms:{name:"Reference-data synchronisation",description:"Reconciles reference data with the latest valid ground / relay calibration packet.",effect:effect("score",[1,2,3,4],n=>"Reference confidence +"+n+" points",1)},
  navigation:{name:"Coordinate and time-reference correction",description:"Re-tags observations to surveyed coordinates and mission time.",effect:effect("yield",[1,2,3,4],n=>"Usable mapped research value +"+n+" units",1)},
  maintenance:{name:"Optical bench calibration",description:"Cleans and aligns the instrument bench and verifies repeatability.",effect:conditionEffect([2,3,4,5])}
 }},
 navigation:{standaloneName:"Re-zero inertial navigation reference",standaloneDescription:"Resets drift estimates from the last known position; uncertainty grows again without external fixes.",integratedName:"Navigation-Solution Recovery",standalone:[conditionEffect([2,3,4,5]),effect("score",[1,1.5,2,3],n=>"Position-solution confidence +"+n+" points",.5)],helpers:{
  comms:{name:"Relay ranging fix",description:"Uses an available relay / beacon measurement to constrain accumulated dead-reckoning drift.",effect:effect("score",[2,3,4,5],n=>"Position-solution confidence +"+n+" points",1)},
  science:{name:"Landmark and terrain-map registration",description:"Uses surveyed landmarks to correct map-to-position registration.",effect:effect("yield",[1,2,3,4],n=>"Mapped navigation reference +"+n+" units",1)},
  grid:{name:"Inertial-sensor power stabilisation",description:"Restores clean power to the inertial unit and timing controller.",effect:effect("power",[1,1.5,2,3],n=>"Available power margin +"+n+" reserve points",.5)}
 }},
};

const CATEGORY_BY_COUNT=["Standalone Options","Enhanced Options","Dual-System Options","Fully Integrated"] as const;
const DURATIONS:Record<Tier,[number,number,number,number]>={Foundation:[30,34,42,52],Frontier:[27,31,38,46],Apex:[24,28,34,40],Research:[20,23,28,34]};
const SYSTEM_REPAIR_COST_ADJUSTMENTS:Record<string,{power:[number,number,number,number];battery:[number,number,number,number]}>={
 solar:{power:[0,0,0,0],battery:[0,0,0,0]},
 battery:{power:[0,0,1,1],battery:[0,1,1,1]},
 grid:{power:[0,1,1,1],battery:[0,0,1,1]},
 habitat:{power:[0,0,1,2],battery:[0,1,1,1]},
 water:{power:[0,0,1,1],battery:[0,0,1,1]},
 oxygen:{power:[0,0,1,1],battery:[0,0,1,1]},
 co2:{power:[0,0,1,1],battery:[0,0,1,1]},
 thermal:{power:[0,1,1,1],battery:[0,1,1,1]},
 comms:{power:[0,0,0,1],battery:[0,0,0,1]},
 radiation:{power:[0,0,1,1],battery:[0,0,1,1]},
 rover:{power:[0,0,1,1],battery:[0,1,1,1]},
 extraction:{power:[0,1,1,2],battery:[0,1,1,2]},
 isru:{power:[0,1,1,2],battery:[0,1,1,2]},
 agriculture:{power:[0,0,1,1],battery:[0,0,1,1]},
 maintenance:{power:[0,0,0,1],battery:[0,0,0,1]},
 science:{power:[0,0,1,1],battery:[0,0,1,1]},
 navigation:{power:[0,0,0,1],battery:[0,0,0,1]},
};
const SYSTEM_REPAIR_TIME_ADDITIONS:Record<string,[number,number,number,number]>={
 solar:[0,0,1,2],battery:[2,2,3,4],grid:[1,1,2,3],habitat:[3,3,4,6],
 water:[1,1,2,3],oxygen:[1,1,2,3],co2:[1,1,2,3],thermal:[2,2,3,4],
 comms:[0,0,1,2],radiation:[3,3,4,6],rover:[2,2,3,4],extraction:[4,4,5,7],
 isru:[4,4,5,7],agriculture:[2,2,3,4],maintenance:[2,2,3,4],science:[2,2,3,4],navigation:[1,1,2,3],
};
const COSTS:Record<Tier,Array<{powerCost:number;batteryCost:number}>>={
 Foundation:[{powerCost:2,batteryCost:1},{powerCost:3,batteryCost:1},{powerCost:4,batteryCost:2},{powerCost:5,batteryCost:3}],
 Frontier:[{powerCost:2,batteryCost:1},{powerCost:3,batteryCost:1},{powerCost:4,batteryCost:2},{powerCost:5,batteryCost:2}],
 Apex:[{powerCost:2,batteryCost:1},{powerCost:3,batteryCost:1},{powerCost:4,batteryCost:1},{powerCost:5,batteryCost:2}],
 Research:[{powerCost:1,batteryCost:1},{powerCost:2,batteryCost:1},{powerCost:3,batteryCost:1},{powerCost:4,batteryCost:2}],
};
export type RepairOption={id:string;mask:number;category:typeof CATEGORY_BY_COUNT[number];name:string;description:string;helpers:string[];durationSeconds:number;powerCost:number;batteryCost:number;effects:RepairEffects;effectSummary:string[]};
function amountFor(def:EffectDefinition,tier:Tier,level:number) { const index=TIER_ORDER.indexOf(tier); return Math.max(0,Number((def.values[index]+(def.step??0)*Math.max(0,Math.min(2,level))).toFixed(2))); }
function addDef(effects:RepairEffects,def:EffectDefinition,tier:Tier,level:number,summaries:string[]) {
 const amount=amountFor(def,tier,level); effects[def.channel]=Number((effects[def.channel]+amount).toFixed(2)); if(amount>0) summaries.push(def.explanation(amount));
}
export function getRepairOption(systemId:string,tier:Tier,retrofitLevel:number,mask:number,severity=1):RepairOption {
 const profile=REPAIR_SUPPORT_PROFILES[systemId]??["maintenance","navigation","grid"];
 const definition=D[systemId]??D.maintenance;
 const helpers=profile.filter((_,bit)=>(mask&(1<<bit))!==0);
 const count=helpers.length;
 const effects:RepairEffects={condition:0,dust:0,alignment:0,stringLoss:0,power:0,battery:0,oxygen:0,water:0,food:0,habitat:0,radiation:0,temperature:0,score:0,yield:0,otherCondition:0};
 const effectSummary:string[]=[];
 definition.standalone.forEach(def=>addDef(effects,def,tier,retrofitLevel,effectSummary));
 const helperDefs=helpers.map(id=>definition.helpers[id]).filter(Boolean);
 helperDefs.forEach(helper=>addDef(effects,helper.effect,tier,retrofitLevel,effectSummary));
 const labels=helperDefs.map(helper=>helper.name);
 const name=count===0?definition.standaloneName:count===3?definition.integratedName:labels.join(" + ");
 const description=count===0?definition.standaloneDescription:helperDefs.map(helper=>helper.description).join(" ");
 const durationSeconds=Math.max(12,Math.round(DURATIONS[tier][count]+(SYSTEM_REPAIR_TIME_ADDITIONS[systemId]??[0,0,0,0])[count]+Math.max(0,severity-1)*5-retrofitLevel*2));
 const baseCosts=COSTS[tier][count];
 const adjustment=SYSTEM_REPAIR_COST_ADJUSTMENTS[systemId]??{power:[0,0,0,0] as [number,number,number,number],battery:[0,0,0,0] as [number,number,number,number]};
 const costs={powerCost:baseCosts.powerCost+adjustment.power[count],batteryCost:baseCosts.batteryCost+adjustment.battery[count]};
 return {id:"repair-variant:"+systemId+":"+mask,mask,category:CATEGORY_BY_COUNT[count],name,description,helpers,durationSeconds,powerCost:costs.powerCost,batteryCost:costs.batteryCost,effects,effectSummary};
}
export function getRepairOptionForAction(systemId:string,tier:Tier,retrofitLevel:number,actionId:string,severity=1):RepairOption|null {
 const match=/^repair-variant:([^:]+):([0-7])$/.exec(actionId);
 if(!match||match[1]!==systemId)return null;
 return getRepairOption(systemId,tier,retrofitLevel,Number(match[2]),severity);
}

export function getSolarEnvironment(elapsedSeconds:number,totalMissionSeconds:number,isLevelOneArrival:boolean) {
 const phase=Math.max(0,Math.min(1,elapsedSeconds/Math.max(1,totalMissionSeconds)));
 const sunlightFraction=isLevelOneArrival?Math.max(0,Math.sin(Math.PI*phase)):.96;
 const sunElevationDegrees=isLevelOneArrival?Math.max(0,90*Math.sin(Math.PI*phase)):73.7;
 const irradianceWm2=1361*sunlightFraction;
 const regolithTemperatureC=-173+300*sunlightFraction;
 const panelTemperatureC=isLevelOneArrival?-10+60*sunlightFraction:35;
 const panelTemperatureFactor=Math.max(.75,Math.min(1.12,1-.004*(panelTemperatureC-25)));
 return {phase,sunlightFraction,sunElevationDegrees,irradianceWm2,regolithTemperatureC,panelTemperatureC,panelTemperatureFactor};
}
export function getSolarActualOutputKW(args:{tier:Tier;retrofitLevel:number;elapsedSeconds:number;totalMissionSeconds:number;isLevelOneArrival:boolean;condition:number;dust:number;alignmentErrorDegrees?:number;solarStringLossPct?:number}) {
 const env=getSolarEnvironment(args.elapsedSeconds,args.totalMissionSeconds,args.isLevelOneArrival);
 const rating=getSystemOutput("solar",args.tier,args.retrofitLevel).numeric;
 const dustTransmission=dustRemainingFraction(args.isLevelOneArrival ? "moon" : "mars",args.dust);
 const pointing=Math.max(0,Math.cos(Math.max(0,Math.min(89,args.alignmentErrorDegrees??0))*Math.PI/180));
 const stringFraction=Math.max(0,1-Math.max(0,Math.min(100,args.solarStringLossPct??0))/100);
 const actualKW=rating*env.sunlightFraction*env.panelTemperatureFactor*Math.max(0,Math.min(1,args.condition/100))*dustTransmission*pointing*stringFraction;
 return {...env,ratedKW:rating,actualKW,energyKWhPer10SimulatedSeconds:actualKW*10/3600,dustTransmission,pointingFraction:pointing,stringFraction};
}
