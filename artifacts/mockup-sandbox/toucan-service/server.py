from __future__ import annotations

import os
import threading
from typing import List

import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, MT5ForConditionalGeneration

MODEL_ID = os.getenv("TOUCAN_MODEL_ID", "UBC-NLP/toucan-base")
MODEL_DEVICE = os.getenv("TOUCAN_DEVICE", "auto").lower()
MAX_INPUT_CHARS = int(os.getenv("TOUCAN_MAX_INPUT_CHARS", "3000"))
MAX_BATCH_SIZE = int(os.getenv("TOUCAN_MAX_BATCH_SIZE", "4"))

LANGUAGES = {
    "aar", "ach", "afr", "aka", "amh", "bam", "bas", "bem", "btg", "eng",
    "ewe", "fon", "fra", "hau", "ibo", "kbp", "lgg", "lug", "mlg", "nyn",
    "orm", "som", "sot", "swa", "tir", "yor", "teo", "gez", "wal", "fan",
    "kau", "kin", "kon", "lin", "nya", "pcm", "ssw", "tsn", "tso", "twi",
    "wol", "xho", "zul", "nnb", "swc", "ara",
}

app = FastAPI(title="Colony Frontier Toucan Translation", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


def choose_device() -> torch.device:
    if MODEL_DEVICE != "auto":
        return torch.device(MODEL_DEVICE)
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


DEVICE = choose_device()
_tokenizer = None
_model = None
_model_loading = False
_model_error: str | None = None
_model_lock = threading.Lock()
_inference_lock = threading.Lock()


def load_model() -> None:
    global _tokenizer, _model, _model_loading, _model_error
    with _model_lock:
        if _model is not None or _model_loading:
            return
        _model_loading = True

    try:
        print(f"Loading {MODEL_ID} on {DEVICE}. The first run downloads about 2.35 GB of model files.", flush=True)
        tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
        model = MT5ForConditionalGeneration.from_pretrained(
            MODEL_ID,
            torch_dtype=torch.float32,
            low_cpu_mem_usage=True,
        )
        model.to(DEVICE)
        model.eval()
        _tokenizer = tokenizer
        _model = model
        print("Toucan model is ready.", flush=True)
    except Exception as exc:
        _model_error = str(exc)
        print(f"Could not load Toucan: {exc!r}", flush=True)
    finally:
        _model_loading = False


class TranslationRequest(BaseModel):
    texts: List[str] = Field(min_length=1, max_length=32)
    target_language: str = Field(min_length=3, max_length=3)


@app.on_event("startup")
def startup() -> None:
    threading.Thread(target=load_model, daemon=True).start()


@app.get("/health")
def health():
    return {
        "ready": _model is not None,
        "loading": _model_loading,
        "error": _model_error,
        "model": MODEL_ID,
        "device": str(DEVICE),
    }


@app.get("/languages")
def languages():
    return {"languages": sorted(LANGUAGES)}


@app.post("/translate")
def translate(request: TranslationRequest):
    target = request.target_language.lower()
    if target not in LANGUAGES or target == "eng":
        raise HTTPException(status_code=400, detail="Unsupported Toucan target language.")
    if _model is None or _tokenizer is None:
        raise HTTPException(status_code=503, detail="Toucan model is still loading.")
    if any(not isinstance(text, str) or len(text) > MAX_INPUT_CHARS for text in request.texts):
        raise HTTPException(status_code=413, detail="A text item is too long to translate.")

    translations: list[str] = []
    try:
        # Serialize generation to avoid overlapping large MPS allocations.
        with _inference_lock:
            for start in range(0, len(request.texts), MAX_BATCH_SIZE):
                batch = request.texts[start : start + MAX_BATCH_SIZE]
                prompts = [f"{target}: {text}" for text in batch]
                inputs = _tokenizer(
                    prompts,
                    return_tensors="pt",
                    padding=True,
                    truncation=True,
                    max_length=512,
                )
                inputs = {key: value.to(DEVICE) for key, value in inputs.items()}
                with torch.inference_mode():
                    generated = _model.generate(
                        **inputs,
                        num_beams=2,
                        do_sample=False,
                        max_new_tokens=128,
                    )
                translations.extend(
                    _tokenizer.batch_decode(generated, skip_special_tokens=True)
                )
        return {"translations": translations}
    except Exception as exc:  # Keep backend details in the local server log.
        print(f"Toucan inference error: {exc!r}", flush=True)
        raise HTTPException(status_code=500, detail="Toucan could not translate this text.") from exc
