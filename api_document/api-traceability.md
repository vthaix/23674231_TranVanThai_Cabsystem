# API Traceability

| Service | Visibility | Method | Endpoint | Use Case / Requirement | Source |
|---|---|---|---|---|---|
| identity-service | Public | POST | /auth/register | UC01 / FR-C01 | srs.md §6.9.1, §8.1; microservice_design.md §5.1 |
| identity-service | Public | POST | /auth/login | UC02 / FR-C02 | srs.md §6.9.2, §8.1; microservice_design.md §5.1 |
| identity-service | Public | GET | /admin/me | Admin self profile | Current implementation |
| identity-service | Internal | POST | /internal/accounts | FR-S06 / Driver onboarding | microservice_design.md §2.2, §5.1, §6.1.2 |
| identity-service | Internal | GET | /internal/roles/{role}/permissions | FR-S03 / FR-S06 | microservice_design.md §2.2, §5.1 |
| customer-service | Public | GET | /customers/{id} | UC03 / FR-C03 | srs.md §9.1, §16.2; microservice_design.md §5.2 |
| customer-service | Public | GET | /customers/me | Customer self profile | Current implementation |
| customer-service | Internal | POST | /internal/customers | FR-S06 / Customer registration saga | microservice_design.md §2.2, §5.2, §6.1.1 |
| driver-service | Public | POST | /drivers/otp/request | UC13 / FR-D01 | srs.md §6.8, §9.2, §16.2; microservice_design.md §5.3 |
| driver-service | Public | POST | /drivers/otp/verify | UC13 / FR-D02 | srs.md §6.8, §9.2, §16.2; microservice_design.md §5.3 |
| driver-service | Public | POST | /drivers/register | UC13 / FR-D03 | srs.md §6.9.4, §9.2; microservice_design.md §5.3 |
| driver-service | Public | GET | /drivers/{id} | UC04 / FR-D04 | srs.md §9.2, §16.2; microservice_design.md §5.3 |
| driver-service | Public | GET | /drivers/me | Driver self profile | Current implementation |
| driver-service | Public | GET | /drivers/nearby | UC05 / FR-C04 | srs.md §9.1, §16.2.1; microservice_design.md §5.3 |
| driver-service | Public | PUT | /drivers/me/location | UC05 / FR-D06 | srs.md §9.2, §16.2.1; microservice_design.md §5.3 |
| driver-service | Public | PUT | /drivers/me/availability | UC15 / FR-D05 | srs.md §9.2, §16.2; microservice_design.md §5.3 |
| driver-service | Public | GET | /drivers | UC14 / FR-A01 | srs.md §9.3, §16.2; microservice_design.md §5.3 |
| driver-service | Public | GET | /drivers/{id}/application | UC14 / FR-A01 | srs.md §16.2; microservice_design.md §5.3 |
| driver-service | Public | POST | /drivers/{id}/approve | UC14 / FR-A02 | srs.md §9.3, §16.2; microservice_design.md §5.3 |
| driver-service | Public | POST | /drivers/{id}/reject | UC14 / FR-A03 | srs.md §9.3, §16.2; microservice_design.md §5.3 |
| driver-service | Internal | GET | /internal/drivers/nearby | FR-S06 / Dispatch | microservice_design.md §2.2, §5.3 |
| driver-service | Internal | POST | /internal/drivers/{id}/reservations | FR-S06 / Dispatch reservation | microservice_design.md §2.2, §5.3 |
| driver-service | Internal | DELETE | /internal/drivers/{id}/reservations/{bookingId} | FR-S06 / Dispatch reservation | microservice_design.md §2.2, §5.3 |
| driver-service | Internal | POST | /internal/drivers/{id}/busy | FR-S06 / Assignment | microservice_design.md §2.2, §5.3, §6.2 |
| driver-service | Internal | GET | /internal/drivers/{id}/summary | FR-S06 / Trip snapshot | microservice_design.md §2.2, §5.3, §5.5 |
| booking-service | Public | GET | /bookings | UC06 / FR-C05 | srs.md §9.1, §16.2.1; microservice_design.md §5.4 |
| booking-service | Public | POST | /bookings | UC07 / FR-C06–FR-C07 / FR-S13 | srs.md §9.1, §9.9, §16.2.1; microservice_design.md §5.4 |
| booking-service | Public | POST | /bookings/{id}/cancel | UC10 / FR-C09 | srs.md §9.1, §16.2.1; microservice_design.md §5.4 |
| booking-service | Public | GET | /offers | UC08 / FR-D07 | srs.md §9.2, §16.2; microservice_design.md §5.4 |
| booking-service | Public | POST | /offers/{id}/accept | UC08 / FR-D08 | srs.md §9.2, §16.2; microservice_design.md §5.4 |
| booking-service | Public | POST | /offers/{id}/reject | UC08 / FR-D07–FR-D08 | microservice_design.md §5.4 |
| trip-service | Public | GET | /trips/{id} | UC09 / FR-C08 | srs.md §9.1, §16.2; microservice_design.md §5.5 |
| trip-service | Public | GET | /trips/{id}/location | UC09 / FR-C08 | srs.md §16.2.1; microservice_design.md §5.5 |
| trip-service | Public | PATCH | /trips/{id}/status | UC09 / FR-D09 | srs.md §9.2, §16.2.1; microservice_design.md §5.5 |
| trip-service | Public | POST | /trips/{id}/cancel | UC10 / FR-C09, FR-D10 | srs.md §9.1–9.2, §16.2.1; microservice_design.md §5.5 |
| trip-service | Public | POST | /trips/{id}/reviews | UC12 / FR-C11 | srs.md §9.1, §16.2; microservice_design.md §5.5 |
| trip-service | Internal | POST | /internal/trips | FR-S06 / Assignment saga | microservice_design.md §2.2, §5.5, §6.2 |
| trip-service | Internal | GET | /internal/trips/{id} | FR-S06 / Payment validation | microservice_design.md §2.2, §5.5–5.6 |
| trip-service | Internal | POST | /internal/trips/{id}/payment-status | FR-S06 / Payment sync | microservice_design.md §2.2, §5.5–5.6 |
| payment-service | Public | POST | /payments | UC11 / FR-C10, FR-P01, FR-S13 | srs.md §6.7, §16.2.1; microservice_design.md §5.6 |
| payment-service | Public | GET | /payments/{id} | UC11 / FR-C10 | srs.md §16.2; microservice_design.md §5.6 |
| payment-service | Public | POST | /payments/callback | UC11 / FR-P02–FR-P05 | srs.md §6.7, §16.2.1; microservice_design.md §5.6 |
| notification-service | Public | GET | /notifications | FR-C12 / FR-D11 | srs.md §9.1–9.2, §16.2; microservice_design.md §5.7 |
| notification-service | Public | PATCH | /notifications/{id}/read | FR-C12 | srs.md §9.1, §16.2; microservice_design.md §5.7 |

Operational `/health` and `/ready` are defined for every service by FR-S18 / microservice_design.md §9.6 and are intentionally excluded from Public/Internal counts.
