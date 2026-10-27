#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

app_services=(
  gateway identity-service customer-service driver-service booking-service
  trip-service payment-service notification-service
  mock-payment-provider mock-map-provider
)

# Build first, so a failed image build leaves the current dataset untouched.
docker compose build "${app_services[@]}"

# No application service may write to the databases or Kafka during the reset.
docker compose stop "${app_services[@]}"
docker compose up -d --wait kafka redis notification-db
node scripts/clear-kafka-events.js
docker compose up -d kafka-init
docker compose wait kafka-init
kafka_init_id="$(docker compose ps -q -a kafka-init)"
if [[ "$(docker inspect -f '{{.State.ExitCode}}' "$kafka_init_id")" != 0 ]]; then
  echo 'Kafka topic initialization failed' >&2
  exit 1
fi

node scripts/migrate-all.js
node scripts/reset-requested-demo-data.js
node scripts/verify-requested-demo-data.js

# Start application containers with the newly built images and no legacy per-service seeds.
SEED_ON_START=false docker compose up -d --no-deps --force-recreate "${app_services[@]}"
node scripts/wait-for-services.js
