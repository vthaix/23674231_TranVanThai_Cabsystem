# Implementation Gap

Compared against the repository state read on 2026-10-02. Current service `src/index.js` files mainly register shared `/health` and `/ready`; business routes are not yet implemented.

| Service | Method | Endpoint | Status | Note |
|---|---|---|---|---|
| identity-service | POST | `/auth/register` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| identity-service | POST | `/auth/login` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| identity-service | POST | `/internal/accounts` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| identity-service | GET | `/internal/roles/{role}/permissions` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| customer-service | GET | `/customers/{id}` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| customer-service | POST | `/internal/customers` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | POST | `/drivers/otp/request` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | POST | `/drivers/otp/verify` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | POST | `/drivers/register` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | GET | `/drivers/{id}` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | GET | `/drivers/nearby` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | PUT | `/drivers/me/location` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | PUT | `/drivers/me/availability` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | GET | `/drivers` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | GET | `/drivers/{id}/application` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | POST | `/drivers/{id}/approve` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | POST | `/drivers/{id}/reject` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | GET | `/internal/drivers/nearby` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | POST | `/internal/drivers/{id}/reservations` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | DELETE | `/internal/drivers/{id}/reservations/{bookingId}` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | POST | `/internal/drivers/{id}/busy` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| driver-service | GET | `/internal/drivers/{id}/summary` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| booking-service | GET | `/bookings` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| booking-service | POST | `/bookings` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| booking-service | POST | `/bookings/{id}/cancel` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| booking-service | GET | `/offers` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| booking-service | POST | `/offers/{id}/accept` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| booking-service | POST | `/offers/{id}/reject` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| trip-service | GET | `/trips/{id}` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| trip-service | GET | `/trips/{id}/location` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| trip-service | PATCH | `/trips/{id}/status` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| trip-service | POST | `/trips/{id}/cancel` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| trip-service | POST | `/trips/{id}/reviews` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| trip-service | POST | `/internal/trips` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| trip-service | GET | `/internal/trips/{id}` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| trip-service | POST | `/internal/trips/{id}/payment-status` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| payment-service | POST | `/payments` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| payment-service | GET | `/payments/{id}` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| payment-service | POST | `/payments/callback` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| notification-service | GET | `/notifications` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| notification-service | PATCH | `/notifications/{id}/read` | DOCUMENTED_BUT_NOT_IMPLEMENTED | Contract exists in SRS/microservice design; no matching business route found in current service entry point. |
| booking-service | POST | `/internal/test-kafka` | IMPLEMENTED_BUT_NOT_DOCUMENTED | Test-only Kafka endpoint exists in current source; intentionally excluded from official OpenAPI contract. |
| identity-service | GET | `/health` | MATCH | Registered by shared health module. |
| identity-service | GET | `/ready` | MATCH | Registered by shared health module, but current source readiness response does not yet perform the dependency checks required by the design. |
| customer-service | GET | `/health` | MATCH | Registered by shared health module. |
| customer-service | GET | `/ready` | MATCH | Registered by shared health module, but current source readiness response does not yet perform the dependency checks required by the design. |
| driver-service | GET | `/health` | MATCH | Registered by shared health module. |
| driver-service | GET | `/ready` | MATCH | Registered by shared health module, but current source readiness response does not yet perform the dependency checks required by the design. |
| booking-service | GET | `/health` | MATCH | Registered by shared health module. |
| booking-service | GET | `/ready` | MATCH | Registered by shared health module, but current source readiness response does not yet perform the dependency checks required by the design. |
| trip-service | GET | `/health` | MATCH | Registered by shared health module. |
| trip-service | GET | `/ready` | MATCH | Registered by shared health module, but current source readiness response does not yet perform the dependency checks required by the design. |
| payment-service | GET | `/health` | MATCH | Registered by shared health module. |
| payment-service | GET | `/ready` | MATCH | Registered by shared health module, but current source readiness response does not yet perform the dependency checks required by the design. |
| notification-service | GET | `/health` | MATCH | Registered by shared health module. |
| notification-service | GET | `/ready` | MATCH | Registered by shared health module, but current source readiness response does not yet perform the dependency checks required by the design. |

## Conflicts / discrepancies

- Gateway currently proxies public routes under `/api/v1`; SRS/microservice design list canonical routes without that prefix. YAML resolves this by using Gateway server `http://localhost:8000/api/v1` while keeping canonical path names.
- Current `/ready` implementation returns a static ready response. The design requires DB/Redis/Kafka dependency checks; this is an implementation gap inside an otherwise matching route.
- Current notification-service source subscribes only to `booking.events` and contains duplicate `connectKafka()` definitions. The design requires subscriptions to identity, driver, booking, trip, payment and notification command topics.
- Current booking-service exposes `/internal/test-kafka`; it is a foundation/test endpoint, not an SRS/microservice contract endpoint.

## YAML validation

- `identity-service.yaml`: PASS (YAML parsed; required OpenAPI sections present; local $ref targets resolved).
- `customer-service.yaml`: PASS (YAML parsed; required OpenAPI sections present; local $ref targets resolved).
- `driver-service.yaml`: PASS (YAML parsed; required OpenAPI sections present; local $ref targets resolved).
- `booking-service.yaml`: PASS (YAML parsed; required OpenAPI sections present; local $ref targets resolved).
- `trip-service.yaml`: PASS (YAML parsed; required OpenAPI sections present; local $ref targets resolved).
- `payment-service.yaml`: PASS (YAML parsed; required OpenAPI sections present; local $ref targets resolved).
- `notification-service.yaml`: PASS (YAML parsed; required OpenAPI sections present; local $ref targets resolved).

OpenAPI semantic validation beyond these structural checks should also be run in Swagger Editor/your CI validator after the files are copied into the repository.
