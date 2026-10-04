# Cab System backend (PostgreSQL on the host)

The seven application services, gateway, Kafka, Redis, MongoDB, and mock providers run in Docker Compose. The six PostgreSQL databases run on the Mac. Docker Desktop resolves `host.docker.internal` to the host; each service uses that address on port `5432`.

## First-time setup

1. Start PostgreSQL on the Mac and confirm `psql -d postgres -c 'SELECT 1'` works. The setup script needs a local PostgreSQL superuser.
2. Fill in the seven database passwords in `backend/.env` (copy `.env.example` if needed). The six PostgreSQL passwords must be URL-safe because Compose inserts them into `DATABASE_URL`.
3. From `backend/`, run `python3 scripts/setup-host-postgres.py`. This creates `identity_db`, `customer_db`, `driver_db`, `booking_db`, `trip_db`, and `payment_db`, each owned by its matching service user. It can be run again after changing passwords.
4. Run `docker compose up -d --build`. Each service applies its SQL migrations at startup.

PostgreSQL must accept connections from Docker Desktop to `host.docker.internal:5432`. Test from a running service with:

```sh
docker compose exec -T driver-service node -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); c.connect().then(() => c.query('SELECT current_database()')).then(r => { console.log(r.rows[0]); return c.end(); }).catch(e => { console.error(e); process.exitCode = 1; });"
```

## Database connections

| Database | User | pgAdmin host | Port |
| --- | --- | --- | --- |
| `identity_db` | `identity` | `localhost` | `5432` |
| `customer_db` | `customer` | `localhost` | `5432` |
| `driver_db` | `driver` | `localhost` | `5432` |
| `booking_db` | `booking` | `localhost` | `5432` |
| `trip_db` | `trip` | `localhost` | `5432` |
| `payment_db` | `payment` | `localhost` | `5432` |

The passwords are in `backend/.env`. In pgAdmin, register a server with host `localhost`, port `5432`, and a matching database/user. The Docker services use `host.docker.internal` instead of `localhost` because they run inside containers.

Existing PostgreSQL Docker volumes are not used by this Compose file. Keep them until you have verified the local databases and made a backup of the local PostgreSQL cluster.
