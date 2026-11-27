// Music corner: Apple Music embed (no MusicKit, no developer account). Mounted once at the app root,
// so it keeps playing across route changes. Previews without sign-in; full tracks when signed in inside the widget.
import { ui, useUI } from "@/data/ui";
import { useSettings, patchSettings } from "@/services/settings";
import { Button, IconButton, Input } from "@/ui";
import { useState } from "react";

/** music.apple.com/{sf}/{album|playlist|station}/... → embed.music.apple.com/... (keeps ?i= for songs). */
export function appleMusicEmbed(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!/^(embed\.)?music\.apple\.com$/.test(u.hostname)) return null;
    if (!/^\/[a-z]{2}\/(album|playlist|station|song|artist)\//.test(u.pathname)) return null;
    const out = new URL(`https://embed.music.apple.com${u.pathname}`);
    const i = u.searchParams.get("i");
    if (i) out.searchParams.set("i", i);
    return out.toString();
  } catch {
    return null;
  }
}

export const openInAppleMusic = (embed: string) => embed.replace("://embed.music.apple.com", "://music.apple.com");

export function MusicCorner() {
  const { musicOpen } = useUI();
  const s = useSettings();
  const [draft, setDraft] = useState("");
  const embed = s?.music_url ? appleMusicEmbed(s.music_url) : null;
  // Keep the iframe mounted once loaded (hidden when collapsed) so playback continues.
  const [loaded, setLoaded] = useState(false);
  if (musicOpen && embed && !loaded) setLoaded(true);
  if (!loaded && !musicOpen) return null;
  return (
    <aside className="music" aria-label="Music corner" style={musicOpen ? undefined : { visibility: "hidden", pointerEvents: "none" }}>
      <div className="music-head">
        <span className="micro">Music corner</span>
        <div className="row">
          {embed ? (
            <a className="icon-btn sm" href={openInAppleMusic(embed)} target="_blank" rel="noreferrer" aria-label="Open in Apple Music" title="Open in Apple Music">
              ↗
            </a>
          ) : null}
          <IconButton icon="x" size="sm" label="Hide music" onClick={() => ui.set({ musicOpen: false })} />
        </div>
      </div>
      {embed ? (
        <iframe src={embed} title="Apple Music" allow="autoplay *; encrypted-media *; clipboard-write" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" loading="lazy" />
      ) : (
        <form
          className="stack"
          style={{ padding: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (appleMusicEmbed(draft)) void patchSettings({ music_url: draft.trim() });
          }}
        >
          <Input label="Apple Music playlist or album link" placeholder="https://music.apple.com/in/playlist/…" value={draft} onChange={(e) => setDraft(e.target.value)} hint={draft && !appleMusicEmbed(draft) ? "That doesn't look like an Apple Music link." : "Signed out: 30-second previews. Sign in inside the player for full tracks."} />
          <Button type="submit" size="sm" variant="primary" disabled={!appleMusicEmbed(draft)}>
            Save
          </Button>
        </form>
      )}
    </aside>
  );
}
