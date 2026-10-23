import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "path"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  // Node-side only (sem prefixo VITE_, então nunca vai pro bundle do
  // client) — onde o backend roda localmente fora do docker compose.
  const apiProxyTarget = env.API_PROXY_TARGET || "http://localhost:8000"

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "./src") },
    },
    server: {
      // `@morlan/access-web` (cookie de sessão) e `src/lib/api.ts` (axios)
      // chamam `/api/*` como same-origin — o cookie SameSite=Lax do BFF não
      // atravessa uma chamada cross-origin de verdade. Em prod isso é
      // nginx.conf; aqui, este proxy faz o mesmo papel em `npm run dev`.
      proxy: {
        "/api": { target: apiProxyTarget, changeOrigin: true },
      },
    },
  }
})
