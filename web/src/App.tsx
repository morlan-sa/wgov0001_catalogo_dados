import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { Toaster } from "@morlan/ui"
import { login } from "@morlan/access-web"
import { RequereAutenticacao } from "@morlan/access-web/react"

import { AppLayout } from "@/layouts/app-layout"
import { RouteErrorBoundary } from "@/components/route-error-boundary"
import { useSessao } from "@/hooks/use-sessao"

import { Catalogo } from "@/pages/catalogo"
import { CatalogoSchema } from "@/pages/catalogo-schema"
import { CatalogoTabela } from "@/pages/catalogo-tabela"
import { Dashboard } from "@/pages/dashboard"
import { Dominio } from "@/pages/dominio"
import { Dominios } from "@/pages/dominios"
import { NotFound } from "@/pages/not-found"
import { Scanner } from "@/pages/scanner"

// Sem rotas de auth (login, cadastro, recuperação de senha) — autenticação é
// feita pelo Keycloak via `@morlan/access-web`. `RequereAutenticacao` decide o
// que mostrar enquanto não há sessão; a UI de login real é a do Keycloak.
const router = createBrowserRouter([
  {
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Dashboard />,
            handle: { title: "Dashboard de Governança" },
          },
          {
            path: "catalogo",
            element: <Catalogo />,
            handle: { title: "Catálogo de Dados" },
          },
          {
            path: "catalogo/:schema",
            element: <CatalogoSchema />,
            handle: { title: "Tabelas do schema" },
          },
          {
            path: "catalogo/:schema/:table",
            element: <CatalogoTabela />,
            handle: { title: "Detalhe da tabela" },
          },
          {
            path: "scanner",
            element: <Scanner />,
            handle: { title: "Scanner" },
          },
          {
            path: "dominios",
            element: <Dominios />,
            handle: { title: "Domínios de Negócio" },
          },
          {
            path: "dominios/:code",
            element: <Dominio />,
            handle: { title: "Domínio de Negócio" },
          },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
])

export function App() {
  const { autenticado } = useSessao()

  return (
    <div className="h-screen">
      <Toaster position="bottom-right" />
      <RequereAutenticacao
        autenticado={autenticado}
        aoNaoAutenticado={() => login()}
        landing={{
          nome: "Catálogo de Dados",
          subtitulo: "Entre com sua conta corporativa para continuar.",
          imagemFundoUrl: "/login-bg.webp",
        }}
      >
        <RouterProvider router={router} />
      </RequereAutenticacao>
    </div>
  )
}
