import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    // Default: testes de funções puras rodam em node (mais rápido). Arquivos
    // que precisam de DOM declaram `// @vitest-environment jsdom` no topo.
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup.ts"],
    coverage: {
      // `all: true` + `include` fazem arquivos nunca importados por um teste
      // aparecerem no relatório como 0% em vez de simplesmente somem dele —
      // sem isso, a cobertura reportada só reflete os poucos arquivos que
      // algum teste toca, o que infla o número e esconde exatamente o que
      // está descoberto.
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/tests/**", "src/**/*.d.ts", "src/main.tsx"],
    },
  },
})
