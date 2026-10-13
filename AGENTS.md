# AGENTS.md — traductmiaul (Cat Meow Translator TG Mini App)

> Scaffolded repo: `backend/`, `frontend/`, `bot.py` exist and boot (verified 2026-09-27). `instructions.md` remains the spec.

## Structure
- `backend/main.py` — FastAPI app, `POST /api/translate`; `backend/translations.json` — 5 intents × 5 langs humor dict
- `backend/requirements.txt`
- `frontend/app/` — Next.js + Tailwind + Lucide + `@twa-dev/sdk` + lightweight i18n
- `frontend/package.json`
- `bot.py` (repo root) — lightweight `python-telegram-bot`, `/start` + Web App menu button

## Hard constraints (agent would otherwise miss)
- Default language is **English (`en`)** everywhere; supported langs: `en | fr | es | de | it`.
- Detect user lang via Telegram `initDataUnsafe.user.language_code`, fall back to `en`.
- Record max **5 seconds** via `MediaRecorder` / Web Audio API; frontend states: Recording → Analyzing → Translated.
- API contract: `POST /api/translate` with `file: UploadFile` + `lang: str = "en"` → `{ "intent": "hunger", "lang": "en", "translation": "..." }`.
- Backend must process audio **strictly in memory, zero-disk storage** (delete buffer immediately, GDPR).
- Audio features: `librosa`/`soundfile` (RMS/MFCC) → lightweight classifier (`sklearn` or PyTorch); intents e.g. Hunger, Attention, Rage, Philosophy, Sleep.
- Localized humor-translation dict/JSON for all 5 langs on backend; localize all static frontend UI text too.
- Frontend must call `window.Telegram.WebApp.ready()` on init; include language selector (EN default), pulsing record button, waveform/status animation, translation card with copy/share.
- Deploy split: frontend Vercel, backend VPS/Render/Railway; HTTPS + REST only.

## Workflow
- Backend: `pip install -r backend/requirements.txt`, run `python -m uvicorn main:app --reload` from `backend/`; `GET /health` smoke-tests boot.
- Frontend: `npm install && npm run build` from `frontend/` (verified with Next 14); dev via `npm run dev`; API base = `NEXT_PUBLIC_API_URL` (see `frontend/.env.example`).
- Bot: `pip install python-telegram-bot`, run `python bot.py` with `BOT_TOKEN` + `WEBAPP_URL` set; not covered by `backend/requirements.txt`.
- Keep backend Python 3.11+, FastAPI + Uvicorn; keep frontend mobile-first.
