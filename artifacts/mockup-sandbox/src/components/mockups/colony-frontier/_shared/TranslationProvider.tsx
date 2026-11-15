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
type TranslationStatus = "idle" | "ready" | "loading-model" | "unavailable" | "error";

type TranslationContextValue = {
  language: string;
  supported: boolean;
  status: TranslationStatus;
  progress: number;
  availability: string | null;
  setLanguage: (language: string) => void;
  translate: (text: string) => Promise<string>;
};

const TranslationContext = createContext<TranslationContextValue | null>(null);

const LANGUAGE_KEY = "colony-frontier-language";

// Chrome Translator API uses BCP-47 language codes.
const LANGUAGES: Array<LanguageOption & { browserCode?: string }> = [
  { code: "aar", name: "Afar" },
  { code: "ach", name: "Acholi" },
  { code: "afr", name: "Afrikaans", browserCode: "af" },
  { code: "aka", name: "Akan" },
  { code: "amh", name: "Amharic", browserCode: "am" },
  { code: "bam", name: "Bambara" },
  { code: "bas", name: "Basaa" },
  { code: "bem", name: "Bemba" },
  { code: "btg", name: "Bete Gagnoa" },
  { code: "eng", name: "English", browserCode: "en" },
  { code: "ewe", name: "Ewe" },
  { code: "fon", name: "Fon" },
  { code: "fra", name: "French", browserCode: "fr" },
  { code: "hau", name: "Hausa" },
  { code: "ibo", name: "Igbo" },
  { code: "kbp", name: "Kabiye" },
  { code: "lgg", name: "Lugbara" },
  { code: "lug", name: "Luganda" },
  { code: "mlg", name: "Malagasy" },
  { code: "nyn", name: "Nyankole" },
  { code: "orm", name: "Oromo" },
  { code: "som", name: "Somali" },
  { code: "sot", name: "Sesotho", browserCode: "st" },
  { code: "swa", name: "Swahili", browserCode: "sw" },
  { code: "tir", name: "Tigrinya" },
  { code: "yor", name: "Yoruba" },
  { code: "teo", name: "Ateso" },
  { code: "gez", name: "Geez" },
  { code: "wal", name: "Wolaytta" },
  { code: "fan", name: "Fang" },
  { code: "kau", name: "Kanuri" },
  { code: "kin", name: "Kinyarwanda" },
  { code: "kon", name: "Kongo" },
  { code: "lin", name: "Lingala" },
  { code: "nya", name: "Chichewa" },
  { code: "pcm", name: "Nigerian Pidgin" },
  { code: "ssw", name: "Siswati" },
  { code: "tsn", name: "Setswana" },
  { code: "tso", name: "Tsonga" },
  { code: "twi", name: "Twi" },
  { code: "wol", name: "Wolof" },
  { code: "xho", name: "Xhosa" },
  { code: "zul", name: "Zulu" },
  { code: "nnb", name: "Nande" },
  { code: "swc", name: "Congo Swahili" },
  { code: "ara", name: "Arabic", browserCode: "ar" },
];

const SUPPORTED_LANGUAGES: LanguageOption[] = LANGUAGES.filter((item) => Boolean(item.browserCode));
const translationCache = new Map<string, string>();
const pendingTranslations = new Map<string, Promise<string>>();
const browserTranslators = new Map<string, Promise<BrowserTranslator | null>>();

function getSavedLanguage(): string {
  try {
    return localStorage.getItem(LANGUAGE_KEY) || "en";
  } catch {
    return "en";
  }
}

async function getBrowserTranslator(language: string): Promise<BrowserTranslator | null> {
  const option = LANGUAGES.find((item) => item.code === language);
  if (!option?.browserCode || !window.Translator) return null;

  const cached = browserTranslators.get(language);
  if (cached) return cached;

  const task = (async () => {
    const options = { sourceLanguage: "en", targetLanguage: option.browserCode! };
    const availability = await window.Translator!.availability(options);
    if (availability === "unavailable") return null;

    return window.Translator!.create({
      ...options,
      monitor: (monitor) => {
        monitor.addEventListener("downloadprogress", (event) => {
          window.dispatchEvent(new CustomEvent("colony-translation-progress", {
            detail: Math.round(event.loaded * 100),
          }));
        });
      },
    });
  })();

  browserTranslators.set(language, task);
  try {
    return await task;
  } catch (error) {
    browserTranslators.delete(language);
    console.warn("Chrome Translator API unavailable for this language.", error);
    return null;
  }
}

async function requestTranslations(texts: string[], target: string): Promise<string[]> {
  const translator = await getBrowserTranslator(target);
  if (!translator) {
    const language = LANGUAGES.find((item) => item.code === target)?.name ?? target;
    throw new Error(`Chrome's built-in Translator API is unavailable for ${language}.`);
  }

  return Promise.all(texts.map((text) => translator.translate(text)));
}

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>(() => {
    const saved = getSavedLanguage();
    if (saved === "en" || saved === "eng") return "eng";
    return SUPPORTED_LANGUAGES.some((item) => item.code === saved) ? saved : "eng";
  });
  const languages = SUPPORTED_LANGUAGES;
  const [status, setStatus] = useState<TranslationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [languagePanelOpen, setLanguagePanelOpen] = useState(true);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const updateProgress = (event: Event) => {
      const custom = event as CustomEvent<number>;
      setProgress(Number.isFinite(custom.detail) ? custom.detail : 0);
    };
    window.addEventListener("colony-translation-progress", updateProgress);

    const updateStatus = (event: Event) => {
      const custom = event as CustomEvent<TranslationStatus>;
      if (active) setStatus(custom.detail);
    };
    window.addEventListener("colony-translation-status", updateStatus);

    return () => {
      active = false;
      window.removeEventListener("colony-translation-progress", updateProgress);
      window.removeEventListener("colony-translation-status", updateStatus);
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
    if (language === "eng" || !text.trim()) return text;

    const key = `${language}:${text}`;
    const cached = translationCache.get(key);
    if (cached !== undefined) return cached;

    const pending = pendingTranslations.get(key);
    if (pending) return pending;

    const task = (async () => {
      try {
        const [result] = await requestTranslations([text], language);
        translationCache.set(key, result || text);
        setStatus("ready");
        return result || text;
      } catch (error) {
        console.error("Colony Frontier translation failed:", error);
        setStatus("error");
        return text;
      }
    })()
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

    setProgress(0);
    setStatus("idle");
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
        // Translate visible text in batches to reduce per-request overhead.
        for (let start = 0; start < nodes.length; start += 32) {
          const batch = nodes.slice(start, start + 32);
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
              setStatus("ready");
            } catch (error) {
              console.error("Colony Frontier translation batch failed:", error);
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
      if (language !== "eng") pendingNodes.add(node);
    }

    if (language === "eng") return;

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
    ready: "",
    "loading-model": "Preparing Chrome translation…",
    unavailable: "Chrome Translator API is unavailable for this language",
    error: "Chrome translation failed",
  }[status];

  const context = useMemo<TranslationContextValue>(() => ({
    language,
    supported: status === "ready" || status === "loading-model",
    status,
    progress,
    availability: null,
    setLanguage: chooseLanguage,
    translate,
  }), [language, status, progress, translate]);

  return (
    <TranslationContext.Provider value={context}>
      {children}
      <div
        className="fixed right-3 top-3 z-[100] max-w-[calc(100vw-1.5rem)] border border-[#496267] bg-[#08171f]/95 shadow-lg backdrop-blur"
        data-no-translate="true"
      >
        <button
          type="button"
          aria-expanded={languagePanelOpen}
          aria-controls="colony-frontier-language-panel"
          onClick={() => {
            setLanguagePanelOpen((open) => !open);
            setLanguageMenuOpen(false);
            setSearch("");
          }}
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a9c1b6] hover:bg-[#173039]"
        >
          <span>Language: {selectedLanguage?.name ?? language}</span>
          <span aria-hidden="true">{languagePanelOpen ? "−" : "+"}</span>
        </button>
        {languagePanelOpen && (
          <div id="colony-frontier-language-panel" className="flex items-center gap-2 border-t border-[#496267] px-3 py-2">
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
        {status === "loading-model" && progress > 0 && (
          <span className="text-[9px] text-[#a9c1b6]">{progress}%</span>
        )}
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
