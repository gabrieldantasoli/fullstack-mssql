# Execução banco:

## Na raiz do projeto:
set -a
source .env
set +a

## Criar container:
docker compose up -d

## Deixar banco ON
docker exec -it mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -i /scripts/init.sql


