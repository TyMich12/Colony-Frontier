import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "zh-CN", label: "简体中文" },
  { code: "ja", label: "日本語" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];
type TranslationContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);
const API_URL = (import.meta.env.VITE_TRANSLATION_API_URL as string | undefined) || "/api/translate";
const CACHE_KEY = "colony-frontier-translation-cache";
const LANGUAGE_KEY = "colony-frontier-language";

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCache(cache: Record<string, string>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Translation still works when browser storage is unavailable or full.
  }
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return LANGUAGES.some((item) => item.code === saved) ? saved as LanguageCode : "en";
  });
  const [status, setStatus] = useState("");
  const context = useMemo(() => ({
    language,
    setLanguage: (next: LanguageCode) => {
      setLanguageState(next);
      localStorage.setItem(LANGUAGE_KEY, next);
    },
  }), [language]);

  useEffect(() => {
    if (language === "en") {
      setStatus("");
      return;
    }

    const originals = new WeakMap<Text, string>();
    const translated = new WeakMap<Text, string>();
    let disposed = false;
    let scheduled = false;
    let running = false;
    const pending = new Set<Text>();
    const cache = readCache();

    const eligibleTextNodes = (root: Node): Text[] => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const value = node.nodeValue ?? "";
          if (!value.trim()) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent || parent.closest("script, style, noscript, textarea, input, select, option, code, pre, [data-no-translate], [contenteditable='true']")) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest("svg")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      return nodes;
    };

    const queueNode = (node: Text) => {
      if (disposed) return;
      const current = node.nodeValue ?? "";
      const previousTranslation = translated.get(node);
      if (previousTranslation === current) return;
      if (!originals.has(node) || (previousTranslation !== undefined && current !== previousTranslation)) {
        originals.set(node, current);
      }
      pending.add(node);
      schedule();
    };

    const processBatch = async () => {
      if (running || disposed || pending.size === 0) return;
      running = true;
      const nodes = Array.from(pending);
      pending.clear();
      const entries = nodes.map((node) => {
        const original = originals.get(node) ?? node.nodeValue ?? "";
        const leading = original.match(/^\s*/)?.[0] ?? "";
        const trailing = original.match(/\s*$/)?.[0] ?? "";
        const core = original.slice(leading.length, original.length - trailing.length || undefined);
        return { node, original, leading, trailing, core, key: language + ":" + core };
      }).filter((entry) => entry.core.length > 1);

      const missing = Array.from(new Set(entries.filter((entry) => !cache[entry.key]).map((entry) => entry.core)));
      try {
        for (let offset = 0; offset < missing.length; offset += 40) {
          const batch = missing.slice(offset, offset + 40);
          const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: batch, target: language, format: "text" }),
          });
          if (!response.ok) throw new Error("Translation service returned " + response.status);
          const payload = await response.json() as { translations?: Array<{ translatedText?: string }> };
          if (!Array.isArray(payload.translations) || payload.translations.length !== batch.length) {
            throw new Error("Translation service returned an incomplete response");
          }
          payload.translations.forEach((item, index) => {
            cache[language + ":" + batch[index]] = item.translatedText ?? batch[index];
          });
        }
        writeCache(cache);
        for (const entry of entries) {
          if (disposed || !entry.node.isConnected) continue;
          const current = entry.node.nodeValue ?? "";
          if (current !== entry.original) continue;
          const result = cache[entry.key];
          if (!result) continue;
          const next = entry.leading + result + entry.trailing;
          translated.set(entry.node, next);
          entry.node.nodeValue = next;
        }
        setStatus("");
      } catch (error) {
        console.error("Colony Frontier translation failed:", error);
        setStatus("Translation unavailable — check the Google Cloud setup");
      } finally {
        running = false;
        if (pending.size) schedule();
      }
    };

    function schedule() {
      if (scheduled || disposed) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        void processBatch();
      });
    }

    // Restore source text before translating into the newly selected language.
    for (const node of eligibleTextNodes(document.body)) {
      const previousTranslation = translated.get(node);
      if (previousTranslation !== undefined && node.nodeValue === previousTranslation) {
        node.nodeValue = originals.get(node) ?? node.nodeValue;
      }
      translated.delete(node);
      originals.set(node, node.nodeValue ?? "");
      pending.add(node);
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData" && record.target instanceof Text) {
          queueNode(record.target);
        }
        record.addedNodes.forEach((added) => {
          if (added instanceof Text) queueNode(added);
          else eligibleTextNodes(added).forEach(queueNode);
        });
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    schedule();

    return () => {
      disposed = true;
      observer.disconnect();
      // Leave the current language visible during route changes; the next provider
      // effect will restore tracked nodes before applying its own language.
    };
  }, [language]);

  return (
    <TranslationContext.Provider value={context}>
      {children}
      <div className="fixed right-3 top-3 z-[100] flex items-center gap-2 border border-[#496267] bg-[#08171f]/95 px-3 py-2 shadow-lg backdrop-blur">
        <label htmlFor="colony-frontier-language" className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#a9c1b6]">Language</label>
        <select
          id="colony-frontier-language"
          data-no-translate="true"
          value={language}
          onChange={(event) => context.setLanguage(event.target.value as LanguageCode)}
          className="max-w-[145px] bg-[#10252b] text-[11px] text-[#edf4ec] outline-none"
          aria-label="Choose game language"
        >
          {LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}
        </select>
        {status && <span role="status" className="hidden max-w-[180px] text-[9px] text-[#efb658] sm:inline">{status}</span>}
      </div>
    </TranslationContext.Provider>
  );
}

export function useGameLanguage() {
  const value = useContext(TranslationContext);
  if (!value) throw new Error("useGameLanguage must be used inside TranslationProvider");
  return value;
}
