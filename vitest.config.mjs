import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load credentials from the project's own .env so tests use the same DB user/pass as dev
config({ path: resolve(__dirname, "backend/.env") });
config({ path: resolve(__dirname, ".env") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    forceExit: true,
    setupFiles: ["./backend/tests/setup.js"],
    include: ["backend/tests/**/*.test.js"],
    env: {
      NODE_ENV: "test",
      DB_HOST: process.env.DB_HOST || "127.0.0.1",
      DB_PORT: process.env.DB_PORT || "3306",
      DB_USER: process.env.DB_USER || "root",
      DB_PASS: process.env.DB_PASS || "",
      DB_NAME: "expense_tracker_test",
      JWT_SECRET: process.env.JWT_SECRET || "test-jwt-secret-at-least-32-chars-long",
      EMAIL_SECRET_KEY: process.env.EMAIL_SECRET_KEY || "test-email-secret-key-32-chars-aa",
    },
  },
});
