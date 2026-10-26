import "server-only";

/** Server-side configuration read from environment variables. Never import from client code. */
export function serverConfig() {
  const llmKey = process.env.LLM_API_KEY?.trim() ?? "";
  const llmModel = process.env.LLM_MODEL?.trim() ?? "";
  return {
    sonioxKey: process.env.SONIOX_API_KEY?.trim() ?? "",
    llm: {
      apiKey: llmKey,
      model: llmModel,
      baseURL: process.env.LLM_BASE_URL?.trim() || "https://api.openai.com/v1",
      jsonMode: (process.env.LLM_JSON_MODE ?? "on").toLowerCase() !== "off",
      /** Slow local/free backends need longer; hosted APIs answer in 1-3s. */
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS) > 0 ? Number(process.env.LLM_TIMEOUT_MS) : 25_000,
      configured: Boolean(llmKey && llmModel),
    },
  };
}
