# Contrato com a esteira da conta Deployments: ela roda `make test` neste
# diretorio antes do build da imagem e em cada pull request, com o runtime do
# catalogo e as credenciais do CodeArtifact central ja exportadas.
.PHONY: test
test:
	uv sync --frozen
	uv run ruff check .
	uv run pytest -q
