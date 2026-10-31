# Cab System backend (Docker Compose)

The seven application services, Gateway, PostgreSQL, Kafka, Redis, MongoDB and mock providers run in Docker Compose. PostgreSQL has six separate databases and login roles, one per owning service. No local PostgreSQL installation is required.

## Communication

Clients use REST/JSON at port 8000. Gateway → service and synchronous service → service calls use gRPC; Kafka remains asynchronous. Application services have no HTTP listeners and expose only internal gRPC ports 50050–50056. See [the gRPC contract and demo guide](shared/proto/README.md).

Run `npm test` to verify RPC transport, caller authentication and REST → Gateway → gRPC integration without databases. After changing source, use `docker compose up -d --build` to rebuild the application without running the data-reset build script.

## First-time setup

1. Copy `.env.example` to `.env` inside `backend/`. Set eight non-empty URL-safe passwords: the PostgreSQL administrator, six service roles, and MongoDB notification user. Keep this file local; Git ignores it.
2. From `backend/`, run `docker compose up -d --build`. PostgreSQL initializes all six databases on its first start. Each service applies its migrations, then listens over gRPC. Compose waits for database health before starting dependent services.
3. Check `http://localhost:8000/health/services`. All seven services should be `up`.

Data lives in the named volumes `postgres-data` and `notification-db-data`. A normal restart preserves it. Changing passwords in `.env` does not change users already stored in initialized volumes; update the database credentials together.

## Database connections

Services connect to `postgres:5432` inside Docker using their matching database/role: `identity_db/identity`, `customer_db/customer`, `driver_db/driver`, `booking_db/booking`, `trip_db/trip`, `payment_db/payment`. MongoDB is also internal. Only Gateway publishes a public API port.

Use `docker compose exec postgres psql -U postgres -d identity_db` for SQL access. Host-side seed scripts or pgAdmin can temporarily use the optional maintenance tunnel:

```sh
docker compose --profile tools up -d postgres-tools
# Connect to localhost:5432 with the matching database, role and password.
docker compose --profile tools stop postgres-tools
```

The tunnel binds only to `127.0.0.1`; it is not started by normal Compose startup. For a first demo seed, stop the six PostgreSQL-backed application services, start the tunnel, run `node scripts/reset-requested-demo-data.js --if-empty`, then restart those services and stop the tunnel. This mode refuses to overwrite any non-empty business table and does not clear MongoDB or Redis.

## Build and demo dataset

From `backend/`, use `docker compose up -d --build` for ordinary builds. Use `npm run build` only when you intend to reset the demo dataset. The reset command temporarily starts the loopback maintenance tunnel, builds the images first, stops application services, clears records in this project's Kafka topics, runs migrations, clears application tables in all six PostgreSQL databases in Docker plus MongoDB notifications and Redis, loads the seed in `scripts/reset-requested-demo-data.js`, verifies it, and starts fresh application containers. This deletes accounts, bookings, trips, payments, notifications, Kafka events, and other runtime data created since the previous build. Only the seed dataset is restored. PostgreSQL migration history (`_migrations`) and Docker volumes remain. The maintenance tunnel is stopped when the script exits.

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
