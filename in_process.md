### Lần 1

Tiếp tục audit CAB System từ trạng thái hiện tại.

Đã PASS và có bằng chứng runtime:

* PC1 – Source Code Architecture
* PC5 – Docker Compose / Containers
* PC6 – Health Check
* PC7 – Kafka / Async Communication
* PC8 – Gateway-only Access

Trạng thái cần tiếp tục:

* PC2: local `.env` ổn, GitHub chưa xác minh đầy đủ
* PC3: Gateway routing đã chạy, nhưng JWT/RBAC/rate limiting chưa hoàn tất → PARTIAL
* PC4: Kafka async đã chứng minh, IPC tổng thể chưa đủ → PARTIAL

Khi tiếp tục:

1. Không bịa kết quả, chỉ PASS khi có bằng chứng CLI/runtime.
2. Làm theo từng PC, bắt đầu từ PC9.
3. Mỗi PC đưa đúng CLI cần chạy + câu giải thích ngắn để anh nói với giảng viên.
4. Khi xong mỗi PC, cho câu kết: “PCx đạt.”
5. Giữ kiến trúc hiện tại 7 service: identity, customer, driver, booking, trip, payment, notification.
6. Fare nằm trong trip-service là đúng, không đổi boundary.
7. Ưu tiên hoàn thiện PC9 → PC30 theo audit 30 tiêu chí.
