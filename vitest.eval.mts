import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Same keys the app uses; Node reads .env.local natively (no extra dependency).
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Live-model evals: slow and paid, so they are separate from `pnpm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["src/**/*.eval.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
