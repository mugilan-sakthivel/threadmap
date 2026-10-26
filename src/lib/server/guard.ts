import "server-only";

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Cheap protection for routes that spend money (LLM calls, speech keys):
 * only accept same-origin browser requests. This stops other websites from
 * using a deployed instance; it is NOT authentication (non-browser clients can
 * forge headers), so add real auth + rate limiting before a public launch.
 */
export function rejectCrossSite(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) return Response.json({ error: "forbidden" }, { status: 403 });
    } catch {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
  }
  return null;
}

/** Parse a JSON body with a hard size cap (the schema bounds fields, this bounds the bytes read). */
export async function readJsonBody(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return { ok: false, response: Response.json({ error: "payload_too_large" }, { status: 413 }) };
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, response: Response.json({ error: "payload_too_large" }, { status: 413 }) };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: Response.json({ error: "invalid_request" }, { status: 400 }) };
  }
}
