// The ONLY Vercel serverless function (Hobby allows 12 per deployment). vercel.json rewrites /api/* here.
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleNode } from "../server/node-adapter.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return handleNode(req, res);
}
