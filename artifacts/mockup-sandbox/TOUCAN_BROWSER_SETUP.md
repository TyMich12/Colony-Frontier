# Toucan in the browser

The game no longer calls a local Python/FastAPI translation service. It uses:

- Chrome's built-in Translator API first, when the selected language pair is available.
- Transformers.js + ONNX Runtime Web for Toucan when Chrome cannot translate the selected language.
- A Web Worker so model loading and translation do not block the React UI.
- WebGPU with fp16 when available, then WebAssembly with q8 as the compatibility fallback.
- The browser Cache API to reuse downloaded model files on later visits.

## One-time model preparation

Toucan's published checkpoint is a PyTorch/mT5 model, not a browser-ready ONNX package. The ONNX files therefore need to be exported once before the browser can use Toucan.

On the development machine:

```bash
pnpm install
pnpm export:toucan
```

The export script uses Python temporarily to convert the original checkpoint. This is a build-time preparation step only: **players do not install Python, and no Python server runs while the game is playing**. The script creates the model files under:

```text
public/models/UBC-NLP/toucan-base/
```

It creates fp16 and q8 model variants. The browser worker selects fp16/WebGPU first and falls back to q8/WASM.

## Hosting and offline use

The generated directory must be deployed as static files at the same origin as the game, preserving the directory structure. On first use, the browser downloads the required ONNX weights and tokenizer/configuration files. Transformers.js caches downloaded files using the browser Cache API; later sessions can reuse the cache, although browser storage may be cleared or evicted.

The initial model download requires an internet connection. Offline translation is available only after the required model files have been downloaded and retained by the browser.

## Important status

This is the browser-runtime integration and model-export path. The Toucan ONNX export still needs to be generated and tested against real translations before this can be called a fully working browser deployment. The original Toucan model card documents the mT5-based checkpoint and its target-language prefix format; verify each target language and English-to-target direction with fluent speakers before release.
