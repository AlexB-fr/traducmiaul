"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cat, Copy, Mic, Share2, Square } from "lucide-react";
import { LANGS, detectLang, t, type Lang } from "../lib/i18n";

type Status = "idle" | "recording" | "analyzing" | "translated" | "error";
type Result = { intent: string; lang: string; translation: string };

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
const MAX_SECONDS = 5;
// Free-tier backends sleep: wake-up takes ~30-60s. Abort stuck calls,
// then retry once (the retry hits a warm backend).
const REQUEST_TIMEOUT_MS = 60000;

async function postTranslate(form: FormData): Promise<Result> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/translate`, { method: "POST", body: form, signal: ctrl.signal });
    } catch (e) {
      throw new Error(e instanceof DOMException && e.name === "AbortError" ? "timeout" : "network");
    }
    if (!res.ok) {
      let detail = "";
      try {
        detail = ((await res.json()) as { detail?: string }).detail ?? "";
      } catch {
        /* non-JSON error body */
      }
      throw new Error(detail || `HTTP ${res.status}`);
    }
    return (await res.json()) as Result;
  } finally {
    clearTimeout(timer);
  }
}

/** Encode mono Float32 samples as 16-bit PCM WAV. */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Transcode a recorded blob (webm/opus, mp4/aac, ...) to WAV.
 * The backend decodes with soundfile, which cannot read webm/opus —
 * but browsers decode those fine via decodeAudioData.
 */
async function blobToWav(blob: Blob): Promise<Blob> {
  const raw = await blob.arrayBuffer();
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(raw);
    const sr = audio.sampleRate;
    const len = Math.min(audio.length, Math.floor(sr * MAX_SECONDS));
    const mono = new Float32Array(len);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const data = audio.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += data[i] / audio.numberOfChannels;
    }
    return encodeWav(mono, sr);
  } finally {
    void ctx.close();
  }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand?: () => void;
        initDataUnsafe?: { user?: { language_code?: string } };
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (wa) {
      wa.ready();
      wa.expand?.();
      const code = wa.initDataUnsafe?.user?.language_code;
      if (code) setLang(detectLang(code));
    }
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const sendToBackend = useCallback(
    async (blob: Blob) => {
      setStatus("analyzing");
      setError(null);
      try {
        const wav = await blobToWav(blob);
        const form = new FormData();
        form.append("file", wav, "meow.wav");
        form.append("lang", lang);
        let data: Result | null = null;
        let reason = "";
        for (let attempt = 0; attempt < 2 && !data; attempt++) {
          try {
            data = await postTranslate(form);
          } catch (e) {
            reason = e instanceof Error ? e.message : "";
            if (reason !== "timeout" && reason !== "network") break;
          }
        }
        if (!data) throw new Error(reason);
        setResult(data);
        setStatus("translated");
      } catch (e) {
        const reason = e instanceof Error ? e.message : "";
        const hint = reason === "timeout" ? "timeout — backend waking up?" : reason;
        setError(hint ? `${t(lang, "error")} (${hint})` : t(lang, "error"));
        setStatus("error");
      }
    },
    [lang]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    setCopied(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t(lang, "noMic"));
      setStatus("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        void sendToBackend(blob);
      };
      rec.start();
      setStatus("recording");
      timerRef.current = setTimeout(stopRecording, MAX_SECONDS * 1000);
    } catch {
      setError(t(lang, "noMic"));
      setStatus("error");
    }
  }, [lang, sendToBackend, stopRecording]);

  const copy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const share = () => {
    if (!result) return;
    const text = encodeURIComponent(result.translation);
    const url = `https://t.me/share/url?url=&text=${text}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else if (navigator.share) void navigator.share({ text: result.translation });
    else void copy();
  };

  const recording = status === "recording";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center px-5 py-8">
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Cat className="h-6 w-6 text-amber-400" />
          <h1 className="text-lg font-bold">{t(lang, "title")}</h1>
        </div>
        <select
          aria-label="Language"
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
          className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-semibold"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-2 text-sm text-zinc-400">{t(lang, "subtitle")}</p>

      {/* Status */}
      <div className="mt-6 flex h-16 items-end gap-1.5" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className={`w-1.5 rounded-full ${recording ? "bg-amber-400" : status === "analyzing" ? "bg-sky-400" : "bg-zinc-700"}`}
            style={{
              height: recording || status === "analyzing" ? `${12 + ((i * 37) % 36)}px` : "8px",
              animation: recording || status === "analyzing" ? `eq ${0.5 + (i % 5) * 0.12}s ease-in-out infinite` : "none",
              transformOrigin: "bottom"
            }}
          />
        ))}
      </div>
      <p className="mt-2 h-5 text-sm font-medium text-zinc-300">
        {status === "recording" && t(lang, "recording")}
        {status === "analyzing" && t(lang, "analyzing")}
        {status === "translated" && t(lang, "translated")}
      </p>

      {/* Record button */}
      <div className="relative mt-6">
        {recording && (
          <span className="absolute inset-0 rounded-full bg-red-500" style={{ animation: "pulse-ring 1.2s ease-out infinite" }} />
        )}
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={status === "analyzing"}
          className={`relative flex h-24 w-24 items-center justify-center rounded-full font-bold transition ${
            recording ? "bg-red-500 hover:bg-red-600" : "bg-amber-400 text-zinc-950 hover:bg-amber-300"
          } disabled:opacity-50`}
        >
          {recording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </button>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{recording ? t(lang, "stop") : t(lang, "record")} · {t(lang, "hint")}</p>

      {/* Error */}
      {error && <p className="mt-4 w-full rounded-xl bg-red-950 px-4 py-3 text-sm text-red-200">{error}</p>}

      {/* Translation card */}
      {result && status === "translated" && (
        <div className="mt-6 w-full rounded-2xl bg-zinc-900 p-5 shadow-lg">
          <span className="inline-block rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-300">
            {t(lang, "intent")}: {result.intent}
          </span>
          <p className="mt-3 text-lg leading-snug">{result.translation}</p>
          <div className="mt-4 flex gap-2">
            <button onClick={copy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-800 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-700">
              <Copy className="h-4 w-4" /> {copied ? t(lang, "copied") : t(lang, "copy")}
            </button>
            <button onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-sky-400">
              <Share2 className="h-4 w-4" /> {t(lang, "share")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
