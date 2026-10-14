import { useState } from "react";
import { loadGameState, saveGameState } from "./gameState";
import { Battery, Car, Check, Cloud, Compass, Droplets, Factory, Home, LockKeyhole, Microscope, Pickaxe, Radio, Shield, Sprout, Sun, Thermometer, Wind, Wrench, Zap, Rotate3D, RefreshCw, } from "lucide-react";
import { TechnicalViewer } from "./TechnicalViewer";
import { GameShell, SectionLabel, } from "./_shared/GameShell";
import { formatCredits, technologyTracks, tierMeta, tierUnlockRequirements, } from "./_shared/gameData";
const categoryIcons = {
    Solar: Sun,
    Battery,
    Oxygen: Wind,
    Water: Droplets,
    "CO₂": Cloud,
    Thermal: Thermometer,
    Comms: Radio,
    Habitat: Home,
    Radiation: Shield,
    "Power Grid": Zap,
    Science: Microscope,
    Navigation: Compass,
    Rover: Car,
    Extraction: Pickaxe,
    ISRU: Factory,
    Agriculture: Sprout,
    Maintenance: Wrench,
};
const tiers = ["Foundation", "Frontier", "Apex", "Research"];
function requirementCopy(track, tier) {
    const requirement = tierUnlockRequirements[tier];
    if (tier === "Foundation")
        return "Starting technology";
    if (tier === "Research") {
        const researchTokens = track.tiers[tier].researchTokens;
        return `${requirement.xp.toLocaleString()} XP + ${researchTokens} RT`;
    }
    return `${requirement.xp.toLocaleString()} XP`;
}
export function TechnologyLabRefresh() {
    const [gameState, setGameState] = useState(() => loadGameState());
    const [selectedTrackId, setSelectedTrackId] = useState("solar");
    const [selectedTier, setSelectedTier] = useState("Foundation");
    const [viewer, setViewer] = useState(null);
    const [notice, setNotice] = useState(null);
    const [sellConfirmation, setSellConfirmation] = useState(null);
    const selectedTrack = technologyTracks.find((track) => track.id === selectedTrackId) ??
        technologyTracks[0];
    const SelectedIcon = categoryIcons[selectedTrack.category] ?? Zap;
    function technologyKey(tier) {
        return `${selectedTrack.id}:${tier}`;
    }
    function isOwned(tier) {
        return tier === "Foundation" || gameState.unlockedTechnologies.includes(technologyKey(tier));
    }
    function isPreviousTierOwned(tier) {
        const index = tiers.indexOf(tier);
        return index <= 0 || isOwned(tiers[index - 1]);
    }
    function isTierEligible(tier) {
        if (!isPreviousTierOwned(tier))
            return false;
        const requirement = tierUnlockRequirements[tier];
        const requiredTokens = tier === "Research" ? selectedTrack.tiers[tier].researchTokens : 0;
        return (gameState.xp >= requirement.xp &&
            gameState.researchTokens >= requiredTokens);
    }
    function selectTier(tier) {
        if (!isPreviousTierOwned(tier)) {
            const previousTier = tiers[tiers.indexOf(tier) - 1];
            setNotice(`${tier} requires ${previousTier} to be unlocked first.`);
            return;
        }
        if (isOwned(tier)) {
            setSelectedTier(tier);
            setNotice(null);
            return;
        }
        const requirement = tierUnlockRequirements[tier];
        const requiredTokens = tier === "Research" ? selectedTrack.tiers[tier].researchTokens : 0;
        if (gameState.xp < requirement.xp) {
            setNotice(`${tier} requires ${requirement.xp.toLocaleString()} XP.`);
            return;
        }
        if (gameState.researchTokens < requiredTokens) {
            setNotice(`${tier} requires ${requiredTokens} Research Token${requiredTokens === 1 ? "" : "s"}.`);
            return;
        }
        setSelectedTier(tier);
        setNotice(`${selectedTrack.tiers[tier].name} is ready to unlock.`);
    }
    function sellTechnology(tier) {
        if (tier === "Foundation") {
            setNotice("Foundation technology cannot be sold.");
            return;
        }
        if (!isOwned(tier)) {
            setNotice("This technology tier is not currently owned.");
            return;
        }
        const higherTier = tiers[tiers.indexOf(tier) + 1];
        if (higherTier && isOwned(higherTier)) {
            setNotice(`Sell ${higherTier} before selling ${tier}.`);
            return;
        }
        const equipment = selectedTrack.tiers[tier];
        const requirement = tierUnlockRequirements[tier];
        const researchRefund = equipment.researchTokens;
        const xpRefund = Math.floor(requirement.xp * 0.5);
        setSellConfirmation({ tier, equipmentName: equipment.name, xpRefund, researchRefund });
    }
    function confirmSellTechnology() {
        if (!sellConfirmation)
            return;
        const { tier, equipmentName, xpRefund, researchRefund } = sellConfirmation;
        const key = technologyKey(tier);
        const nextState = {
            ...gameState,
            xp: gameState.xp + xpRefund,
            researchTokens: gameState.researchTokens + researchRefund,
            unlockedTechnologies: gameState.unlockedTechnologies.filter((technology) => technology !== key),
        };
        saveGameState(nextState);
        setGameState(nextState);
        setSelectedTier(tier);
        setNotice(`${equipmentName} sold. ${xpRefund.toLocaleString()} XP and ${researchRefund} Research Token${researchRefund === 1 ? "" : "s"} returned.`);
        setSellConfirmation(null);
    }
    function unlockTechnology(tier) {
        if (tier === "Foundation") {
            setSelectedTier(tier);
            setNotice(`${selectedTrack.tiers[tier].name} is starting technology and is already installed.`);
            return;
        }
        if (isOwned(tier)) {
            setSelectedTier(tier);
            setNotice(`${selectedTrack.tiers[tier].name} is already owned.`);
            return;
        }
        if (!isPreviousTierOwned(tier)) {
            const previousTier = tiers[tiers.indexOf(tier) - 1];
            setNotice(`Cannot unlock ${selectedTrack.tiers[tier].name}: unlock ${previousTier} first.`);
            return;
        }
        const requirement = tierUnlockRequirements[tier];
        const equipment = selectedTrack.tiers[tier];
        const requiredTokens = tier === "Research" ? equipment.researchTokens : 0;
        if (gameState.xp < requirement.xp) {
            setNotice(`Cannot unlock ${equipment.name}: requires ${requirement.xp.toLocaleString()} XP.`);
            return;
        }
        if (gameState.researchTokens < requiredTokens) {
            setNotice(`Cannot unlock ${equipment.name}: requires ${requiredTokens} Research Token${requiredTokens === 1 ? "" : "s"}.`);
            return;
        }
        const nextState = {
            ...gameState,
            xp: gameState.xp - requirement.xp,
            researchTokens: gameState.researchTokens - requiredTokens,
            unlockedTechnologies: [
                ...gameState.unlockedTechnologies,
                technologyKey(tier),
            ],
        };
        saveGameState(nextState);
        setGameState(nextState);
        setSelectedTier(tier);
        setNotice(`${equipment.name} unlocked for mission deployment. ${requirement.xp.toLocaleString()} XP${requiredTokens > 0 ? ` and ${requiredTokens} Research Token${requiredTokens === 1 ? "" : "s"}` : ""} spent. No Credits were spent.`);
    }
    if (viewer) {
        const viewerTrack = technologyTracks.find((track) => track.id === viewer.trackId) ?? technologyTracks[0];
        return (<TechnicalViewer track={viewerTrack} tier={viewer.tier} onBack={() => setViewer(null)}/>);
    }
    return (<GameShell active="lab" eyebrow="Research terminal / capability ladder" title="Technology Lab">
      {sellConfirmation && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#02080c]/80 p-5 backdrop-blur-[2px]">
          <div className="w-full max-w-md border-2 border-[#d77a5a] bg-[#101b20] shadow-[0_0_40px_rgba(215,122,90,0.22)]">
            <div className="border-b border-[#5c3f38] bg-[#241a19] px-5 py-4">
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#d77a5a]">Technology transaction</p>
              <h2 className="mt-2 text-lg font-semibold uppercase tracking-[0.1em] text-[#f1eee5]">Confirm sale</h2>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm leading-6 text-[#d8e3dc]">Sell <span className="font-bold text-[#f0d49b]">{sellConfirmation.equipmentName}</span>?</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="border border-[#34545a] bg-[#0b171d] p-3">
                  <p className="text-[8px] uppercase tracking-[0.18em] text-[#76908e]">XP returned</p>
                  <p className="mt-1 font-mono text-sm text-[#9fce82]">+{sellConfirmation.xpRefund.toLocaleString()}</p>
                </div>
                <div className="border border-[#34545a] bg-[#0b171d] p-3">
                  <p className="text-[8px] uppercase tracking-[0.18em] text-[#76908e]">Research Tokens returned</p>
                  <p className="mt-1 font-mono text-sm text-[#efb658]">+{sellConfirmation.researchRefund}</p>
                </div>
              </div>
              <p className="mt-4 text-[9px] uppercase tracking-[0.12em] leading-5 text-[#819b96]">Full Research Token cost is refunded. XP refund is 50% of the tier requirement.</p>
            </div>
            <div className="flex justify-end gap-3 border-t border-[#29434a] bg-[#0b171d] px-5 py-4">
              <button type="button" onClick={() => setSellConfirmation(null)} className="border border-[#42575b] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#9ab0ad] hover:border-[#789293] hover:text-[#dce9dc]">Cancel</button>
              <button type="button" onClick={confirmSellTechnology} className="border border-[#d77a5a] bg-[#d77a5a] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#171515] hover:bg-[#e39a80]">Confirm sale</button>
            </div>
          </div>
        </div>)}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border border-[#47553d] bg-[#172a2a] px-5 py-4">
        <div className="flex items-center gap-3">
          <Check className="h-4 w-4 text-[#9fce82]"/>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#dce9cd]">
            Foundation systems online · 17 / 17
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-[#9fba9e]">
          Locked tiers cannot be selected or unlocked
        </p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[245px_minmax(0,1fr)_300px]">
        <aside className="border border-[#29434a] bg-[#0b1a21] p-4">
          <SectionLabel>Technology tracks</SectionLabel>
          <p className="mb-4 text-xs leading-5 text-[#829d99]">
            Choose a category to inspect its visible capability ladder.
          </p>
          <div className="space-y-1.5">
            {technologyTracks.map((track) => {
            const Icon = categoryIcons[track.category] ??
                Zap;
            const active = selectedTrack.id === track.id;
            return (<button key={track.id} type="button" onClick={() => {
                    setSelectedTrackId(track.id);
                    setSelectedTier("Foundation");
                }} className={`flex w-full items-center gap-3 border px-3 py-2.5 text-left transition ${active
                    ? "border-[#738b64] bg-[#18302f] text-[#e5efdb]"
                    : "border-transparent text-[#76918e] hover:border-[#36545a] hover:bg-[#10242a] hover:text-[#d5e5ce]"}`}>
                  <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#efb658]" : "text-[#75918f]"}`}/>
                  <span className="min-w-0 flex-1 text-[9px] font-bold uppercase tracking-[0.16em]">
                    {track.category}
                  </span>
                  <Check className="h-3 w-3 text-[#84c89e]"/>
                </button>);
        })}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#29434a] pb-5">
            <div>
              <SectionLabel>
                {selectedTrack.category} progression · {selectedTrack.shortName}
              </SectionLabel>
              <div className="flex items-center gap-3">
                <SelectedIcon className="h-6 w-6 text-[#efb658]"/>
                <h2 className="text-xl font-semibold uppercase tracking-[0.14em] text-[#f0f4e8]">
                  {selectedTrack.description}
                </h2>
              </div>
            </div>
            <div className="border border-[#3d5b50] bg-[#10232a] px-4 py-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#76908e]">
                Research bank
              </p>
              <p className="font-mono text-sm text-[#e8efdd]">
                {gameState.xp.toLocaleString()} XP{" "}
                <span className="text-[#76908e]">· {gameState.researchTokens} tokens</span>
              </p>
            </div>
          </div>

             <button type="button" onClick={() => setViewer({ trackId: selectedTrack.id, tier: selectedTier })} className="flex items-center gap-3 border border-[#536d61] bg-[#11252a] px-4 py-3 text-left transition hover:border-[#efb658] hover:bg-[#172f32]">
               <Rotate3D className="h-5 w-5 text-[#9fce82]"/>
               <span>
                 <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-[#efb658]">
                   View {selectedTrack.category}
                 </span>
                 <span className="mt-1 block text-[9px] uppercase tracking-[0.12em] text-[#789690]">
                   3D viewer · {selectedTier} configuration
                 </span>
               </span>
             </button>

          <div className="relative space-y-3">
            <div className="absolute bottom-7 left-5 top-7 w-px bg-gradient-to-b from-[#9fce82] via-[#72b9d4] to-[#e9a15d]"/>
            {tiers.map((tier) => {
            const equipment = selectedTrack.tiers[tier];
            const owned = isOwned(tier);
            const requirement = tierUnlockRequirements[tier];
            const unlocked = owned || isTierEligible(tier);
            const selected = selectedTier === tier;
            const meta = tierMeta[tier];
            return (<div key={tier} type="button" role="button" tabIndex={unlocked ? 0 : -1} aria-disabled={!unlocked} onClick={() => {
                    if (!unlocked)
                        return;
                    selectTier(tier);
                }} onKeyDown={(event) => {
                    if (!unlocked)
                        return;
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectTier(tier);
                    }
                }} className={`relative w-full border p-4 text-left transition ${selected
                    ? "border-[#d3e49f] bg-[#182f2f] shadow-[inset_3px_0_0_#efb658]"
                    : unlocked
                        ? "border-[#29434a] bg-[#0d2028] hover:border-[#90b4a2]"
                        : "border-[#29434a] bg-[#0d2028] opacity-70"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-9 w-9 place-items-center border text-[10px] font-bold" style={{ borderColor: meta.color, color: meta.color }}>
                        {meta.short}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-[0.22em]" style={{ color: meta.color }}>
                            {tier}
                          </span>
                          {owned ? (<span className="flex items-center gap-1 text-[8px] uppercase tracking-[0.16em] text-[#9cd0a8]">
                              <Check className="h-3 w-3"/>
                              Owned
                            </span>) : tier === "Foundation" ? (<span className="flex items-center gap-1 text-[8px] uppercase tracking-[0.16em] text-[#9cd0a8]">
                              <Check className="h-3 w-3"/>
                              Installed
                            </span>) : unlocked ? (<span className="flex items-center gap-1 text-[8px] uppercase tracking-[0.16em] text-[#efb658]">
                              Ready to purchase
                            </span>) : (<span className="flex items-center gap-1 text-[8px] uppercase tracking-[0.16em] text-[#a6a796]">
                              <LockKeyhole className="h-3 w-3"/> Locked
                            </span>)}
                        </div>
                        <h3 className="mt-1 text-lg font-semibold uppercase tracking-[0.1em] text-[#eef3e7]">
                          {equipment.name}
                        </h3>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-[#789491]">
                          Unlock: {requirementCopy(selectedTrack, tier)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#92a9a0]">
                        {selected ? "Selected" : owned ? "Owned" : unlocked ? "Ready" : "Locked"}
                      </span>
                      <button type="button" onClick={(event) => {
                    event.stopPropagation();
                    unlockTechnology(tier);
                }} disabled={owned || (tier !== "Foundation" && !unlocked)} className={owned
                    ? "border border-[#426b58] bg-[#112b25] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#8fca9f]"
                    : tier === "Foundation"
                        ? "border border-[#485f53] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#86a598]"
                        : unlocked
                            ? "border border-[#efb658] bg-[#efb658] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#17201b] hover:bg-[#f6cb7b]"
                            : "cursor-not-allowed border border-[#4a5350] bg-[#151d20] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#687c78]"}>
                        {owned ? "Owned" : tier === "Foundation" ? "Installed" : "Unlock"}
                      </button>
                      {owned && tier !== "Foundation" && (<button type="button" onClick={(event) => {
                        event.stopPropagation();
                        sellTechnology(tier);
                    }} className="flex items-center gap-1 border border-[#6b4c42] bg-[#241b1a] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#d9a08d] hover:border-[#d77a5a] hover:bg-[#30201e]" title="Sell this technology for a 50% XP and full Research Token refund">
                          <RefreshCw className="h-3 w-3"/>
                          Sell
                        </button>)}
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#29434a] pt-4 sm:grid-cols-4">
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#76908e]">
                        Mass
                      </p>
                      <p className="font-mono text-xs text-[#d8e3cf]">
                        {equipment.mass.toLocaleString()} kg
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#76908e]">
                        Cost
                      </p>
                      <p className="font-mono text-xs text-[#d8e3cf]">
                        {formatCredits(equipment.cost)}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-[#76908e]">
                        Efficiency
                      </p>
                      <p className="font-mono text-xs text-[#d8e3cf]">
                        {equipment.efficiency}
                      </p>
                    </div>
                  </div>


                  <p className="mt-3 border-l-2 border-[#526c5a] bg-[#10252a] px-3 py-2 text-xs leading-5 text-[#a9c0b5]">
                    {equipment.description}
                  </p>
                </div>);
        })}
          </div>

          {notice && (<div className="mt-4 border border-[#765d2f] bg-[#211f17] px-4 py-3 text-[10px] leading-5 uppercase tracking-[0.12em] text-[#d8c58f]">
              {notice}
            </div>)}
        </section>

        <aside className="space-y-4">
          <section className="border border-[#67543b] bg-[#171f23] p-5">
            <SectionLabel>Research gate</SectionLabel>
            <h2 className="text-lg font-semibold uppercase tracking-[0.12em] text-[#f1ebd1]">
              Earn, then select.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#b6b19d]">
              Research opportunities are optional, but they are the only way to
              earn Research Tokens. XP and tokens keep counting beyond every
              milestone.
            </p>
            <div className="mt-5 space-y-4 border-t border-[#514635] pt-4">
              <div className="flex justify-between text-[10px] uppercase tracking-[0.16em]">
                <span className="text-[#8e978a]">Experience earned</span>
                <span className="font-mono text-[#f1d47c]">
                  {gameState.xp.toLocaleString()} XP
                </span>
              </div>
              <div className="flex justify-between text-[10px] uppercase tracking-[0.16em]">
                <span className="text-[#8e978a]">Research Tokens earned</span>
                <span className="font-mono text-[#f1d47c]">
                  {gameState.researchTokens}
                </span>
              </div>
            </div>
          </section>
          <section className="border border-[#29434a] bg-[#0d2028] p-5">
            <SectionLabel>Tier requirements</SectionLabel>
            <div className="space-y-3">
              {tiers.map((tier) => (<div key={tier} className="flex items-center justify-between border-b border-[#29434a] pb-3 last:border-0 last:pb-0">
                  <span className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: tierMeta[tier].color }}>
                    {tier}
                  </span>
                  <span className="text-right text-[9px] uppercase tracking-[0.12em] text-[#829b96]">
                    {requirementCopy(selectedTrack, tier)}
                  </span>
                </div>))}
            </div>
          </section>
          <p className="border border-[#29434a] bg-[#0c1b23] p-4 text-[10px] leading-5 uppercase tracking-[0.14em] text-[#7f9c96]">
            No hover popup in the lab. All field details remain visible in each
            tier row. Research tiers can be sold for a 50% XP refund and the full Research Token cost,
            so the technology can be repurchased later.
          </p>
        </aside>
      </div>
    </GameShell>);
}
export default TechnologyLabRefresh;
