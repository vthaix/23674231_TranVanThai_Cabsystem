# Cab System backend (PostgreSQL on the host)

The seven application services, gateway, Kafka, Redis, MongoDB, and mock providers run in Docker Compose. The six PostgreSQL databases run on the Mac. Docker Desktop resolves `host.docker.internal` to the host; each service uses that address on port `5432`.

## Communication

Clients use REST/JSON at port 8000. Gateway → service and synchronous service → service calls use gRPC; Kafka remains asynchronous. Application services have no HTTP listeners and expose only internal gRPC ports 50050–50056. See [the gRPC contract and demo guide](shared/proto/README.md).

Run `npm test` to verify RPC transport, caller authentication and REST → Gateway → gRPC integration without databases. After changing source, use `docker compose up -d --build` to rebuild the application without running the data-reset build script.

## First-time setup

1. Start PostgreSQL on the Mac and confirm `psql -d postgres -c 'SELECT 1'` works. The setup script needs a local PostgreSQL superuser.
2. Create `backend/.env` locally and fill in the seven database passwords (`IDENTITY_DB_PASSWORD`, `CUSTOMER_DB_PASSWORD`, `DRIVER_DB_PASSWORD`, `BOOKING_DB_PASSWORD`, `TRIP_DB_PASSWORD`, `PAYMENT_DB_PASSWORD`, `NOTIFICATION_DB_PASSWORD`). The six PostgreSQL passwords must be URL-safe because Compose inserts them into `DATABASE_URL`. Keep this file only on your machine.
3. From `backend/`, run `python3 scripts/setup-host-postgres.py`. This creates `identity_db`, `customer_db`, `driver_db`, `booking_db`, `trip_db`, and `payment_db`, each owned by its matching service user. It can be run again after changing passwords.
4. Run `npm install`, then `npm run build`. The build command applies SQL migrations, replaces all application data with the demo seed, and starts the services.

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

## Build and demo dataset

From `backend/`, run `npm run build` each time you want to build the system. The command builds the images first, stops application services, clears records in this project's Kafka topics, runs migrations, clears application tables in all six host PostgreSQL databases plus MongoDB notifications and Redis, loads the seed in `scripts/reset-requested-demo-data.js`, verifies it, and starts fresh application containers. This deletes accounts, bookings, trips, payments, notifications, Kafka events, and other runtime data created since the previous build. Only the seed dataset is restored. PostgreSQL migration history (`_migrations`) and Docker volumes remain.

`docker compose up -d --build` builds images but does not run the reset workflow; use `npm run build` for the requested behavior. The old per-service seed functions are disabled in Compose to avoid adding extra rows after the reset.

The reset script clears all application tables in the six PostgreSQL databases and all notification collections in MongoDB, then creates 1 admin (`admin@gmail.com`), 5 customers, 11 drivers (one pending approval), 47 bookings, 27 completed trips, 26 reviews, 26 payments, and 2 pending offers. Each customer has one booking in each of `SEARCHING`, `EXPIRED`, `NO_DRIVER_FOUND`, and `CANCELED`, plus five reviewed and paid `COMPLETED` bookings. Two extra completed trips support Postman, both owned by `kh01@gmail.com`: trip `40000000-0000-4000-8000-000000000026` is paid but has no review; trip `40000000-0000-4000-8000-000000000027` has a review but is unpaid. The pending driver `dr11@gmail.com` has ID `20000000-0000-4000-8000-000000000011`, phone `0391234511`, identity status `PENDING`, and driver status `PENDING_APPROVAL`. All accounts use password `12345678`; the pending driver can log in after approval. Driver phone `0391234568` appeared twice in the supplied list; the duplicate was removed. The reset and verification scripts access MongoDB through `docker compose exec`, because MongoDB has no published host port.

The reset script also clears Redis, rebuilds its driver GEO index, and reserves the two drivers with pending offers. Seven demo drivers are ONLINE, three are OFFLINE, and one is PENDING_APPROVAL without a location. The ten active driver locations are spaced about 100 m apart around (10.7769, 106.7008); a 500 m nearby search returns the seven ONLINE drivers.

Login JWTs use a readable `sub` (`user_01` for the seeded admin, `user_02` for `kh01@gmail.com`, `user_17` for the pending driver, and so on). The signed `accountId` claim retains the UUID used by the services for database queries and authorization. New accounts receive the next `user_XX` value.

## Active booking rule

Each customer can have at most one booking in `SEARCHING` or `ASSIGNED`. A new booking returns `409 ACTIVE_BOOKING_EXISTS` while either state is active. `SEARCHING` lasts 30 minutes (`OFFER_TTL_SEC`); the booking service changes it to `EXPIRED`, expires pending offers, and releases reservations. Finishing or cancelling an assigned trip updates its booking to `COMPLETED` or `CANCELED`.

Payment is simulated without customer or driver balances. A new booking and trip start with `paymentStatus: UNPAID`. The driver advances the trip through `ARRIVED`, `IN_PROGRESS`, and `COMPLETED`. After completion, an authorized trip participant calls `POST /api/v1/payments/:tripId`; the payment record becomes `COMPLETED` and the trip and booking payment statuses become `PAID`. Repeating the call returns the existing payment.

To cancel a booking before starting a new one, use the customer token and booking ID:

```sh
curl -X POST http://localhost:8000/api/v1/bookings/BOOKING_ID/cancel \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Thử tạo chuyến mới"}'
```

This endpoint cancels a `SEARCHING` booking directly and cancels an `ASSIGNED` booking through its trip. A trip already `IN_PROGRESS` cannot be cancelled through this endpoint.
