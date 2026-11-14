import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "zh", label: "中文" },
  { code: "ja", label: "日本語" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
] as const;

type LanguageCode = (typeof LANGUAGES)[number]["code"];
type TranslationStatus =
  | "idle"
  | "checking"
  | "downloading"
  | "ready"
  | "unsupported"
  | "error";

type TranslationContextValue = {
  language: LanguageCode;
  supported: boolean;
  status: TranslationStatus;
  progress: number;
  availability: TranslatorAvailability | null;
  setLanguage: (language: LanguageCode) => void;
  translate: (text: string) => Promise<string>;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);

const LANGUAGE_KEY = "colony-frontier-language";
const translationCache = new Map<string, string>();
const pendingTranslations = new Map<string, Promise<string>>();

function getSavedLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return LANGUAGES.some((item) => item.code === saved)
      ? (saved as LanguageCode)
      : "en";
  } catch {
    return "en";
  }
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [supported, setSupported] = useState(
    () => typeof window !== "undefined" && !!window.Translator,
  );
  const [status, setStatus] = useState<TranslationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [availability, setAvailability] =
    useState<TranslatorAvailability | null>(null);

  const translatorRef = useRef<BrowserTranslator | null>(null);
  const requestIdRef = useRef(0);
  const originalsRef = useRef(new WeakMap<Text, string>());
  const translatedRef = useRef(new WeakMap<Text, string>());

  useEffect(() => {
    setSupported(!!window.Translator);
  }, []);

  const translate = useCallback(async (text: string): Promise<string> => {
    const translator = translatorRef.current;
    if (language === "en" || !translator || !text.trim()) return text;

    const key = language + ":" + text;
    const cached = translationCache.get(key);
    if (cached !== undefined) return cached;

    const pending = pendingTranslations.get(key);
    if (pending) return pending;

    const task = translator
      .translate(text)
      .then((result) => {
        translationCache.set(key, result);
        return result;
      })
      .catch((error: unknown) => {
        console.error("Colony Frontier local translation failed:", error);
        setStatus("error");
        return text;
      })
      .finally(() => {
        pendingTranslations.delete(key);
      });

    pendingTranslations.set(key, task);
    return task;
  }, [language]);

  const setLanguage = useCallback((next: LanguageCode) => {
    const requestId = ++requestIdRef.current;

    if (next === "en") {
      translatorRef.current = null;
      setLanguageState("en");
      setStatus("idle");
      setProgress(0);
      setAvailability(null);
      try {
        localStorage.setItem(LANGUAGE_KEY, "en");
      } catch {
        // Language selection still works when storage is unavailable.
      }
      return;
    }

    const api = window.Translator;
    if (!api) {
      setSupported(false);
      setStatus("unsupported");
      return;
    }

    const options = {
      sourceLanguage: "en",
      targetLanguage: next,
    };

    setStatus("checking");
    setProgress(0);
    setAvailability(null);

    // Call create synchronously inside the player's selection event.
    // Do not await availability() first: downloadable models require
    // transient user activation for create().
    let creation: Promise<BrowserTranslator>;
    try {
      creation = api.create({
        ...options,
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            if (requestId !== requestIdRef.current) return;
            setStatus("downloading");
            setProgress(Math.round(event.loaded * 100));
          });
        },
      });
    } catch (error) {
      console.error("Could not start the local translator:", error);
      setStatus("error");
      return;
    }

    // Availability is still checked and exposed to the UI, but it does not
    // delay create() and therefore cannot consume the click's user activation.
    void api.availability(options).then((result) => {
      if (requestId === requestIdRef.current) {
        setAvailability(result);
        if (result === "unavailable") setStatus("unsupported");
      }
    }).catch(() => {
      if (requestId === requestIdRef.current) setAvailability("unavailable");
    });

    void creation.then((translator) => {
      if (requestId !== requestIdRef.current) return;

      translatorRef.current = translator;
      setLanguageState(next);
      setStatus("ready");
      setProgress(100);
      try {
        localStorage.setItem(LANGUAGE_KEY, next);
      } catch {
        // Language selection still works when storage is unavailable.
      }
    }).catch((error: unknown) => {
      if (requestId !== requestIdRef.current) return;
      console.error("Colony Frontier could not load this language:", error);
      setStatus("error");
      setProgress(0);
    });
  }, []);

  useEffect(() => {
    const originals = originalsRef.current;
    const translated = translatedRef.current;
    let disposed = false;
    let scheduled = false;
    let running = false;
    const pendingNodes = new Set<Text>();

    const eligibleTextNodes = (root: Node): Text[] => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const value = node.nodeValue ?? "";
          if (!value.trim()) return NodeFilter.FILTER_REJECT;

          const parent = node.parentElement;
          if (
            !parent ||
            parent.closest(
              "script, style, noscript, textarea, input, select, option, code, pre, [data-no-translate], [contenteditable='true']",
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.closest("svg")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });

      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      return nodes;
    };

    const schedule = () => {
      if (scheduled || disposed) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        void processBatch();
      });
    };

    const queueNode = (node: Text) => {
      if (disposed) return;
      const current = node.nodeValue ?? "";
      if (translated.get(node) === current) return;

      const previousTranslation = translated.get(node);
      if (
        !originals.has(node) ||
        (previousTranslation !== undefined && current !== previousTranslation)
      ) {
        originals.set(node, current);
      }

      pendingNodes.add(node);
      schedule();
    };

    const processBatch = async () => {
      if (running || disposed || pendingNodes.size === 0) return;
      running = true;
      const nodes = Array.from(pendingNodes);
      pendingNodes.clear();

      try {
        for (const node of nodes) {
          if (disposed || !node.isConnected) continue;

          const original = originals.get(node) ?? node.nodeValue ?? "";
          const leading = original.match(/^\s*/)?.[0] ?? "";
          const trailing = original.match(/\s*$/)?.[0] ?? "";
          const core = original.slice(
            leading.length,
            original.length - trailing.length || undefined,
          );

          if (core.length < 2) continue;

          const result = await translate(core);
          if (disposed || !node.isConnected) continue;
          if ((node.nodeValue ?? "") !== original || result === core) continue;

          const next = leading + result + trailing;
          translated.set(node, next);
          node.nodeValue = next;
        }
      } finally {
        running = false;
        if (pendingNodes.size) schedule();
      }
    };

    // Restore original English text before applying a different language.
    for (const node of eligibleTextNodes(document.body)) {
      const previousTranslation = translated.get(node);
      if (previousTranslation !== undefined && node.nodeValue === previousTranslation) {
        node.nodeValue = originals.get(node) ?? node.nodeValue;
      }
      translated.delete(node);
      originals.set(node, node.nodeValue ?? "");
      if (language !== "en") pendingNodes.add(node);
    }

    if (language === "en") return;

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

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    schedule();

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [language, translate]);

  const context = useMemo<TranslationContextValue>(() => ({
    language,
    supported,
    status,
    progress,
    availability,
    setLanguage,
    translate,
  }), [language, supported, status, progress, availability, setLanguage, translate]);

  const statusLabel = {
    idle: "",
    checking: "Preparing local translator…",
    downloading: `Downloading language pack: ${progress}%`,
    ready: "Local translation ready",
    unsupported: "Offline translation unavailable on this browser or device",
    error: "Translation failed — English text will be shown",
  }[status];

  return (
    <TranslationContext.Provider value={context}>
      {children}
      <div
        className="fixed right-3 top-3 z-[100] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 border border-[#496267] bg-[#08171f]/95 px-3 py-2 shadow-lg backdrop-blur"
        data-no-translate="true"
      >
        <label
          htmlFor="colony-frontier-language"
          className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#a9c1b6]"
        >
          Language
        </label>
        <select
          id="colony-frontier-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as LanguageCode)}
          className="max-w-[145px] bg-[#10252b] text-[11px] text-[#edf4ec] outline-none"
          aria-label="Choose game language"
        >
          {LANGUAGES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label}
            </option>
          ))}
        </select>
        {status === "downloading" && (
          <div className="h-1 w-16 overflow-hidden bg-[#29434a]" aria-label={statusLabel}>
            <div
              className="h-full bg-[#efb658] transition-all"
              style={{ width: progress + "%" }}
            />
          </div>
        )}
        {statusLabel && (
          <span
            role="status"
            className="hidden max-w-[210px] text-[9px] text-[#efb658] sm:inline"
            title={availability ? `Language pack: ${availability}` : undefined}
          >
            {statusLabel}
          </span>
        )}
      </div>
    </TranslationContext.Provider>
  );
}

export function useGameLanguage() {
  const value = useContext(TranslationContext);
  if (!value) {
    throw new Error("useGameLanguage must be used inside TranslationProvider");
  }
  return value;
}
