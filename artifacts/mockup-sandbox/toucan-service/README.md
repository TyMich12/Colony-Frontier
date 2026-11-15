# Local Toucan service for Colony Frontier

This is a **local development/test bridge** between the React game and the official `UBC-NLP/toucan-base` model. It is not a public translation server and it is not yet a browser-only/WASM deployment.

## Mac test setup

1. Install Python 3.11 or newer.
2. Open `toucan-service` in Finder and run `start-mac.command`, or use the terminal commands below.
3. The first run installs Python packages and downloads the Toucan model from Hugging Face. The model repository is about **2.35 GB**; it is not included in this ZIP.
4. Leave the terminal window running while testing the game.
5. In another terminal, start the Vite game with `npm run dev`.
6. Open the game at `http://localhost:5173` and select an African language such as Swahili, Hausa, Yoruba or Zulu.

Manual setup:

```bash
cd toucan-service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8765
```

The service automatically chooses Apple Metal (MPS) when PyTorch reports it is available, otherwise CUDA or CPU. It starts with float32 for compatibility; performance and memory use should be measured on the test Mac before considering lower precision.

## Endpoints

- `GET /health` — readiness and selected device.
- `GET /languages` — supported ISO-639-3 language codes.
- `POST /translate` — `{ "texts": ["..."], "target_language": "swa" }`.

Only local Vite origins are allowed by CORS. The server binds to `127.0.0.1` and should not be exposed to the public internet.

## Important limitations

- The current game integration tries Chrome's built-in Translator API first for a small number of matching languages, then uses this local Toucan service when Chrome cannot translate that language.
- Toucan's published model card describes 46 languages and 156 translation directions. Do not assume every possible pair among those languages is supported; this prototype uses English as the source and needs language-by-language testing.
- The model is about 2.35 GB on disk. This local Python service is for the MacBook prototype. It is not a finished way to distribute Toucan to every player or run it fully inside a browser.
- The model repository does not clearly expose a license field in the model card. Review the upstream repository's current terms before redistributing weights or using it in a public/commercial release.
- Translation quality must be reviewed by fluent speakers, especially for mission instructions, warnings and player choices.

Model: https://huggingface.co/UBC-NLP/toucan-base
Research: https://aclanthology.org/2024.findings-acl.781/
