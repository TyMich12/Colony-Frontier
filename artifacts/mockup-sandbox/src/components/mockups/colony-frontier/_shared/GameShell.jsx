import { ArrowLeft, ChevronRight, CircleHelp, Cpu, Home, Map, Settings, } from "lucide-react";
import { loadGameState } from "../gameState";
const routes = {
    menu: "/preview/MainMenu",
    campaign: "/preview/CampaignMapRefresh",
    lab: "/preview/TechnologyLabRefresh",
    loadout: "/preview/MissionLoadout",
};
const navItems = [
    { key: "menu", label: "Command", icon: Home },
    { key: "campaign", label: "Campaign", icon: Map },
    { key: "lab", label: "Technology", icon: Cpu },
    { key: "loadout", label: "Loadout", icon: Settings },
];
export function GameShell({ active, eyebrow, title, children, }) {
    const gameState = loadGameState();
    return (<div className="min-h-screen bg-[#071018] text-[#edf4ec] [font-family:Arial,sans-serif]">
      <div className="relative mx-auto min-h-screen max-w-[1380px] overflow-hidden bg-[radial-gradient(circle_at_80%_5%,rgba(67,164,173,0.11),transparent_26%),linear-gradient(125deg,#071018_0%,#0a1720_62%,#0c2024_100%)]">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(154,199,190,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(154,199,190,0.06)_1px,transparent_1px)] [background-size:44px_44px]"/>

        <header className="relative border-b border-[#284047]">
          <div className="flex items-center justify-between px-8 py-5 md:px-12">
            <a href={routes.menu} className="group flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center border border-[#9cae8d] bg-[#15272b] text-[#d5e6bd] shadow-[0_0_24px_rgba(164,204,153,0.12)]">
                <span className="h-3 w-3 rounded-full bg-[#efb658] shadow-[0_0_14px_#efb658]"/>
              </span>

              <span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.35em] text-[#a6b8a2]">
                  Colony
                </span>

                <span className="block text-sm font-semibold uppercase tracking-[0.22em] text-[#edf4ec]">
                  Frontier Program
                </span>
              </span>
            </a>

            <div className="hidden items-center gap-7 text-[10px] uppercase tracking-[0.28em] text-[#7c9a9a] md:flex">
              <span>Cycle 03 / 2049</span>

              <span className="flex items-center gap-2 text-[#b6d2b0]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#66c69e]"/>
                Systems nominal
              </span>
            </div>

            <a href={routes.menu} className="grid h-9 w-9 place-items-center border border-[#284047] text-[#88a3a2] transition hover:border-[#b3c98f] hover:text-[#d7e8bd]" aria-label="Return to command">
              <ArrowLeft className="h-4 w-4"/>
            </a>
          </div>

          <div className="grid grid-cols-3 border-t border-[#1d343b] bg-[#08151c]/90">
            <div className="border-r border-[#1d343b] px-6 py-3 md:px-12">
              <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#718f80]">
                Colony Treasury
              </div>

              <div className="mt-1 font-mono text-lg font-bold text-[#efb658]">
                ${gameState.credits % 1 === 0
            ? gameState.credits.toFixed(0)
            : gameState.credits.toFixed(1)}
                M
              </div>
            </div>

            <div className="border-r border-[#1d343b] px-6 py-3 md:px-12">
              <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#718f80]">
                Experience
              </div>

              <div className="mt-1 font-mono text-lg font-bold text-[#d7e8bd]">
                {gameState.xp.toLocaleString()} XP
              </div>
            </div>

            <div className="px-6 py-3 md:px-12">
              <div className="text-[8px] font-bold uppercase tracking-[0.24em] text-[#718f80]">
                Research
              </div>

              <div className="mt-1 font-mono text-lg font-bold text-[#d7e8bd]">
                {gameState.researchTokens} RT
              </div>
            </div>
          </div>
        </header>

        <main className="relative px-6 pb-24 pt-10 md:px-12 md:pt-14">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.38em] text-[#efb658]">
                <span className="h-px w-7 bg-[#efb658]"/>
                {eyebrow}
              </p>

              <h1 className="text-3xl font-semibold uppercase tracking-[0.16em] text-[#eef4e9] md:text-5xl">
                {title}
              </h1>
            </div>

            <div className="hidden items-center gap-2 text-right text-[10px] uppercase tracking-[0.22em] text-[#759091] sm:block">
              <span className="block text-[#adc5ab]">Mission Control</span>

              <span className="flex items-center justify-end gap-2">
                <CircleHelp className="h-3.5 w-3.5"/>
                Briefing channel 07
              </span>
            </div>
          </div>

          {children}
        </main>

        <nav className="absolute bottom-0 left-0 right-0 flex border-t border-[#284047] bg-[#08151d]/95 px-4 py-3 backdrop-blur-md md:px-12">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
            {navItems.map(({ key, label, icon: Icon }) => (<a key={key} href={routes[key]} className={`group flex items-center gap-2 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.2em] transition ${active === key
                ? "text-[#f0bc61]"
                : "text-[#658080] hover:text-[#d4e5c2]"}`}>
                <Icon className="h-4 w-4"/>

                <span className="hidden sm:inline">{label}</span>

                {active === key && (<span className="ml-1 h-1 w-1 rounded-full bg-[#f0bc61]"/>)}
              </a>))}
          </div>
        </nav>
      </div>
    </div>);
}
export function SectionLabel({ children }) {
    return (<div className="mb-3 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.28em] text-[#9db3a6]">
      <span className="h-px w-6 bg-[#557777]"/>
      {children}
    </div>);
}
export function ProgressBar({ value, color = "#efb658", }) {
    return (<div className="h-1.5 overflow-hidden bg-[#1b3136]">
      <div className="h-full transition-all" style={{
            width: `${value}%`,
            backgroundColor: color,
        }}/>
    </div>);
}
export function LinkArrow() {
    return <ChevronRight className="h-4 w-4 text-[#efb658]"/>;
}
