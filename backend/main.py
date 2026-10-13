"""Cat Meow Translator backend — FastAPI, in-memory only, zero-disk storage."""

from __future__ import annotations

import io
import json
from pathlib import Path

import librosa
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
    TRANSLATIONS: dict[str, dict[str, str]] = json.load(f)

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


def classify_intent(y: np.ndarray, sr: int) -> str:
    """Lightweight heuristic classifier (RMS / ZCR / centroid / duration).

    Replace with a trained sklearn/PyTorch model later; keep signature.
    """
    if y.size == 0:
        return "sleep"
    duration = y.shape[0] / float(sr or 22050)
    rms = float(np.mean(librosa.feature.rms(y=y)))
    zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
    centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))

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
        translation = TRANSLATIONS.get(intent, {}).get(target_lang) or TRANSLATIONS[intent]["en"]
        return {"intent": intent, "lang": target_lang, "translation": translation}
    finally:
        # GDPR: drop the buffer immediately.
        del data
