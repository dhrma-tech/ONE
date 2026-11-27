// Buffer GraphQL API (https://api.buffer.com) with a personal API key (BUFFER_ACCESS_TOKEN, server only).
// createPost → schedulingType automatic, mode addToQueue. Clients fall back to X intent / LinkedIn copy-and-open.
import { env, json, type Handler } from "../http.js";
import { requireUser } from "../auth.js";
import { cached } from "../cache.js";

const ENDPOINT = "https://api.buffer.com";

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${env("BUFFER_ACCESS_TOKEN")}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12_000),
  });
  if (r.status === 401) throw new Error("buffer_unauthorized");
  if (r.status === 429) throw new Error("buffer_rate_limited");
  const j = (await r.json()) as { data?: T; errors?: { message: string }[] };
  if (j.errors?.length) throw new Error(`buffer_${j.errors[0].message}`.slice(0, 160));
  return j.data as T;
}

export interface BufferChannel {
  id: string;
  name: string;
  service: string;
}

async function channels(): Promise<BufferChannel[]> {
  const o = await gql<{ account: { organizations: { id: string }[] } }>("query { account { organizations { id name } } }");
  const out: BufferChannel[] = [];
  for (const org of o.account.organizations) {
    const c = await gql<{ channels: BufferChannel[] }>("query($id: OrganizationId!) { channels(input: { organizationId: $id }) { id name service } }", { id: org.id });
    out.push(...c.channels);
  }
  return out;
}

/** Map our platform to a Buffer channel service. */
export const pickChannel = (list: BufferChannel[], platform: "x" | "linkedin") =>
  list.find((c) => (platform === "x" ? /^(twitter|x)$/i.test(c.service) : /^linkedin$/i.test(c.service)));

export const bufferChannels: Handler = async (req) => {
  const user = await requireUser(req);
  if (!env("BUFFER_ACCESS_TOKEN")) return json({ error: "not_configured" }, 409);
  return json({ channels: await cached(`buffer:channels:${user.id}`, 3600, channels) });
};

export const bufferPost: Handler = async (req) => {
  const user = await requireUser(req);
  if (!env("BUFFER_ACCESS_TOKEN")) return json({ error: "not_configured" }, 409);
  const b = req.body as { platform?: "x" | "linkedin"; text?: string };
  if ((b?.platform !== "x" && b?.platform !== "linkedin") || !b.text?.trim()) return json({ error: "bad_request" }, 400);
  if (b.platform === "x" && [...b.text].length > 280) return json({ error: "too_long" }, 400);
  const list = await cached(`buffer:channels:${user.id}`, 3600, channels);
  const ch = pickChannel(list, b.platform);
  if (!ch) return json({ error: "channel_not_connected" }, 409);
  const res = await gql<{ createPost: { __typename: string; post?: { id: string } | { id: string }[]; message?: string } }>(
    `mutation($text: String!, $channelId: ChannelId!) {
      createPost(input: { text: $text, channelId: $channelId, schedulingType: automatic, mode: addToQueue }) {
        __typename
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }`,
    { text: b.text.trim(), channelId: ch.id },
  );
  const p = res.createPost;
  if (p.__typename !== "PostActionSuccess") return json({ error: "buffer_rejected", message: p.message ?? p.__typename }, 422);
  const post = Array.isArray(p.post) ? p.post[0] : p.post;
  return json({ id: post?.id ?? "" });
};
