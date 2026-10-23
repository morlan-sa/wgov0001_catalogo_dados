import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@morlan/ui"

// Os estilos do `@morlan/ui` referenciam "IBM Plex Sans Variable" (veja
// --font-sans em seu styles.css), mas não empacotam a fonte em si — cada app
// consumidor precisa carregá-la. `@fontsource/ibm-plex-sans` (pesos
// estáticos) continua disponível como dependência para pontos de uso que
// precisem de um fallback não variável.
import "@fontsource-variable/ibm-plex-sans"

import { SessaoProvider } from "@/contexts/sessao-provider"
import { queryClient } from "@/lib/query-client"
import { App } from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <SessaoProvider>
          <App />
        </SessaoProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>
)
