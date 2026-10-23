import { Button, Card, H2, P } from "@morlan/ui"
import { Link } from "react-router-dom"

export function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center p-4">
      <Card className="max-w-md p-6 text-center">
        <H2>Página não encontrada</H2>
        <P className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </P>
        <Button asChild className="mt-4">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </Card>
    </div>
  )
}
