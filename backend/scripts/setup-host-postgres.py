#!/usr/bin/env python3
"""Create the local PostgreSQL roles and databases used by Docker services."""

from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
SERVICES = ("identity", "customer", "driver", "booking", "trip", "payment")


def quote(value):
    return "'" + value.replace("'", "''") + "'"


def psql(sql):
    result = subprocess.run(
        ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-d", "postgres", "-At"],
        input=sql,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or "psql failed")
    return result.stdout.strip()


def main():
    values = {}
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value

    for service in SERVICES:
        password = values.get(f"{service.upper()}_DB_PASSWORD")
        if not password:
            raise RuntimeError(f"Missing {service.upper()}_DB_PASSWORD in backend/.env")
        db_name = f"{service}_db"
        if psql(f"SELECT 1 FROM pg_roles WHERE rolname = {quote(service)};"):
            psql(f'ALTER ROLE "{service}" LOGIN PASSWORD {quote(password)};')
        else:
            psql(f'CREATE ROLE "{service}" LOGIN PASSWORD {quote(password)};')
        if not psql(f"SELECT 1 FROM pg_database WHERE datname = {quote(db_name)};"):
            psql(f'CREATE DATABASE "{db_name}" OWNER "{service}";')
        print(f"{db_name}: ready")


if __name__ == "__main__":
    main()
