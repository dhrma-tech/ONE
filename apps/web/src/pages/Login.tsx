import { useState } from "react";
import { Banner, Button, Input, SectionFrame, Switch } from "@/ui";
import { auth } from "@/data/supabase";

/** Magic-link login (single user). Shown only when Supabase is configured and there is no session. */
export default function Login() {
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="page" style={{ maxWidth: 560, margin: "6vh auto" }} data-section="home">
      <Banner scene="home" label="ONE" />
      <SectionFrame>
        <h1 className="page-title">
          Lock in<span className="dot">.</span>
        </h1>
        <p className="muted text" style={{ margin: "8px 0 20px" }}>
          One user. One link. No password to forget.
        </p>
        {sent ? (
          <p className="notice">Link sent. Check your inbox, then come back here.</p>
        ) : (
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setErr(await auth.signIn(email.trim(), first));
              setBusy(false);
              setSent(true);
            }}
          >
            <Input label="Email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Switch checked={first} onChange={setFirst} label="First login on a new Supabase project (creates the account)" />
            <Button type="submit" variant="primary" disabled={busy || !email}>
              Send magic link
            </Button>
            {err ? <p className="danger small">{err}</p> : null}
          </form>
        )}
      </SectionFrame>
    </div>
  );
}
