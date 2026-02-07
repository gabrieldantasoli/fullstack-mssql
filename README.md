# fullstack-mssql

Projeto fullstack com:
- **DB:** SQL Server (Docker) com init automático (`db/init.sql`)
- **API:** Node.js (Express + TypeScript)
- **Web:** React (Vite + TypeScript)

## Estrutura

```
fullstack-mssql/
  docker-compose.yml
  .env.example
  db/
    init.sql
    Dockerfile
    entrypoint.sh
  api/
    src/
    .env.example
    package.json
  web/
    src/
    package.json
```

## Requisitos
- Node.js (LTS)
- Docker + Docker Compose

## 1) Configuração de ambiente

Crie o `.env` da raiz:
```bash
cp .env.example .env
```

Crie o `.env` da API:
```bash
cp api/.env.example api/.env
```

> **Importante:** `SA_PASSWORD` (raiz) deve ser **igual** a `DB_PASSWORD` (api/.env).

## 2) Subir o banco (SQL Server)

O container do banco executa automaticamente o `db/init.sql` ao iniciar/reiniciar.

```bash
set -a
source .env
set +a

docker compose up -d --build db
```

Ver logs (opcional):
```bash
docker logs -f mssql
```

## 3) Rodar a API

Em outro terminal:
```bash
cd api
npm install
npm run dev
```

Teste rápido:
```bash
curl http://localhost:3001/health
curl http://localhost:3001/api/tasks
```

## 4) Rodar o Frontend

Em outro terminal:
```bash
cd web
npm install
npm run dev
```

Abra o endereço exibido pelo Vite (geralmente `http://localhost:5173`).

## Comandos úteis (Docker)

Reiniciar apenas o DB (reexecuta `init.sql` no start):
```bash
docker compose restart db
```

Parar tudo:
```bash
docker compose down
```

Resetar banco (APAGA dados — dev apenas):
```bash
docker compose down -v
docker compose up -d --build db
docker compose restart db
```

## Troubleshooting

### Login failed for user 'sa'
- Confirme se `SA_PASSWORD` (raiz) == `DB_PASSWORD` (api/.env).
- Se você mudou senha depois que o volume já existia, faça reset:
  ```bash
  docker compose down -v
  docker compose up -d --build db
  ```



docker compose down -v
docker compose up -d --build db
