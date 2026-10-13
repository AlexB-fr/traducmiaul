# SPECS & PROMPT AGENT: Cat Meow Translator (Telegram Mini App)

## 1. Project Goal
Develop a mobile-first entertainment Telegram Mini App (TGMA) that records a cat's meow via the user's microphone, sends the audio to a Python backend for analysis/classification, and returns a humorous "translation". 

**Core Requirement:** The app must be fully **English by default**, with built-in multi-language translation support for French (FR), Spanish (ES), German (DE), and Italian (IT).

---

## 2. Architecture & Tech Stack

* **Frontend (Mini App & Landing Page):** Next.js (React), Tailwind CSS, Lucide Icons, Telegram Web App SDK (`@twa-dev/sdk`), `next-intl` or lightweight i18n module.
* **Backend (ML & Translation API):** Python 3.11+, FastAPI, Uvicorn, Librosa / SoundFile, Scikit-learn or PyTorch (lightweight audio classification model).
* **Deployment:** Frontend on Vercel, Backend on VPS / Render / Railway.
* **Protocols:** HTTPS, REST API (`POST /api/translate`).

---

## 3. User & Data Workflow

1. User opens the TGMA from Telegram or Landing Page.
2. The UI detects the Telegram user language (or falls back to **English `en`** by default).
3. The UI requests microphone access via the Web Audio API.
4. User taps the main "Record" button to capture audio (max 5 seconds).
5. Frontend sends a `POST /api/translate` request containing the audio file and target language (`lang: "en" | "fr" | "es" | "de" | "it"`).
6. Backend processes audio in-memory, predicts intent (e.g., *Hunger, Attention, Rage, Philosophy, Sleep*), retrieves the translation for the selected language, and **deletes the audio buffer immediately** (zero-storage, GDPR compliant).
7. Frontend displays the humorous translation card with share buttons.

---

## 4. Instructions for Code Agent

### Step 1: Internationalization (i18n) Setup
- Set **English (`en`)** as the default fallback language across the entire application.
- Support language switching and payload requests for: `en`, `fr`, `es`, `de`, `it`.
- Auto-detect the user's language using Telegram's `initDataUnsafe.user.language_code`.

### Step 2: Backend (FastAPI - `backend/main.py`)
- Create a FastAPI endpoint `POST /api/translate` accepting:
  - `file`: Audio file (`UploadFile`).
  - `lang`: Target language code string (default: `"en"`).
- Implement audio processing logic using `librosa`/`soundfile` (extract RMS/MFCC) to classify into intent categories.
- Create a localized translation dictionary/JSON structure for humor outputs across supported languages (`en`, `fr`, `es`, `de`, `it`).
- Return JSON payload: `{ "intent": "hunger", "lang": "en", "translation": "Human, my bowl is 4% empty. Feed me now." }`.
- Ensure **zero-disk storage** (process files strictly in memory/RAM).

### Step 3: Frontend & TGMA (Next.js - `frontend/app/`)
- Initialize Telegram WebApp SDK (`window.Telegram.WebApp.ready()`).
- Build a clean, mobile-first UI with:
  - Language selector dropdown/toggle (EN default, FR, ES, DE, IT).
  - Main pulsing record button (`MediaRecorder` API).
  - Audio waveform / status animation (Recording, Analyzing, Translated).
  - Translation display card with copy/share features.
- Localize all static UI text (buttons, headings, placeholders) into English + sub-languages.

### Step 4: Telegram Bot Glue (`bot.py`)
- Write a lightweight `python-telegram-bot` script to declare the bot, handle `/start`, and link the Web App menu button.

---

## 5. Expected Output

Generate the full project repository structure (`/backend` and `/frontend`), including updated `requirements.txt`, `package.json`, i18n dictionaries, and fully executable boilerplate code ready to deploy.