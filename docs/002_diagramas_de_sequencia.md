# Catálogo de Dados — diagramas de sequência

Um diagrama por fluxo de negócio relevante (não por rota). Caminho completo:
usuário → tela → hook → BFF (controller → service) → DB2 → volta. Formato Mermaid.

> **DER:** não se aplica — o app não tem tabela própria (o schema `cur_gov` só é criado; o
> catálogo é lido ao vivo do DB2). `cur_tin.log_exec_web` (log) e a sessão são infraestrutura
> compartilhada, fora do modelo deste app.

## 1. Entrar na aplicação (SSO + gate de acesso)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant W as web (SPA)
    participant B as BFF (FastAPI)
    participant K as Keycloak
    participant A as Morlan Access API

    U->>W: abre /catalogo
    W->>B: GET /api/auth/me
    B-->>W: 401 (sem sessão)
    W->>B: redireciona para /api/auth/login
    B-->>U: 302 para o Keycloak
    U->>K: autentica (AD)
    K-->>B: /api/auth/callback?code=…
    B->>K: troca code por tokens
    B-->>U: cria sessão, Set-Cookie HttpOnly, 302 para a SPA
    U->>W: /catalogo
    W->>B: GET /api/catalog/schemas (cookie)
    B->>B: get_current_user → sessão válida (nível 1)
    B->>A: ACESSO_APP deste sistema? (nível 0)
    alt tem acesso
        A-->>B: concedido
        B-->>W: 200 + dados
    else sem acesso (ou Access API fora do ar)
        A-->>B: negado
        B-->>W: 403
    end
```

## 2. Abrir o detalhe de uma tabela (saúde dos dados)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant P as página catalogo-tabela
    participant H as hook useTableDetail
    participant C as catalog/controller
    participant S as catalog/service
    participant D as DB2 (SYSCAT + a tabela)

    U->>P: /catalogo/CUR_REF/PAIS
    P->>H: useTableDetail("CUR_REF","PAIS")
    H->>C: GET /api/catalog/schemas/CUR_REF/tables/PAIS
    C->>S: get_table_detail("CUR_REF","PAIS")  (maiúsculas)
    S->>S: valida identificadores (A–Z, 0–9, _) — senão 400
    S->>D: SELECT … FROM SYSCAT.TABLES (REMARKS, tipo)
    alt tabela não existe
        S-->>C: 404 "Tabela CUR_REF.PAIS não encontrada"
    else existe
        par colunas e chave primária
            S->>D: SELECT … FROM SYSCAT.COLUMNS
        and
            S->>D: SELECT … SYSCAT.TABCONST/KEYCOLUSE (tipo P)
        end
        S->>S: remove colunas de auditoria (N10)
        S->>D: SELECT COUNT(*), COUNT(col)… FROM "CUR_REF"."PAIS"
        S->>S: % por coluna, média = saúde, classe (N9–N12)
        S-->>C: TableDetailOut
        C-->>H: 200 (snake_case)
        H-->>P: camelCase (mapTableDetail)
        P-->>U: colunas, completude, saúde
    end
```

## 3. Dashboard — saúde dos schemas legados (amostragem)

```mermaid
sequenceDiagram
    actor U as Usuário
    participant P as página dashboard
    participant C as dashboard/controller
    participant S as dashboard/service
    participant D as DB2

    U->>P: abre o Dashboard
    P->>C: GET /api/dashboard/saude-legado
    C->>S: get_saude_legado()
    S->>D: lista de schemas (SYSCAT.TABLES agrupado)
    S->>S: separa os de camada LEGADO
    loop cada schema legado (até 8 em paralelo)
        S->>D: SELECT TABNAME … ORDER BY CARD ASC, FETCH FIRST 20
        loop candidatas, até completar 5
            S->>D: colunas + COUNT(col) da tabela (limite de 5 s)
            alt falhou (sem permissão ou lenta)
                S->>S: descarta e tenta a próxima
            else ok
                S->>S: adiciona à amostra do schema
            end
        end
    end
    S->>S: média por schema e geral; schemas sem amostra → "sem acesso" (N15)
    S-->>P: SaudeLegadoOut
    P-->>U: gráfico de colunas por schema
```

## 4. Scanner — escolher schemas e consultar

```mermaid
sequenceDiagram
    actor U as Usuário
    participant P as página scanner
    participant H as hook useSchemas
    participant B as BFF (GET /api/schemas)
    participant N as router

    U->>P: abre /scanner
    P->>H: useSchemas()
    H->>B: GET /api/schemas
    B-->>P: schemas com camada e domínio
    U->>P: escolhe "Schemas governados"
    P->>P: pré-seleciona os que não são LEGADO
    U->>P: confirma e aciona Consultar (botão ou Alt+C)
    P->>N: navega para /catalogo?filter=CUR_COM,RPT_COM…
    Note over P,N: nada é gravado — "escanear" é consultar agora
```
