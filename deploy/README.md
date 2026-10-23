# Configuração de execução por ambiente

`env.<ambiente>.json` declara as variáveis de ambiente públicas que a aplicação recebe naquele
ambiente. Este repositório não contém nenhuma configuração de esteira — quem aplica este
arquivo é o catálogo central de CI/CD, em `morlan-sa/infraestrutura`
(`accounts/deployments/catalogo.tf`, AWS CodePipeline/CodeBuild): quando o componente declara
`env_dir = "deploy"` nesse catálogo, o estágio de build/deploy da esteira substitui as
variáveis de ambiente do container pelas deste arquivo, resolvendo `env.<ambiente>.json`
automaticamente a partir do ambiente que o próprio pipeline já está rodando (dev/homolog/prod,
pela branch que disparou) — nada aqui precisa ser trocado ao estender o projeto para
homologação/produção além de criar os arquivos correspondentes (ver abaixo).

Uma variável nova entra pelo mesmo push que leva o código que a consome — nunca é preciso mexer em
Terraform pra isso. Convenção portada de `rnc2/server` depois de um caso real lá: o modelo antigo
(variável declarada só no Terraform) exigia um `apply -replace` no repositório de infraestrutura
seguido de um deploy aqui, nessa ordem, sem nenhum aviso quando a ordem era invertida — e como o
módulo de task definition ignora mudanças em `container_definitions`, a divergência ficava
invisível pro `plan`.

Preencha os valores marcados `TODO-` neste arquivo ao cravar este template num projeto real (ver
"Identidade do projeto" em `web/src/pages/home.tsx`).

## Regras

**O arquivo substitui o conjunto inteiro.** Uma variável removida daqui desaparece da revisão
seguinte. Isso é deliberado: sem essa regra, o arquivo deixaria de descrever o que a aplicação
recebe.

**Só valor público.** Credencial continua no Secrets Manager, referenciada pelo Terraform no bloco
`secrets` da task definition (`DATABASE_USER`/`DATABASE_PASSWORD`, `KEYCLOAK_CLIENT_SECRET`,
`SESSION_SECRET`, `SESSION_REDIS_AUTH`). Nada que seja segredo entra aqui.

**Um arquivo por ambiente.** Este template só vem com `env.dev.json`, porque só esse
componente/ambiente estaria de fato registrado no catálogo hoje — ao estender este projeto para
homologação/produção, crie `env.homolog.json`/`env.prod.json` ao lado deste. O arquivo ausente
para um ambiente que o catálogo espera falha o deploy daquele ambiente (de propósito — sem ele a
revisão herdaria as variáveis de outro ambiente, não as do seu próprio).

## Registrar o componente

Nada neste repositório liga `env_dir` a um pipeline de verdade — isso é uma entrada no catálogo
de `infraestrutura` (`accounts/deployments/catalogo.tf`, `locals.apps`), feita por quem
administra aquele repositório, não por uma edição aqui:

```hcl
"<projeto>-api" = {
  repositorio = "<projeto>"
  contexto    = "server"
  caminhos    = ["server/**", "deploy/**"]
  env_dir     = "deploy"
  runtime     = { python = "3.12" }
}
```

Ver `infraestrutura`'s `docs/catalogo-templates-cicd.md` para o catálogo completo e o
significado de cada campo.
