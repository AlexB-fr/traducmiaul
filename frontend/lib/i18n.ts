export type Lang = "en" | "fr" | "es" | "de" | "it";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "de", label: "DE" },
  { code: "it", label: "IT" }
];

const dict = {
  en: {
    title: "Cat Meow Translator",
    subtitle: "Record a meow, get the truth.",
    record: "Record",
    stop: "Stop",
    recording: "Recording…",
    analyzing: "Analyzing…",
    translated: "Translated",
    hint: "Max 5 seconds. Loud clear meow works best.",
    copy: "Copy",
    share: "Share",
    copied: "Copied!",
    error: "Something went wrong. Try again.",
    noMic: "Microphone not available in this browser.",
    intent: "Intent"
  },
  fr: {
    title: "Traducteur de Miaou",
    subtitle: "Enregistre un miaulement, découvre la vérité.",
    record: "Enregistrer",
    stop: "Stop",
    recording: "Enregistrement…",
    analyzing: "Analyse…",
    translated: "Traduit",
    hint: "5 secondes max. Un miaulement clair et fort, c'est idéal.",
    copy: "Copier",
    share: "Partager",
    copied: "Copié !",
    error: "Un problème est survenu. Réessaie.",
    noMic: "Micro non disponible dans ce navigateur.",
    intent: "Intention"
  },
  es: {
    title: "Traductor de Maullidos",
    subtitle: "Graba un maullido y descubre la verdad.",
    record: "Grabar",
    stop: "Detener",
    recording: "Grabando…",
    analyzing: "Analizando…",
    translated: "Traducido",
    hint: "Máx. 5 segundos. Mejor un maullido claro y fuerte.",
    copy: "Copiar",
    share: "Compartir",
    copied: "¡Copiado!",
    error: "Algo salió mal. Inténtalo de nuevo.",
    noMic: "Micrófono no disponible en este navegador.",
    intent: "Intención"
  },
  de: {
    title: "Katzen-Miau-Übersetzer",
    subtitle: "Nimm ein Miauen auf und erfahre die Wahrheit.",
    record: "Aufnehmen",
    stop: "Stopp",
    recording: "Aufnahme…",
    analyzing: "Analyse…",
    translated: "Übersetzt",
    hint: "Max. 5 Sekunden. Laut und deutlich miaut klappt am besten.",
    copy: "Kopieren",
    share: "Teilen",
    copied: "Kopiert!",
    error: "Etwas ist schiefgelaufen. Versuch es erneut.",
    noMic: "Mikrofon in diesem Browser nicht verfügbar.",
    intent: "Absicht"
  },
  it: {
    title: "Traduttore di Miagolii",
    subtitle: "Registra un miagolio, scopri la verità.",
    record: "Registra",
    stop: "Stop",
    recording: "Registrazione…",
    analyzing: "Analisi…",
    translated: "Tradotto",
    hint: "Max 5 secondi. Un miagolio forte e chiaro funziona meglio.",
    copy: "Copia",
    share: "Condividi",
    copied: "Copiato!",
    error: "Qualcosa è andato storto. Riprova.",
    noMic: "Microfono non disponibile in questo browser.",
    intent: "Intenzione"
  }
} satisfies Record<Lang, Record<string, string>>;

export function t(lang: Lang, key: keyof (typeof dict)["en"]): string {
  return dict[lang][key] ?? dict.en[key];
}

export function detectLang(code?: string | null): Lang {
  const c = (code || "en").toLowerCase().slice(0, 2);
  return (["en", "fr", "es", "de", "it"] as Lang[]).includes(c as Lang) ? (c as Lang) : "en";
}
