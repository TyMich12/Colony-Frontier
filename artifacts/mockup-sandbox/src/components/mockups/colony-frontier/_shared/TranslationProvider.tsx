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

type LanguageOption = { code: string; name: string };
type TranslationStatus =
  | "idle"
  | "loading-languages"
  | "ready"
  | "not-configured"
  | "error";

type TranslationContextValue = {
  language: string;
  supported: boolean;
  status: TranslationStatus;
  progress: number;
  availability: null;
  setLanguage: (language: string) => void;
  translate: (text: string) => Promise<string>;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);

const LANGUAGE_KEY = "colony-frontier-language";
const API_URL = (import.meta.env.VITE_TRANSLATION_API_URL ?? "").trim().replace(/\/+$/, "");
const FALLBACK_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "ja", name: "Japanese" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
];

const translationCache = new Map<string, string>();
const pendingTranslations = new Map<string, Promise<string>>();

function getSavedLanguage(): string {
  try {
    return localStorage.getItem(LANGUAGE_KEY) || "en";
  } catch {
    return "en";
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || `Translation service returned ${response.status}.`;
  } catch {
    return `Translation service returned ${response.status}.`;
  }
}

async function requestTranslations(
  texts: string[],
  target: string,
): Promise<string[]> {
  if (!API_URL) throw new Error("Google Cloud Translation is not configured.");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: texts,
      source: "en",
      target,
      format: "text",
    }),
  });

  if (!response.ok) throw new Error(await readError(response));

  const result = (await response.json()) as {
    translations?: Array<{ translatedText?: string }>;
  };
  return (result.translations ?? []).map((item) => item.translatedText ?? "");
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>(getSavedLanguage);
  const [languages, setLanguages] = useState<LanguageOption[]>(FALLBACK_LANGUAGES);
  const [status, setStatus] = useState<TranslationStatus>(
    API_URL ? "loading-languages" : "not-configured",
  );
  const [search, setSearch] = useState("");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!API_URL) return;

    let active = true;
    void fetch(`${API_URL}/languages?target=en`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        return (await response.json()) as {
          languages?: Array<{ code?: string; language?: string; name?: string }>;
        };
      })
      .then((result) => {
        if (!active) return;
        const received = (result.languages ?? [])
          .filter((item) => (item.code || item.language) && item.name)
          .map((item) => ({
            code: (item.code || item.language)!,
            name: item.name!,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        if (!received.some((item) => item.code === "en")) {
          received.unshift({ code: "en", name: "English" });
        }
        if (received.length) setLanguages(received);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("Colony Frontier could not load Google's language list:", error);
        if (active) setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!languageMenuOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [languageMenuOpen]);

  const translate = useCallback(async (text: string): Promise<string> => {
    if (language === "en" || !text.trim() || !API_URL) return text;

    const key = `${language}:${text}`;
    const cached = translationCache.get(key);
    if (cached !== undefined) return cached;

    const pending = pendingTranslations.get(key);
    if (pending) return pending;

    const task = requestTranslations([text], language)
      .then((results) => {
        const translated = results[0] || text;
        translationCache.set(key, translated);
        return translated;
      })
      .catch((error: unknown) => {
        console.error("Colony Frontier translation failed:", error);
        setStatus("error");
        return text;
      })
      .finally(() => {
        pendingTranslations.delete(key);
      });

    pendingTranslations.set(key, task);
    return task;
  }, [language]);

  const chooseLanguage = (next: string) => {
    setLanguageState(next);
    setSearch("");
    setLanguageMenuOpen(false);
    translationCache.clear();

    try {
      localStorage.setItem(LANGUAGE_KEY, next);
    } catch {
      // The language still works for this session if storage is unavailable.
    }

    setStatus(API_URL ? "ready" : "not-configured");
  };

  useEffect(() => {
    const originals = new WeakMap<Text, string>();
    const translated = new WeakMap<Text, string>();
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
        // Google Cloud Translation accepts multiple q values in one request.
        for (let start = 0; start < nodes.length; start += 40) {
          const batch = nodes.slice(start, start + 40);
          const items = batch.map((node) => {
            const original = originals.get(node) ?? node.nodeValue ?? "";
            const leading = original.match(/^\s*/)?.[0] ?? "";
            const trailing = original.match(/\s*$/)?.[0] ?? "";
            const core = original.slice(
              leading.length,
              original.length - trailing.length || undefined,
            );
            return { node, original, leading, trailing, core };
          });

          const translatable = items.filter((item) => item.core.length >= 2);
          const uncached = translatable.filter(
            (item) => !translationCache.has(`${language}:${item.core}`),
          );
          const uniqueTexts = [...new Set(uncached.map((item) => item.core))];

          if (uniqueTexts.length) {
            try {
              const results = await requestTranslations(uniqueTexts, language);
              uniqueTexts.forEach((text, index) => {
                const value = results[index];
                if (value) translationCache.set(`${language}:${text}`, value);
              });
            } catch (error) {
              console.error("Colony Frontier batch translation failed:", error);
              setStatus("error");
            }
          }

          for (const item of translatable) {
            if (disposed || !item.node.isConnected) continue;
            if ((item.node.nodeValue ?? "") !== item.original) continue;

            const result = translationCache.get(`${language}:${item.core}`);
            if (result === undefined) continue;

            const next = item.leading + result + item.trailing;
            translated.set(item.node, next);
            item.node.nodeValue = next;
          }
        }
      } finally {
        running = false;
        if (pendingNodes.size) schedule();
      }
    };

    // Restore the original English before applying the newly selected language.
    for (const node of eligibleTextNodes(document.body)) {
      const previousTranslation = translated.get(node);
      if (previousTranslation !== undefined && node.nodeValue === previousTranslation) {
        node.nodeValue = originals.get(node) ?? node.nodeValue;
      }
      translated.delete(node);
      originals.set(node, node.nodeValue ?? "");
      if (language !== "en" && API_URL) pendingNodes.add(node);
    }

    if (language === "en" || !API_URL) return;

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
  }, [language]);

  const filteredLanguages = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return languages;
    return languages.filter(
      (item) =>
        item.name.toLocaleLowerCase().includes(query) ||
        item.code.toLocaleLowerCase().includes(query),
    );
  }, [languages, search]);

  const selectedLanguage = languages.find((item) => item.code === language);
  const statusLabel = {
    idle: "",
    "loading-languages": "Loading Google language list…",
    ready: "",
    "not-configured": "Configure the Google Cloud Worker to enable translation",
    error: "Translation service unavailable — original text is shown",
  }[status];

  const context = useMemo<TranslationContextValue>(() => ({
    language,
    supported: Boolean(API_URL),
    status,
    progress: 0,
    availability: null,
    setLanguage: chooseLanguage,
    translate,
  }), [language, status, translate]);

  return (
    <TranslationContext.Provider value={context}>
      {children}
      <div
        className="fixed right-3 top-3 z-[100] flex max-w-[calc(100vw-1.5rem)] items-center gap-2 border border-[#496267] bg-[#08171f]/95 px-3 py-2 shadow-lg backdrop-blur"
        data-no-translate="true"
      >
        <label
          htmlFor="colony-frontier-language-search"
          className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#a9c1b6]"
        >
          Language
        </label>
        <div className="relative" ref={menuRef}>
          <input
            id="colony-frontier-language-search"
            type="text"
            role="combobox"
            aria-label="Search game languages"
            aria-expanded={languageMenuOpen}
            aria-controls="colony-frontier-language-options"
            aria-autocomplete="list"
            autoComplete="off"
            value={languageMenuOpen ? search : (selectedLanguage?.name ?? language)}
            onFocus={() => {
              setLanguageMenuOpen(true);
              setSearch("");
            }}
            onChange={(event) => {
              setSearch(event.target.value);
              setLanguageMenuOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setLanguageMenuOpen(false);
                setSearch("");
              }
              if (event.key === "Enter" && filteredLanguages[0]) {
                chooseLanguage(filteredLanguages[0].code);
              }
            }}
            className="w-[150px] border border-[#496267] bg-[#10252b] px-2 py-1 text-[11px] text-[#edf4ec] outline-none focus:border-[#efb658]"
            placeholder="Search languages…"
          />
          {languageMenuOpen && (
            <div
              id="colony-frontier-language-options"
              role="listbox"
              className="absolute right-0 top-full mt-1 max-h-64 w-[220px] overflow-y-auto border border-[#496267] bg-[#08171f] py-1 shadow-xl"
            >
              {filteredLanguages.length ? filteredLanguages.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  role="option"
                  aria-selected={item.code === language}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseLanguage(item.code)}
                  className={`block w-full px-3 py-2 text-left text-[11px] ${
                    item.code === language
                      ? "bg-[#203a3f] text-[#efb658]"
                      : "text-[#edf4ec] hover:bg-[#173039]"
                  }`}
                >
                  <span>{item.name}</span>
                  <span className="float-right text-[#8da69e]">{item.code}</span>
                </button>
              )) : (
                <div className="px-3 py-2 text-[11px] text-[#9eb0aa]">
                  No matching languages
                </div>
              )}
            </div>
          )}
        </div>
        {statusLabel && (
          <span
            role="status"
            className="hidden max-w-[210px] text-[9px] text-[#efb658] sm:inline"
            title={statusLabel}
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
