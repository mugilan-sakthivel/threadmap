import { connection } from "next/server";
import { serverConfig } from "@/lib/server/config";

/** Tells the client which capabilities are configured. Never returns secrets. */
export async function GET() {
  // Read env at request time, not at build time.
  await connection();
  const cfg = serverConfig();
  return Response.json({
    stt: Boolean(cfg.sonioxKey),
    llm: cfg.llm.configured,
    model: cfg.llm.configured ? cfg.llm.model : null,
  });
}
