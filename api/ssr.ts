/**
 * api/ssr.ts — Vercel Serverless Function
 *
 * Wraps the TanStack Start Web Fetch API handler (dist/server/server.js)
 * for Vercel's Node.js runtime. The main build produces a self-contained
 * ES module that exports `{ fetch(request) }` — this file adapts that
 * interface to Node.js IncomingMessage / ServerResponse.
 *
 * Routing:
 *   - Static assets  → served directly from dist/client/ by Vercel CDN
 *   - /api/analyze   → intercepted inside the TanStack Start handler (server.ts)
 *   - Everything else → SSR via TanStack Start router
 */

import type { IncomingMessage, ServerResponse } from "http";
import { Readable } from "stream";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — generated at build time; not present in source tree
import handler from "../dist/server/server.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 30,
};

function nodeToWebRequest(req: IncomingMessage): Request {
  const protocol =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const host =
    (req.headers["x-forwarded-host"] as string | undefined) ??
    req.headers.host ??
    "localhost";
  const url = new URL(req.url ?? "/", `${protocol}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }

  const method = (req.method ?? "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  return new Request(url.toString(), {
    method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    // @ts-ignore — Node.js 18+ requires this for streaming bodies
    duplex: "half",
  });
}

async function webToNodeResponse(
  webResponse: Response,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (webResponse.body) {
    await new Promise<void>((resolve, reject) => {
      const readable = Readable.fromWeb(
        webResponse.body as ReadableStream<Uint8Array>,
      );
      readable.pipe(res);
      readable.on("end", resolve);
      readable.on("error", reject);
    });
  } else {
    res.end();
  }
}

export default async function ssrHandler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const request = nodeToWebRequest(req);
    const response = await handler.fetch(request);
    await webToNodeResponse(response, res);
  } catch (err) {
    console.error("[ssr] unhandled error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain");
    }
    res.end("Internal Server Error");
  }
}
