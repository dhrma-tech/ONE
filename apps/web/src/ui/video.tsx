import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { frameCandidates, fmtDuration } from "@/domain/thumbs";
import { Stars } from "./primitives";

export interface VideoCardData {
  id: string;
  youtube_id: string;
  title: string;
  channel?: string | null;
  duration_s?: number | null;
  rating?: number | null;
  frame?: number;
  section: string;
  status?: string;
  position_s?: number;
}

/** Thumbnail from an in-video frame with a fallback chain, then a generated accent card. */
export function FrameThumb({ v, size = "card" }: { v: VideoCardData; size?: "card" | "poster" }) {
  const cands = frameCandidates(v.youtube_id, v.frame ?? 2, size);
  const [i, setI] = useState(0);
  const failed = i >= cands.length;
  const pct = v.position_s && v.duration_s ? Math.min(1, v.position_s / v.duration_s) : 0;
  return (
    <div className="video-thumb" data-section={v.section}>
      {failed ? (
        <div className="gen" aria-hidden>
          <span className="micro">{v.channel}</span>
          <strong>{v.title}</strong>
        </div>
      ) : (
        <img
          src={cands[i]}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setI((n) => n + 1)}
          onLoad={(e) => {
            // YouTube serves a 120x90 grey placeholder for some missing frames
            const img = e.currentTarget;
            if (img.naturalWidth <= 120 && size !== "card") setI((n) => n + 1);
          }}
        />
      )}
      {v.duration_s ? <span className="dur">{fmtDuration(v.duration_s)}</span> : null}
      {pct > 0 ? (
        <span className="progress" aria-hidden>
          <i style={{ width: `${pct * 100}%` }} />
        </span>
      ) : null}
    </div>
  );
}

export function VideoCard({ v, to }: { v: VideoCardData; to: string }) {
  return (
    <Link to={to} className="card video-card" data-section={v.section} style={{ "--accent": `var(--accent-${v.section})` } as CSSProperties}>
      <FrameThumb v={v} />
      <div className="video-meta">
        <span className="title">{v.title}</span>
        <span className="row xs muted">
          <span className="truncate grow">{v.channel}</span>
          {v.rating ? <Stars value={v.rating} /> : null}
        </span>
        {v.status && v.status !== "queue" ? <span className="micro accent">{v.status}</span> : null}
      </div>
    </Link>
  );
}
