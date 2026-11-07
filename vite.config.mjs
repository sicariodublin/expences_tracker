import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Builds default to the GitHub Pages sub-path. The Docker image sets PUBLIC_URL=/
  // so its build is served from the root. The dev server always runs at "/".
  const base =
    command === "build" ? process.env.PUBLIC_URL || "/expences_tracker/" : "/";

  return {
    base,
    plugins: [react()],
    // Keep the CRA-era REACT_APP_* variable names working (Dockerfile, .env files).
    envPrefix: ["VITE_", "REACT_APP_"],
    server: {
      port: Number(env.PORT) || 3002,
      strictPort: true,
      open: true,
    },
    build: {
      outDir: "build",
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/setupTests.js"],
      passWithNoTests: true,
    },
  };
});
