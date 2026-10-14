"""Cat Meow Translator backend — FastAPI, in-memory only, zero-disk storage."""

from __future__ import annotations

import io
import json
import random
from pathlib import Path

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

SUPPORTED_LANGS = ("en", "fr", "es", "de", "it")
SUPPORTED_INTENTS = ("hunger", "attention", "rage", "philosophy", "sleep")
MAX_BYTES = 5 * 1024 * 1024  # 5 MB in-RAM cap
MAX_SECONDS = 5.0

_translations_path = Path(__file__).with_name("translations.json")
with _translations_path.open(encoding="utf-8") as f:
    TRANSLATIONS: dict[str, dict[str, list[str] | str]] = json.load(f)

app = FastAPI(title="traductmiaul — Cat Meow Translator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _normalize_lang(lang: str) -> str:
    lang = (lang or "en").lower().split("-")[0].split("_")[0]
    return lang if lang in SUPPORTED_LANGS else "en"


_last_translation: dict[tuple[str, str], str] = {}


def _pick_variant(intent: str, lang: str, options: list[str] | str) -> str:
    """Random variant, never serving the same text twice in a row per intent+lang."""
    if not isinstance(options, list) or not options:
        return options if isinstance(options, str) else ""
    if len(options) == 1:
        choice = options[0]
    else:
        last = _last_translation.get((intent, lang))
        pool = [o for o in options if o != last] if last else options
        choice = random.choice(pool or options)
    _last_translation[(intent, lang)] = choice
    return choice


def _rms(y: np.ndarray) -> float:
    return float(np.sqrt(np.mean(y.astype(np.float64) ** 2))) if y.size else 0.0


def _zcr(y: np.ndarray) -> float:
    return float(np.mean(y[:-1] * y[1:] < 0)) if y.size >= 2 else 0.0


def _spectral_centroid(y: np.ndarray, sr: int) -> float:
    if y.size < 2:
        return 0.0
    mag = np.abs(np.fft.rfft(y.astype(np.float64)))
    total = mag.sum()
    if total <= 0:
        return 0.0
    return float(np.sum(np.fft.rfftfreq(y.shape[0], d=1.0 / sr) * mag) / total)


def classify_intent(y: np.ndarray, sr: int) -> str:
    """Lightweight heuristic classifier (RMS / ZCR / centroid / duration).

    Pure numpy (no librosa): same quantities, verified parity on test signals.
    Replace with a trained sklearn/PyTorch model later; keep signature.
    """
    if y.size == 0:
        return "sleep"
    duration = y.shape[0] / float(sr or 22050)
    rms = _rms(y)
    zcr = _zcr(y)
    centroid = _spectral_centroid(y, sr)

    # Loud + harsh + short -> rage; loud + mid -> hunger; quiet + long -> sleep
    if rms > 0.25 and zcr > 0.15:
        return "rage"
    if rms > 0.18 and centroid > 2500:
        return "hunger"
    if duration > 2.5 and rms < 0.08:
        return "sleep"
    if centroid > 3500 or zcr > 0.12:
        return "attention"
    return "philosophy"


@app.post("/api/translate")
async def translate(file: UploadFile = File(...), lang: str = Form("en")) -> dict[str, str]:
    target_lang = _normalize_lang(lang)

    data = await file.read()
    try:
        if not data:
            raise HTTPException(status_code=400, detail="Empty audio file")
        if len(data) > MAX_BYTES:
            raise HTTPException(status_code=413, detail="Audio file too large (5 MB max)")

        # Strictly in-memory decode — never touch disk.
        try:
            y, sr = sf.read(io.BytesIO(data), dtype="float32", always_2d=False)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Undecodable audio: {exc}") from exc
        if isinstance(y, np.ndarray) and y.ndim > 1:
            y = np.mean(y, axis=-1)
        # Clip to first MAX_SECONDS to enforce 5 s contract.
        max_samples = int((sr or 22050) * MAX_SECONDS)
        y = np.asarray(y, dtype=np.float32)[:max_samples]

        intent = classify_intent(y, int(sr or 22050))
        if intent not in SUPPORTED_INTENTS:
            intent = "philosophy"
        translation = _pick_variant(intent, target_lang, TRANSLATIONS.get(intent, {}).get(target_lang) or TRANSLATIONS[intent]["en"])
        return {"intent": intent, "lang": target_lang, "translation": translation}
    finally:
        # GDPR: drop the buffer immediately.
        del data
