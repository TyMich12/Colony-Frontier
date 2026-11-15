type TranslatorAvailability = "available" | "downloadable" | "downloading" | "unavailable";

interface TranslatorProgressEvent extends Event {
  loaded: number;
}

interface TranslatorMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: TranslatorProgressEvent) => void,
  ): void;
}

interface TranslatorOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?: (monitor: TranslatorMonitor) => void;
}

interface BrowserTranslator {
  translate(text: string): Promise<string>;
}

interface TranslatorAPI {
  availability(options: TranslatorOptions): Promise<TranslatorAvailability>;
  create(options: TranslatorOptions): Promise<BrowserTranslator>;
}

interface Window {
  Translator?: TranslatorAPI;
}
