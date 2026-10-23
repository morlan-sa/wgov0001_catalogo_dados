"""Variáveis de ambiente DEVEM ser definidas antes de qualquer import de
`app.*`, pois `app.config.Settings` é instanciada no nível de módulo."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
os.environ.setdefault("DATABASE_SCHEMA", "test_schema")
os.environ.setdefault("IAM_SCHEMA", "test_iam_schema")
os.environ.setdefault("DEBUG", "True")
os.environ.setdefault("ACCESS_GATE_DISABLED", "False")
os.environ.setdefault("APP_NAME", "test")
# Campos obrigatórios do Settings sem default — valores fictícios de teste
# (nunca credenciais reais), para a suíte rodar sem `.env` (ex.: `make test`
# na esteira). Os testes nunca conectam a Keycloak, Postgres ou DB2 reais.
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("KEYCLOAK_ISSUER", "https://keycloak.test/realms/test")
os.environ.setdefault("KEYCLOAK_CLIENT_ID", "test")
os.environ.setdefault("KEYCLOAK_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("OIDC_REDIRECT_URI", "http://localhost:8000/api/auth/callback")
os.environ.setdefault("SESSION_SECRET", "test-session-secret-0123456789abcdef")
# Os testes assumem a fonte DB2 (os testes de Postgres trocam via patch), seja
# qual for a CATALOG_SOURCE do `.env` de quem roda.
os.environ.setdefault("CATALOG_SOURCE", "db2")
# Testes nunca gravam log em banco, seja qual for o `.env` de quem roda.
os.environ.setdefault("LOG_DB_ENABLED", "False")
# Cache desligado: os testes trocam o `query` falso a cada caso.
os.environ.setdefault("CATALOG_CACHE_TTL_SECONDS", "0")
os.environ.setdefault("CATALOG_HEALTH_CACHE_TTL_SECONDS", "0")
os.environ.setdefault("DB2_HOST", "db2.test")
os.environ.setdefault("DB2_PORT", "50000")
os.environ.setdefault("DB2_DATABASE", "testdb")
os.environ.setdefault("DB2_USER", "test")
os.environ.setdefault("DB2_PASSWORD", "test")
