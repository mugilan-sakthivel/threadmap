import { serverConfig } from "@/lib/server/config";
import { rejectCrossSite } from "@/lib/server/guard";

/**
 * Mints a short-lived Soniox key so the browser can stream audio directly
 * to Soniox without ever seeing the permanent key.
 */
export async function POST(request: Request) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;
  const { sonioxKey } = serverConfig();
  if (!sonioxKey) {
    return Response.json({ error: "SONIOX_API_KEY is not set on the server" }, { status: 503 });
  }
  try {
    const res = await fetch("https://api.soniox.com/v1/auth/temporary-api-key", {
      method: "POST",
      headers: { Authorization: `Bearer ${sonioxKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ usage_type: "transcribe_websocket", expires_in_seconds: 60 }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => ({}))) as { api_key?: string };
    if (!res.ok || !body.api_key) {
      return Response.json({ error: `Soniox rejected the key request (${res.status})` }, { status: 502 });
    }
    return Response.json({ api_key: body.api_key }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not reach Soniox" }, { status: 502 });
  }
}
