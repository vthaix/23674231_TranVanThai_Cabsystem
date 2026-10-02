# Smoke test PC6–PC30

`phieucham.md` has 30 numbered criteria. This suite checks the 25 criteria from PC6 through PC30 through the gateway plus read-only Compose/DB inspections for PC7, PC8, and PC24.

## Run

From `backend/`:

```sh
docker compose up -d --build
npm run smoke:pc6-pc30
```

The script exits with code 0 only when all 25 checks pass. It prints one PASS/FAIL line per criterion. `CAB_BASE_URL` overrides the default `http://localhost:8000`. `SEED_PASSWORD` and `PAYMENT_CALLBACK_SECRET` must match the corresponding Compose settings if customized.

The suite creates unique customer, driver, booking, trip, payment, notification, and Kafka topic records on each run. It uses the development OTP returned by the API, so run it against the local development stack. It does not clear existing volumes or other users' data. PC24 inspects stored ciphertext and bcrypt hashes through `docker compose exec`; key rotation and production secret storage need separate operational checks.
