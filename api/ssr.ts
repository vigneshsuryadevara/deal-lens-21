/**
 * api/ssr.ts — Vercel Serverless Function
 * Adapts the TanStack Start Web Fetch API handler to Node.js runtime.
 */

import type { IncomingMessage, ServerResponse } from "http";
import { Readable } from "stream";
// @ts-ignore — generated at build time
import handler from "../dist/server/server.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
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
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else headers.set(key, value);
  }

  const method = (req.method ?? "GET").toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";

  return new Request(url.toString(), {
    method,
    headers,
    // Cast through unknown to avoid ReadableStream generic mismatch between
    // different Node.js type definitions across TS versions.
    body: hasBody ? (Readable.toWeb(req) as unknown as ReadableStream) : undefined,
    // @ts-ignore — required for streaming bodies in Node 18+
    duplex: "half",
  });
}

async function webToNodeResponse(
  webResponse: Response,
  res: ServerResponse,
): Promise<void> {
  res.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => res.setHeader(key, value));

  if (webResponse.body) {
    // Cast through unknown to avoid ReadableStream<Uint8Array<ArrayBufferLike>>
    // vs ReadableStream<any> mismatch introduced in TS 5.8+
    const readable = Readable.fromWeb(
      webResponse.body as unknown as import("stream/web").ReadableStream<Uint8Array>,
    );
    await new Promise<void>((resolve, reject) => {
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
