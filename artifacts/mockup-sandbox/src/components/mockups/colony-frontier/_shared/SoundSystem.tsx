import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type SoundPreferences = {
  muted: boolean;
  musicVolume: number;
  effectsVolume: number;
};

type SoundSystemContextValue = {
  preferences: SoundPreferences;
  updatePreferences: (update: Partial<SoundPreferences>) => void;
  playFootstep: (surface: "pad" | "lunar") => void;
  setEngineSound: (throttle: number) => void;
};

const STORAGE_KEY = "colony-frontier-audio-settings";
const DEFAULT_PREFERENCES: SoundPreferences = {
  muted: false,
  musicVolume: 0.2,
  effectsVolume: 0.35,
};

const SoundSystemContext = createContext<SoundSystemContextValue | null>(null);

function readPreferences(): SoundPreferences {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return DEFAULT_PREFERENCES;

    const candidate = saved as Partial<SoundPreferences>;
    return {
      muted: typeof candidate.muted === "boolean" ? candidate.muted : DEFAULT_PREFERENCES.muted,
      musicVolume: typeof candidate.musicVolume === "number"
        ? Math.max(0, Math.min(1, candidate.musicVolume))
        : DEFAULT_PREFERENCES.musicVolume,
      effectsVolume: typeof candidate.effectsVolume === "number"
        ? Math.max(0, Math.min(1, candidate.effectsVolume))
        : DEFAULT_PREFERENCES.effectsVolume,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

class ColonyAudioEngine {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOscillators: OscillatorNode[] = [];
  private engineNoise: AudioBufferSourceNode | null = null;
  private engineNoiseGain: GainNode | null = null;
  private engineNoiseFilter: BiquadFilterNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineThrottle = 0;
  private musicTimer: number | null = null;
  private chordIndex = 0;
  private started = false;

  configure(preferences: SoundPreferences): void {
    if (!this.context || !this.musicGain || !this.effectsGain) return;
    const enabled = preferences.muted ? 0 : 1;
    this.musicGain.gain.setTargetAtTime(
      preferences.musicVolume * enabled,
      this.context.currentTime,
      0.12,
    );
    this.effectsGain.gain.setTargetAtTime(
      preferences.effectsVolume * enabled,
      this.context.currentTime,
      0.03,
    );
  }

  async unlock(preferences: SoundPreferences): Promise<void> {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;

    if (!this.context) {
      this.context = new AudioContext();
      this.musicGain = this.context.createGain();
      this.effectsGain = this.context.createGain();
      this.musicGain.connect(this.context.destination);
      this.effectsGain.connect(this.context.destination);
    }

    this.configure(preferences);
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    this.syncEngineSound();

    if (!this.started) {
      this.started = true;
      this.playAmbientChord();
      this.musicTimer = window.setInterval(() => this.playAmbientChord(), 7200);
    }
  }

  playEffect(kind: "click" | "navigate" | "confirm" | "alert"): void {
    if (!this.context || !this.effectsGain || this.context.state !== "running") return;

    const now = this.context.currentTime;
    const notes = kind === "alert"
      ? [660, 880]
      : kind === "confirm"
        ? [523.25, 783.99]
        : kind === "navigate"
          ? [420, 560]
          : [480];
    const duration = kind === "alert" ? 0.42 : 0.12;

    notes.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const envelope = this.context!.createGain();
      oscillator.type = kind === "alert" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(frequency, now);
      if (kind === "alert") {
        oscillator.frequency.setValueAtTime(frequency * 0.88, now + 0.19);
      }
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(kind === "click" ? 0.12 : 0.2, now + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(envelope);
      envelope.connect(this.effectsGain!);
      oscillator.start(now + index * 0.035);
      oscillator.stop(now + duration + index * 0.035);
    });
  }

  playFootstep(surface: "pad" | "lunar"): void {
    if (!this.context || !this.effectsGain || this.context.state !== "running") return;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const thump = this.context.createGain();
    const noise = this.context.createBufferSource();
    const noiseFilter = this.context.createBiquadFilter();
    const noiseEnvelope = this.context.createGain();
    const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 0.11, this.context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
    }

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(surface === "lunar" ? 92 : 128, now);
    oscillator.frequency.exponentialRampToValueAtTime(surface === "lunar" ? 48 : 54, now + 0.1);
    thump.gain.setValueAtTime(0.0001, now);
    thump.gain.exponentialRampToValueAtTime(surface === "lunar" ? 0.28 : 0.19, now + 0.008);
    thump.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    noise.buffer = noiseBuffer;
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(surface === "lunar" ? 520 : 1200, now);
    noiseEnvelope.gain.setValueAtTime(0.0001, now);
    noiseEnvelope.gain.exponentialRampToValueAtTime(surface === "lunar" ? 0.11 : 0.16, now + 0.008);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    oscillator.connect(thump);
    thump.connect(this.effectsGain);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnvelope);
    noiseEnvelope.connect(this.effectsGain);
    oscillator.start(now);
    oscillator.stop(now + 0.14);
    noise.start(now);
    noise.stop(now + 0.1);
  }

  setEngineSound(throttle: number): void {
    this.engineThrottle = Math.max(0, Math.min(1, throttle));
    this.syncEngineSound();
  }

  private syncEngineSound(): void {
    if (!this.context || !this.effectsGain || this.context.state !== "running") return;
    if (!this.engineGain && this.engineThrottle <= 0) return;

    if (!this.engineGain) {
      this.engineGain = this.context.createGain();
      this.engineGain.gain.value = 0.0001;
      this.engineGain.connect(this.effectsGain);

      this.engineFilter = this.context.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.Q.value = 0.9;
      this.engineFilter.connect(this.engineGain);

      this.engineNoiseFilter = this.context.createBiquadFilter();
      this.engineNoiseFilter.type = "bandpass";
      this.engineNoiseFilter.Q.value = 0.8;
      this.engineNoiseGain = this.context.createGain();
      this.engineNoiseGain.gain.value = 0.0001;
      this.engineNoiseFilter.connect(this.engineNoiseGain);
      this.engineNoiseGain.connect(this.engineGain);

      const lowOscillator = this.context.createOscillator();
      lowOscillator.type = "sawtooth";
      lowOscillator.connect(this.engineFilter);
      lowOscillator.start();

      const midOscillator = this.context.createOscillator();
      midOscillator.type = "square";
      midOscillator.connect(this.engineFilter);
      midOscillator.start();

      const highOscillator = this.context.createOscillator();
      highOscillator.type = "triangle";
      highOscillator.connect(this.engineFilter);
      highOscillator.start();
      this.engineOscillators = [lowOscillator, midOscillator, highOscillator];

      const noiseBuffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let index = 0; index < samples.length; index += 1) {
        const sweep = 1 - index / samples.length;
        samples[index] = (Math.random() * 2 - 1) * sweep;
      }
      this.engineNoise = this.context.createBufferSource();
      this.engineNoise.buffer = noiseBuffer;
      this.engineNoise.loop = true;
      this.engineNoise.connect(this.engineNoiseFilter);
      this.engineNoise.start();
    }

    const now = this.context.currentTime;
    const active = this.engineThrottle > 0;
    const targetGain = active ? 0.12 + this.engineThrottle * 0.58 : 0.0001;
    this.engineGain.gain.setTargetAtTime(targetGain, now, active ? 0.7 : 0.3);
    this.engineOscillators[0]?.frequency.setTargetAtTime(30 + this.engineThrottle * 54, now, 0.35);
    this.engineOscillators[1]?.frequency.setTargetAtTime(72 + this.engineThrottle * 118, now, 0.28);
    this.engineOscillators[2]?.frequency.setTargetAtTime(138 + this.engineThrottle * 210, now, 0.22);
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(180 + this.engineThrottle * 1040, now, 0.35);
      this.engineFilter.Q.setTargetAtTime(0.6 + this.engineThrottle * 1.8, now, 0.24);
    }
    if (this.engineNoiseFilter) {
      this.engineNoiseFilter.frequency.setTargetAtTime(220 + this.engineThrottle * 980, now, 0.25);
      this.engineNoiseFilter.Q.setTargetAtTime(0.7 + this.engineThrottle * 2.2, now, 0.25);
    }
    if (this.engineNoiseGain) {
      this.engineNoiseGain.gain.setTargetAtTime(active ? 0.06 + this.engineThrottle * 0.26 : 0.0001, now, 0.25);
    }
  }

  private playAmbientChord(): void {
    if (!this.context || !this.musicGain || this.context.state !== "running") return;

    const chords = [
      [110, 164.81, 220],
      [98, 146.83, 196],
      [130.81, 164.81, 196],
      [87.31, 130.81, 174.61],
    ];
    const now = this.context.currentTime;
    const chord = chords[this.chordIndex % chords.length];
    this.chordIndex += 1;

    chord.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const envelope = this.context!.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(index === 0 ? 0.2 : 0.075, now + 1.8);
      envelope.gain.setTargetAtTime(0.0001, now + 4.8, 0.7);
      oscillator.connect(envelope);
      envelope.connect(this.musicGain!);
      oscillator.start(now);
      oscillator.stop(now + 7);
    });
  }

  dispose(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.started = false;
    void this.context?.close();
    this.context = null;
    this.musicGain = null;
    this.effectsGain = null;
    this.engineGain = null;
    this.engineOscillators = [];
    this.engineNoise = null;
    this.engineNoiseGain = null;
    this.engineNoiseFilter = null;
    this.engineFilter = null;
  }
}

export function SoundSystemProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const preferencesRef = useRef(preferences);
  const engine = useMemo(() => new ColonyAudioEngine(), []);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Unable to save Colony Frontier sound settings.", error);
    }
    engine.configure(preferences);
  }, [engine, preferences]);

  useEffect(() => {
    const unlockAudio = () => {
      void engine.unlock(preferencesRef.current).catch((error: unknown) => {
        console.error("Unable to start Colony Frontier audio.", error);
      });
    };
    const playUiSound = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest("button, a, [role='button'], input[type='checkbox']");
      if (!control || control.hasAttribute("disabled")) return;

      const label = [
        control.getAttribute("aria-label"),
        control.getAttribute("title"),
        control.textContent,
      ].filter(Boolean).join(" ").toLowerCase();
      const kind = /alert|emergency|warning|critical/.test(label)
        ? "alert"
        : /confirm|start|begin|activate|complete|save|build|repair/.test(label)
          ? "confirm"
          : control.tagName === "A"
            ? "navigate"
            : "click";
      engine.playEffect(kind);
    };

    document.addEventListener("pointerdown", unlockAudio, true);
    document.addEventListener("keydown", unlockAudio, true);
    document.addEventListener("click", playUiSound, true);
    return () => {
      document.removeEventListener("pointerdown", unlockAudio, true);
      document.removeEventListener("keydown", unlockAudio, true);
      document.removeEventListener("click", playUiSound, true);
      engine.dispose();
    };
  }, [engine]);

  const playFootstep = useMemo(() => (surface: "pad" | "lunar") => {
    engine.playFootstep(surface);
  }, [engine]);
  const setEngineSound = useMemo(() => (throttle: number) => {
    engine.setEngineSound(throttle);
  }, [engine]);
  const value = useMemo<SoundSystemContextValue>(() => ({
    preferences,
    updatePreferences: (update) => setPreferences((current) => ({ ...current, ...update })),
    playFootstep,
    setEngineSound,
  }), [playFootstep, preferences, setEngineSound]);

  return (
    <SoundSystemContext.Provider value={value}>
      {children}
    </SoundSystemContext.Provider>
  );
}

export function useSoundSystem(): SoundSystemContextValue {
  const value = useContext(SoundSystemContext);
  if (!value) {
    throw new Error("useSoundSystem must be used within SoundSystemProvider.");
  }
  return value;
}

export function SoundSettings() {
  const { preferences, updatePreferences } = useSoundSystem();

  return (
    <section className="border border-[#3e5550] bg-[#101f23] p-5" aria-label="Audio settings">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#e8e9d9]">
            Audio
          </h3>
          <p className="mt-1 text-xs leading-5 text-[#9ca9a2]">
            Ambient soundtrack and interface feedback.
          </p>
        </div>
        <button
          type="button"
          aria-pressed={preferences.muted}
          onClick={() => updatePreferences({ muted: !preferences.muted })}
          className="shrink-0 border border-[#405c4e] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.16em] text-[#c9debc] transition hover:border-[#efb658]"
        >
          {preferences.muted ? "Sound off" : "Sound on"}
        </button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {([
          ["Music", "musicVolume"],
          ["Sound effects", "effectsVolume"],
        ] as const).map(([label, key]) => (
          <label key={key} className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[#a9bbb3]">
            <span className="mb-2 flex justify-between">
              <span>{label}</span>
              <span>{Math.round(preferences[key] * 100)}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={preferences[key]}
              onChange={(event) => updatePreferences({ [key]: Number(event.target.value) })}
              aria-label={`${label} volume`}
              className="w-full accent-[#efb658]"
            />
          </label>
        ))}
      </div>
    </section>
  );
}
