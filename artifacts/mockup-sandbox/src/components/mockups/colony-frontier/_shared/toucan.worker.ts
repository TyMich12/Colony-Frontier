
// Model files are served as static assets by the game host. Transformers.js
// uses the browser cache so downloaded files can be reused on later visits.
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";
env.useBrowserCache = true;

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

    // Try WebGPU first. If the browser or device cannot initialise it,
    // fall back to WebAssembly without relying on version-specific env flags.
    let loaded: TranslationPipeline;
    try {
      loaded = await createPipeline("webgpu");
    } catch (webgpuError) {
      console.warn(
        "Toucan WebGPU initialisation failed; trying WebAssembly.",
        webgpuError,
      );
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
