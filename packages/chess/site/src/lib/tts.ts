// Spoken coach output via the Web Speech API (speechSynthesis). Output only; no speech recognition.
import { settings, type VoicePrefs } from "../bridge/storage";

export const ttsAvailable = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

export function voices(): SpeechSynthesisVoice[] {
  if (!ttsAvailable()) return [];
  try { return speechSynthesis.getVoices(); } catch { return []; }
}


function pickVoice(prefs: VoicePrefs | undefined): SpeechSynthesisVoice | null {
  const vs = voices();
  if (!vs.length) return null;
  if (prefs?.voiceURI) { const v = vs.find((x) => x.voiceURI === prefs.voiceURI); if (v) return v; }
  const lang = (navigator.language || "en").slice(0, 2);
  const local = vs.filter((v) => v.lang.toLowerCase().startsWith(lang));
  const pool = local.length ? local : vs;
  return pool.find((v) => v.default) || pool[0];
}

/** Speak coach text when voice output is on (or when forced, for the Settings "test" button). */
export function speak(text: string, force = false): boolean {
  if (!ttsAvailable() || !text.trim()) return false;
  const p = settings.get().voice;
  if (!force && !p.enabled) return false;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 1200));
    u.rate = Math.max(0.5, Math.min(2, p.rate));
    u.pitch = Math.max(0, Math.min(2, p.pitch));
    const v = pickVoice(p);
    if (v) { u.voice = v; u.lang = v.lang; }
    speechSynthesis.speak(u);
    return true;
  } catch { return false; }
}

export function stopSpeaking() { if (ttsAvailable()) try { speechSynthesis.cancel(); } catch { /* ignore */ } }
