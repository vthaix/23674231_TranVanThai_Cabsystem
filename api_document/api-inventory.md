# API Inventory

> Báo cáo REST trước khi chuyển IPC sang gRPC. Các dòng Internal /internal/** bên dưới là lịch sử, không còn là endpoint HTTP. Hợp đồng và danh mục hiện tại: [cab.proto](../backend/shared/proto/cab.proto), [hướng dẫn gRPC](../backend/shared/proto/README.md). Các file OpenAPI chỉ mô tả REST qua Gateway.

Counts below exclude `/health` and `/ready` Operational endpoints.

| Service | Public | Internal |
|---|---:|---:|
| identity-service | 2 | 2 |
| customer-service | 1 | 1 |
| driver-service | 11 | 5 |
| booking-service | 6 | 0 |
| trip-service | 5 | 3 |
| payment-service | 3 | 0 |
| notification-service | 2 | 0 |

**Total:** 30 Public, 11 Internal.
