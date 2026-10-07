# Cab System backend (PostgreSQL on the host)

The seven application services, gateway, Kafka, Redis, MongoDB, and mock providers run in Docker Compose. The six PostgreSQL databases run on the Mac. Docker Desktop resolves `host.docker.internal` to the host; each service uses that address on port `5432`.

## First-time setup

1. Start PostgreSQL on the Mac and confirm `psql -d postgres -c 'SELECT 1'` works. The setup script needs a local PostgreSQL superuser.
2. Create `backend/.env` locally and fill in the seven database passwords (`IDENTITY_DB_PASSWORD`, `CUSTOMER_DB_PASSWORD`, `DRIVER_DB_PASSWORD`, `BOOKING_DB_PASSWORD`, `TRIP_DB_PASSWORD`, `PAYMENT_DB_PASSWORD`, `NOTIFICATION_DB_PASSWORD`). The six PostgreSQL passwords must be URL-safe because Compose inserts them into `DATABASE_URL`. Keep this file only on your machine.
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

## Requested demo dataset

The current Compose default is `SEED_ON_START=false`, so restarting services does not restore the older sample rows. To recreate the requested dataset, stop the application services while keeping Redis and MongoDB running, then run the reset script from `backend/`:

```sh
docker compose stop gateway identity-service customer-service driver-service booking-service trip-service payment-service notification-service
node scripts/reset-requested-demo-data.js
docker compose up -d --build
node scripts/verify-requested-demo-data.js
```

The reset script clears all application tables in the six PostgreSQL databases and all notification collections in MongoDB, then creates 1 admin (`admin@gmail.com`), 5 customers, 10 drivers, 45 bookings, 25 completed trips with reviews, 25 payments, and 2 pending offers. Each customer has one booking in each of `SEARCHING`, `EXPIRED`, `NO_DRIVER_FOUND`, and `CANCELED`, plus five `COMPLETED` bookings linked to the five completed trips. All accounts use password `12345678`. Driver phone `0391234568` appeared twice in the supplied list; the duplicate was removed. The reset and verification scripts access MongoDB through `docker compose exec`, because MongoDB has no published host port.

The reset script also clears Redis, rebuilds its driver GEO index, and reserves the two drivers with pending offers.

## Active booking rule

Each customer can have at most one booking in `SEARCHING` or `ASSIGNED`. A new booking returns `409 ACTIVE_BOOKING_EXISTS` while either state is active. `SEARCHING` lasts 30 minutes (`OFFER_TTL_SEC`); the booking service changes it to `EXPIRED`, expires pending offers, and releases reservations. Finishing or cancelling an assigned trip updates its booking to `COMPLETED` or `CANCELED`.

To cancel a booking before starting a new one, use the customer token and booking ID:

```sh
curl -X POST http://localhost:8000/api/v1/bookings/BOOKING_ID/cancel \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Thử tạo chuyến mới"}'
```

This endpoint cancels a `SEARCHING` booking directly and cancels an `ASSIGNED` booking through its trip. A trip already `IN_PROGRESS` cannot be cancelled through this endpoint.
