const initialState = () => ({
  elapsed_seconds: 0, oxygen_kg: 8, oxygen_rate_kg_s: 0.001,
  energy_j: 500000, generation_w: 1200, load_w: 900,
  cabin_gas_mass_kg: 36, molar_mass_kg_mol: 0.029, cabin_volume_m3: 30,
  temperature_k: 293.15, heater_w: 0, cooling_w: 0, thermal_capacity_j_k: 120000,
  radiation_gy: 0, radiation_rate_gy_s: 0.00000001,
  vehicle_mass_kg: 12000, thrust_n: 150000, drag_n: 10000,
  vertical_speed_m_s: 1, landing_stopping_distance_m: 1,
  restraints_intact: true, flight_control_ok: true
});
let state = initialState();
let phaseIndex = 0;
let latestVerdict = null;
const phases = ["liftoff", "ascent", "descent", "landing"];
const $ = (id) => document.getElementById(id);
const fmt = (value, digits = 2) => Number(value).toLocaleString(undefined, {minimumFractionDigits: digits, maximumFractionDigits: digits});
const setBar = (id, percentage, color) => {
  const bar = $(id);
  bar.style.width = Math.max(0, Math.min(100, percentage)) + "%";
  if (color) bar.style.background = color;
};
function logMessages(verdict, calculated) {
  const list = $("decision-log");
  list.replaceChildren();
  const entries = [
    ...(verdict.reasons || []).map((text) => ({text, cls:"bad"})),
    ...(verdict.warnings || []).map((text) => ({text, cls:"warn"}))
  ];
  if (!entries.length) entries.push({text: verdict.mission_status === "SUCCESS" ? "Touchdown accepted by Rust. Mission successful." : "Rust confirms astronaut alive. No blocking faults.", cls:"good"});
  entries.push({text:"Python calculated telemetry at T+" + Math.round(calculated.elapsed_seconds) + " s.", cls:""});
  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = entry.cls;
    li.textContent = entry.text;
    list.append(li);
  }
}
function render(calculated, verdict) {
  latestVerdict = verdict;
  $("oxygen").innerHTML = fmt(calculated.oxygen_kg) + ' <small>kg</small>';
  $("energy").innerHTML = fmt(calculated.energy_j / 1000, 1) + ' <small>kJ</small>';
  $("pressure").innerHTML = fmt(calculated.pressure_pa / 1000, 1) + ' <small>kPa</small>';
  $("temperature").innerHTML = fmt(calculated.temperature_k - 273.15, 1) + ' <small>°C</small>';
  $("radiation").innerHTML = fmt(calculated.radiation_gy, 6) + ' <small>Gy</small>';
  $("acceleration").innerHTML = fmt(calculated.acceleration_g, 2) + ' <small>g</small>';
  $("elapsed").textContent = "T+" + String(Math.round(calculated.elapsed_seconds)).padStart(3, "0") + " s";
  setBar("oxygen-bar", calculated.oxygen_kg / 8 * 100);
  setBar("energy-bar", calculated.energy_j / 500000 * 100);
  setBar("pressure-bar", calculated.pressure_pa / 110000 * 100, calculated.pressure_pa < 70000 ? "var(--red)" : "var(--cyan)");
  setBar("temperature-bar", (calculated.temperature_k - 270) / 40 * 100, calculated.temperature_k < 285 || calculated.temperature_k > 305 ? "var(--amber)" : "var(--cyan)");
  setBar("radiation-bar", calculated.radiation_gy / 0.001 * 100, calculated.radiation_gy > 0.001 ? "var(--red)" : "var(--cyan)");
  setBar("acceleration-bar", calculated.acceleration_g / 4 * 100, calculated.acceleration_g > 4 ? "var(--amber)" : "var(--cyan)");
  $("phase-title").textContent = {liftoff:"Liftoff telemetry",ascent:"Ascent telemetry",descent:"Descent telemetry",landing:"Touchdown assessment"}[calculated.phase];
  $("mission-status").textContent = !verdict.alive ? "Mission lost" : verdict.mission_status === "SUCCESS" ? "Mission successful" : "Astronaut alive";
  $("status-description").textContent = !verdict.alive ? "Rust authority has declared mission loss based on the supplied flight state." : verdict.warnings.length ? "Rust has kept the astronaut alive, but one or more game thresholds are out of range." : "Rust authority has accepted the calculated telemetry. The astronaut is alive.";
  const pill = $("verdict-pill");
  pill.textContent = verdict.mission_status.replaceAll("_", " ");
  pill.className = "pill " + (!verdict.alive ? "bad" : verdict.warnings.length ? "warn" : "good");
  $("advance").textContent = verdict.mission_status === "SUCCESS" ? "Mission complete" : "Advance simulation · 5 s";
  $("advance").disabled = !verdict.alive || verdict.mission_status === "SUCCESS";
  $("next-phase").disabled = !verdict.alive || phaseIndex >= phases.length - 1;
  document.querySelectorAll(".phase").forEach((el, index) => {
    el.classList.toggle("active", index === phaseIndex);
    el.classList.toggle("done", index < phaseIndex);
  });
  document.querySelector(".rocket").style.transform = "translate(-50%,-50%) rotate(" + (phaseIndex === 2 ? 180 : phaseIndex === 3 ? 0 : -6) + "deg)";
  logMessages(verdict, calculated);
}
async function simulate(deltaSeconds) {
  $("advance").disabled = true;
  $("mission-status").textContent = "Calculating…";
  try {
    const response = await fetch("/simulate", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({phase:phases[phaseIndex],dt_seconds:deltaSeconds,state})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Simulation request failed");
    state.elapsed_seconds = data.calculated.elapsed_seconds;
    state.oxygen_kg = data.calculated.oxygen_kg;
    state.energy_j = data.calculated.energy_j;
    state.temperature_k = data.calculated.temperature_k;
    state.radiation_gy = data.calculated.radiation_gy;
    render(data.calculated, data.verdict);
  } catch (error) {
    $("mission-status").textContent = "Simulation offline";
    $("status-description").textContent = error.message;
    $("verdict-pill").textContent = "NO AUTHORITY";
    $("verdict-pill").className = "pill bad";
    $("advance").disabled = false;
  }
}
$("advance").addEventListener("click", () => simulate(phaseIndex === 0 && state.elapsed_seconds === 0 ? 0 : 5));
$("next-phase").addEventListener("click", () => {
  if (!latestVerdict || !latestVerdict.alive || phaseIndex >= phases.length - 1) return;
  phaseIndex += 1;
  simulate(0);
});
$("reset").addEventListener("click", () => {
  state = initialState(); phaseIndex = 0; latestVerdict = null;
  $("mission-status").textContent = "Awaiting telemetry";
  $("status-description").textContent = "Run the preflight checks to send calculated state to the Rust mission authority.";
  $("verdict-pill").textContent = "STANDBY"; $("verdict-pill").className = "pill neutral";
  $("elapsed").textContent = "T+000 s"; $("advance").disabled = false; $("advance").textContent = "Run preflight checks"; $("next-phase").disabled = true;
  $("decision-log").innerHTML = '<li class="muted">No verdict received yet.</li>';
  document.querySelectorAll(".phase").forEach((el,index) => {el.classList.toggle("active",index===0);el.classList.remove("done");});
  $("oxygen").innerHTML='8.00 <small>kg</small>'; $("energy").innerHTML='500 <small>kJ</small>'; $("pressure").innerHTML='— <small>kPa</small>'; $("temperature").innerHTML='20.0 <small>°C</small>'; $("radiation").innerHTML='0.000 <small>Gy</small>'; $("acceleration").innerHTML='— <small>g</small>';
});
$("oxygen-rate").addEventListener("input", (event) => {state.oxygen_rate_kg_s=Number(event.target.value);$("oxygen-rate-label").textContent=fmt(state.oxygen_rate_kg_s,4)+" kg/s";});
$("load").addEventListener("input", (event) => {state.load_w=Number(event.target.value);$("load-label").textContent=state.load_w+" W";});
$("speed").addEventListener("input", (event) => {state.vertical_speed_m_s=Number(event.target.value);$("speed-label").textContent=fmt(state.vertical_speed_m_s,1)+" m/s";});
$("heat").addEventListener("input", (event) => {const watts=Number(event.target.value);state.heater_w=Math.max(0,watts);state.cooling_w=Math.max(0,-watts);$("heat-label").textContent=watts+" W";});
