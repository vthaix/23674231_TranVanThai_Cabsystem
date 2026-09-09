# CAB API Specification - FR Traceability

Nguồn SRS: 23674231_TranVanThai_Cabsystem/srs.md

| File | BR | FR |
|---|---|---|
| 01_BR01_booking.yaml | BR01 | FR01-FR06 |
| 02_BR02_driver_dispatch.yaml | BR02 | FR07-FR16 |
| 03_BR03_trip_management.yaml | BR03 | FR17-FR23 |
| 04_BR04_trip_tracking.yaml | BR04 | FR24-FR27 |
| 05_BR05_payment.yaml | BR05 | FR28-FR33 |
| 06_BR06_notifications.yaml | BR06 | FR34-FR38 |
| 07_BR07_operations.yaml | BR07 | FR39-FR44 |
| 08_BR08_history.yaml | BR08 | FR45-FR48 |
| 09_BR09_ratings.yaml | BR09 | FR49-FR51 |
| 10_BR010_account.yaml | BR010 | FR52-FR55 |

## Ghi chú
- Các file dùng OpenAPI 3.0.3.
- Base URL mặc định trong spec: `http://localhost:8000/api/v1`.
- Authentication dùng Bearer JWT.
- Business Rules BRULE01-BRULE12 được phản ánh qua security, trạng thái trip/payment và validation.
- API path là đề xuất từ FR/SRS; cần đồng bộ lại với implementation thực tế nếu backend đã có route cố định.
