import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    // Integration files apply the same additive schema in beforeAll. Run them
    // serially so concurrent DDL cannot deadlock on foreign-key table locks.
    // Pure unit runs keep Vitest's normal file parallelism.
    fileParallelism: !process.env.TEST_DATABASE_URL,
  },
});
