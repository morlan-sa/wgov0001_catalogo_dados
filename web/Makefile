# Contrato com a esteira da conta Deployments: ela roda `make test` neste
# diretorio antes do build da imagem e em cada pull request, com o runtime do
# catalogo e as credenciais do CodeArtifact central ja exportadas.
.PHONY: test
test:
	npm ci --no-audit --no-fund
	npm run lint
	npm run test
	npm run build
