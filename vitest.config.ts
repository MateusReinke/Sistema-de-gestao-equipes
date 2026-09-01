import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

const alias = { "@": path.resolve(__dirname, "./src") };

// Dois projetos porque o setup do front toca `window`: o código do servidor
// roda em ambiente node, sem DOM nem jest-dom.
export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "web",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "server",
          environment: "node",
          globals: true,
          include: ["server/**/*.{test,spec}.ts"],
        },
      },
    ],
  },
});
