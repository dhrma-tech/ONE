// Settings dialog: coach voice, board look, play options, data. (The coach is rule-based: no AI, no keys.)
import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { useSettings } from "../lib/useSettings";
import { exportAll, importAll, resetAll, settings, type BoardTheme, type PieceSet, type Theme } from "../bridge/storage";
import { BOARD_THEMES } from "../components/Board";
import { toast } from "../components/Toast";
import { speak, ttsAvailable, voices } from "../lib/tts";
import { Select } from "../components/Select";

type Toggle = "coordinates" | "sounds" | "legalHighlights" | "takebacks" | "hints" | "showEval" | "focusMode" | "safetyNet";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  const file = useRef<HTMLInputElement>(null);
  const [vlist, setVlist] = useState<SpeechSynthesisVoice[]>(voices());
  useEffect(() => {
    if (!ttsAvailable()) return;
    const f = () => setVlist(voices());
    speechSynthesis.addEventListener?.("voiceschanged", f);
    return () => speechSynthesis.removeEventListener?.("voiceschanged", f);
  }, []);

  const toggle = (k: Toggle, label: string) => (
    <label className="check"><input type="checkbox" checked={s[k]} onChange={(e) => settings.set({ [k]: e.target.checked })} /> {label}</label>
  );
  const vp = s.voice;
  const setVoice = (patch: Partial<typeof vp>) => settings.set({ voice: { ...s.voice, ...patch } });

  const doExport = async () => {
    try {
      const blob = new Blob([await exportAll()], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `bobby-export-${new Date().toISOString().slice(0, 10)}.json` });
      a.click(); URL.revokeObjectURL(a.href); toast("Exported");
    } catch (e) { toast("Export failed: " + (e as Error).message); }
  };
  const doImport = async (f: File) => {
    try { await importAll(await f.text()); toast("Imported. Reloading"); setTimeout(() => location.reload(), 600); }
    catch (e) { toast("Import failed: " + (e as Error).message.slice(0, 120)); }
  };
  return (
    <Dialog title="Settings" onClose={onClose} wide>
      <div className="set-grid">
        <fieldset className="set">
          <legend>Voice</legend>
          {ttsAvailable() ? <>
            <label className="check"><input type="checkbox" checked={s.voice.enabled} onChange={(e) => settings.set({ voice: { ...s.voice, enabled: e.target.checked } })} /> Speak coach answers aloud</label>
            <label>Voice <Select value={vp.voiceURI} onChange={(e) => setVoice({ voiceURI: e.target.value })} aria-label="System voice">
              <option value="">Automatic</option>{vlist.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</Select></label>
            <label>Rate <input type="range" min={0.5} max={2} step={0.05} value={vp.rate} onChange={(e) => setVoice({ rate: +e.target.value })} aria-label="Speech rate" /> <output>{vp.rate.toFixed(2)}</output></label>
            <label>Pitch <input type="range" min={0} max={2} step={0.05} value={vp.pitch} onChange={(e) => setVoice({ pitch: +e.target.value })} aria-label="Speech pitch" /> <output>{vp.pitch.toFixed(2)}</output></label>
            <div className="btnrow"><button className="btn" onClick={() => speak("Knight to f3. Develop a piece and control the centre.", true)}>Test voice</button></div>
          </> : <p className="muted small">This browser has no speech synthesis.</p>}
        </fieldset>

        <fieldset className="set">
          <legend>Look</legend>
          <label>Theme <Select value={s.theme} onChange={(e) => settings.set({ theme: e.target.value as Theme })} aria-label="Theme">
            <option value="auto">Match system</option><option value="light">Light</option><option value="dark">Dark</option></Select></label>
          <label>Board <Select value={s.boardTheme} onChange={(e) => settings.set({ boardTheme: e.target.value as BoardTheme })} aria-label="Board theme">
            {Object.entries(BOARD_THEMES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></label>
          <label>Pieces <Select value={s.pieceSet} onChange={(e) => settings.set({ pieceSet: e.target.value as PieceSet })} aria-label="Piece set">
            <option value="classic">Classic</option><option value="glyph">Glyphs</option><option value="letters">Letters</option></Select></label>
          {toggle("coordinates", "Coordinates")}
          {toggle("legalHighlights", "Show legal moves")}
          {toggle("showEval", "Eval bar")}
        </fieldset>

        <fieldset className="set">
          <legend>Play</legend>
          {toggle("focusMode", "Focus mode: hide eval and coach until the game ends")}
          {toggle("sounds", "Sounds")}
          {toggle("takebacks", "Allow takebacks")}
          {toggle("hints", "Allow hints")}
          {toggle("safetyNet", "Safety net: ask before a move that loses a piece or allows mate")}
          <label>Bobby strength offset <input type="range" min={-200} max={200} step={25} value={s.strengthOffset} onChange={(e) => settings.set({ strengthOffset: +e.target.value })} aria-label="Strength offset" /> <output>{s.strengthOffset > 0 ? "+" : ""}{s.strengthOffset}</output></label>
          <p className="muted small">Bobby aims at your estimated rating plus this offset. Applies from the next game.</p>
        </fieldset>

        <fieldset className="set">
          <legend>Your data</legend>
          <p className="muted small">Everything stays on this device. Export to back up or move it.</p>
          <div className="btnrow">
            <button className="btn" onClick={doExport}>Export</button>
            <button className="btn" onClick={() => file.current?.click()}>Import</button>
            <button className="btn btn-danger" onClick={() => { if (confirm("Delete all Bobby data on this device?")) void resetAll(); }}>Reset</button>
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); }} />
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
