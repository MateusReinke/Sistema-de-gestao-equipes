import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    // Em desenvolvimento o Vite serve o front e a API roda em outra porta.
    // O proxy mantém tudo na mesma origem, para o cookie de sessão funcionar
    // igual ao que acontece em produção.
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://127.0.0.1:3000",
        changeOrigin: false,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa as dependências pesadas do código do app: elas mudam pouco,
        // então o navegador reaproveita o cache entre deploys.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
        },
      },
    },
  },
}));
