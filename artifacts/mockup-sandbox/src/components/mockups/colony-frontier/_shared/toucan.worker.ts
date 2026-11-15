import { env, pipeline } from "@huggingface/transformers";

type TranslateRequest = {
  type: "translate";
  id: number;
  texts: string[];
  targetLanguage: string;
};

type WorkerRequest = TranslateRequest;

type WorkerResponse =
  | { type: "status"; status: "loading" | "ready"; message?: string }
  | { type: "progress"; progress: number; file?: string }
  | { type: "translated"; id: number; translations: string[] }
  | { type: "error"; id: number; message: string };

type TranslationPipeline = (
  texts: string[],
  options?: Record<string, unknown>,
) => Promise<unknown>;

type WorkerScope = {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse) => void;
};

const workerScope = self as unknown as WorkerScope;
const MODEL_DIRECTORY = "UBC-NLP/toucan-base";
let translator: TranslationPipeline | null = null;
let loadingPromise: Promise<TranslationPipeline> | null = null;
let queue = Promise.resolve();

// Model files are served as static assets by the game host. The browser caches
// them using the Cache API, so no translation server is needed after download.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";
env.useBrowserCache = true;
env.useWasmCache = true;
env.cacheKey = "colony-frontier-toucan-v1";

function reportProgress(event: Record<string, unknown>): void {
  const progress = typeof event.progress === "number"
    ? event.progress
    : typeof event.loaded === "number" && typeof event.total === "number" && event.total > 0
      ? (event.loaded / event.total) * 100
      : 0;

  workerScope.postMessage({
    type: "progress",
    progress: Math.max(0, Math.min(100, progress)),
    file: typeof event.file === "string" ? event.file : undefined,
  });
}

async function createPipeline(device: "webgpu" | "wasm"): Promise<TranslationPipeline> {
  const create = pipeline as unknown as (
    task: string,
    model: string,
    options: Record<string, unknown>,
  ) => Promise<TranslationPipeline>;

  return create("translation", MODEL_DIRECTORY, {
    device,
    dtype: device === "webgpu" ? "fp16" : "q8",
    progress_callback: reportProgress,
  });
}

async function getTranslator(): Promise<TranslationPipeline> {
  if (translator) return translator;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    workerScope.postMessage({ type: "status", status: "loading" });

    let loaded: TranslationPipeline;
    if (env.apis.IS_WEBGPU_AVAILABLE) {
      try {
        loaded = await createPipeline("webgpu");
      } catch (webgpuError) {
        console.warn("Toucan WebGPU initialisation failed; trying WebAssembly.", webgpuError);
        loaded = await createPipeline("wasm");
      }
    } else {
      loaded = await createPipeline("wasm");
    }

    translator = loaded;
    workerScope.postMessage({ type: "status", status: "ready" });
    return loaded;
  })();

  try {
    return await loadingPromise;
  } catch (error) {
    loadingPromise = null;
    const detail = error instanceof Error ? error.message : "Unknown model loading error.";
    throw new Error(
      `Toucan's browser model could not be loaded. Run pnpm export:toucan and make sure public/models/UBC-NLP/toucan-base is deployed. ${detail}`,
    );
  }
}

async function translate(request: TranslateRequest): Promise<void> {
  try {
    const model = await getTranslator();
    const prompts = request.texts.map((text) => `${request.targetLanguage}: ${text}`);
    const output = await model(prompts, {
      max_new_tokens: 128,
      num_beams: 2,
      do_sample: false,
    });

    const rows = Array.isArray(output) ? output : [output];
    const translations = rows.map((row) => {
      if (typeof row === "string") return row;
      if (row && typeof row === "object") {
        const result = row as Record<string, unknown>;
        const value = result.translation_text ?? result.generated_text ?? result.text;
        return typeof value === "string" ? value : "";
      }
      return "";
    });

    if (translations.length !== request.texts.length || translations.some((text) => !text)) {
      throw new Error("Toucan returned an incomplete translation batch.");
    }

    workerScope.postMessage({ type: "translated", id: request.id, translations });
  } catch (error) {
    workerScope.postMessage({
      type: "error",
      id: request.id,
      message: error instanceof Error ? error.message : "Toucan could not translate this text.",
    });
  }
}

workerScope.onmessage = (event) => {
  const request = event.data;
  if (request.type !== "translate") return;

  // Keep generation sequential to avoid overlapping large model allocations.
  queue = queue.then(() => translate(request));
};
