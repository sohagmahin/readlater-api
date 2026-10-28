import { defineConfig } from "vitest/config";
import { config } from "dotenv";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    env: config({ path: ".env.test" }).parsed,
    fileParallelism: false, // একই ডেটাবেস ভাগ করি, তাই ফাইল একে একে চলবে
    hookTimeout: 20000,
  },
});