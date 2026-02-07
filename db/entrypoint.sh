#!/usr/bin/env bash
set -euo pipefail

echo "[db] Starting SQL Server..."
/opt/mssql/bin/sqlservr &

SQL_PID="$!"

echo "[db] Waiting for SQL Server to be ready..."
for i in {1..90}; do
  if /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C -d master -Q "SELECT 1" >/dev/null 2>&1; then
    echo "[db] SQL Server is ready."
    break
  fi
  sleep 1
done

echo "[db] Running init script (/scripts/init.sql)..."
 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "${MSSQL_SA_PASSWORD}" -C -d master -i /scripts/init.sql

echo "[db] Init finished. Keeping SQL Server running..."
wait "$SQL_PID"
