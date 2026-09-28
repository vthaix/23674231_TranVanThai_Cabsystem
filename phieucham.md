# BẢNG CHẤM ĐIỂM PROJECT

| Trường | Giá trị |
|---|---|
| University | IUH |
| Class | |
| Student ID | |
| Fullname | |
| Subject | MSA |

---

## Bảng chấm thực hành 1

| STT | Nội dung | Kết quả mong đợi | Max | Giảng viên chấm |
|:---:|---|---|:---:|:---:|
| 1 | Mô tả kiến trúc tổ chức source code | | 1 | |
| 2 | Kiểm tra `.gitignore` và `.env` trên GitHub | | 1 | |
| 3 | Mô tả nhiệm vụ gateway trong hệ thống | | 1 | |
| 4 | Mô tả IPC của các microservice | | 1 | |
| 5 | Compose hệ thống và liệt kê các container | | 1 | |
| 6 | **POSTMAN: API health check**<br>*Smoke:* Gọi endpoint `/health`, gọi `/ready`, gọi `/health/services` | Endpoint trả trạng thái healthy/ready và danh sách service | 1 | |
| 7 | Kiểm tra hệ thống Kafka / RabbitMQ | | 1 | |
| 8 | Kiểm tra mọi request đều phải đi qua Gateway | | 1 | |
| 9 | **POSTMAN: Đăng ký tài khoản khách hàng**<br>*Smoke:* Khách hàng chưa có tài khoản | Tài khoản được tạo; khách hàng đăng nhập được vào hệ thống | 1 | |
| 10 | **POSTMAN: Đăng nhập khách hàng**<br>*Smoke:* Khách hàng đã có tài khoản đang hoạt động | Hệ thống cấp token | 1 | |

---

## Bảng chấm thực hành 2

| STT | Nội dung | Kết quả mong đợi | Max | Giảng viên chấm |
|:---:|---|---|:---:|:---:|
| 11 | **POSTMAN: Lấy thông tin khách hàng với mã số** | Sử dụng token để xem thông tin khách hàng | 1 | |
| 12 | **POSTMAN: Lấy thông tin tài xế với mã số** | Sử dụng token để xem thông tin tài xế | 1 | |
| 13 | **POSTMAN: Liệt kê danh sách tài xế tại khu vực**<br>*Smoke:* Cần giả lập có sẵn ít nhất 5 tài xế có các trạng thái khác nhau | Danh sách Driver xung quanh tọa độ có bán kính 1km; danh sách có giới hạn (limit) và phân trang (paging) | 1 | |
| 14 | **POSTMAN: Liệt kê danh sách các booking của Customer**<br>*Smoke:* Cần giả lập có sẵn ít nhất 5 booking | Danh sách Booking liên quan đến khách hàng; danh sách có giới hạn (limit) và phân trang (paging) | 1 | |
| 15 | **POSTMAN: Đặt xe**<br>*Smoke:* Khách hàng đặt xe → Hệ thống tạo booking → Hệ thống tìm tài xế gần điểm đón → Gửi offer cho tài xế | Booking được tạo; khách hàng thấy trạng thái đang tìm tài xế | 1 | |
| 16 | **POSTMAN: Tài xế nhận chuyến**<br>*Smoke:* Tài xế nhận thông báo có chuyến → Xem thông tin chuyến → Chấp nhận | Ride/Trip được gán tài xế; khách hàng nhận thông tin tài xế | 1 | |
| 17 | **POSTMAN: Cập nhật trạng thái chuyến**<br>*Smoke:* Tài xế chuyển trạng thái đến điểm đón → Bắt đầu chuyến → Ride/Trip cập nhật vị trí di chuyển → Đến điểm kết thúc và hoàn thành chuyến | Trạng thái chuyến cập nhật đúng trình tự | 1 | |
| 18 | **POSTMAN: Hủy chuyến**<br>*Smoke:* Khách hàng chọn hủy chuyến → Cung cấp lý do → Xác nhận hủy | Ride/Trip chuyển sang `CANCELED`; các bên nhận thông báo | 1 | |
| 19 | **POSTMAN: Thanh toán online**<br>*Smoke:* Chọn thanh toán online → Thực hiện thanh toán → Hệ thống nhận callback → Kiểm tra kết quả | Payment chuyển `COMPLETED`; chuyến được ghi nhận đã thanh toán | 1 | |
| 20 | **POSTMAN: Đánh giá chuyến đi**<br>*Smoke:* Khách hàng đánh giá chuyến đi (Ride/Trip) → Chọn số sao → Nhập nhận xét → Gửi đánh giá | Review được lưu và liên kết với chuyến đi | 1 | |

---

## Bảng chấm thực hành 3

| STT | Nội dung | Kết quả mong đợi | Max | Giảng viên chấm |
|:---:|---|---|:---:|:---:|
| 21 | **POSTMAN: Đăng ký tài xế**<br>*Smoke:* Nhập số điện thoại → Xác thực OTP → Nhập thông tin cá nhân/xe → Gửi hồ sơ | Hồ sơ tài xế được tạo ở trạng thái chờ duyệt | 1 | |
| 22 | **POSTMAN: Duyệt hồ sơ tài xế**<br>*Smoke:* Quản trị viên (Admin) mở danh sách hồ sơ → Xem chi tiết → Duyệt hoặc từ chối | Trạng thái hồ sơ được cập nhật; tài xế nhận kết quả | 1 | |
| 23 | **POSTMAN: Bật/tắt trạng thái nhận chuyến**<br>*Smoke:* Tài xế chuyển trạng thái Online / Offline → hệ thống cập nhật | Trạng thái nhận chuyến thay đổi và được hệ thống ghi nhận | 1 | |
| 24 | **POSTMAN: Data encryption at rest**<br>*Smoke:* Dữ liệu lưu trong DB<br>Attacker truy cập trực tiếp DB, xem dữ liệu nhạy cảm:<br>`password = 123400` → cần được mã hóa thành `password = "X9f3k2s9...encrypted..."` | Data nhạy cảm được mã hóa<br>Không đọc được plaintext<br>Có key management | 1 | |
| 25 | **POSTMAN: SQL injection attempt**<br>*Smoke:* API nhận input từ user:<br>`{ "email": "' OR 1=1 --", "password": "anything" }` | Query không bị bypass<br>Không login thành công<br>Không lộ dữ liệu DB<br>HTTP 400 hoặc 401 | 1 | |
| 26 | **POSTMAN: XSS input test**<br>*Smoke:* API nhận input từ user:<br>`<script>alert('hack')</script>` | Script không được execute<br>Output được escape | 1 | |
| 27 | **POSTMAN: JWT tampering**<br>*Smoke:* Attacker sửa payload token:<br>`{ "sub": "user_123", "role": "USER" }` → `{ "sub": "admin_001", "role": "ADMIN" }`<br>Nếu hệ thống không kiểm tra signature → attacker thành admin | Token decode fail<br>HTTP 401<br>Không truy cập được API | 1 | |
| 28 | **POSTMAN: Unauthorized API access**<br>*Smoke:* Customer không có quyền gọi API Driver | HTTP 403 Forbidden<br>Không trả dữ liệu | 1 | |
| 29 | **POSTMAN: Rate limit attack**<br>*Smoke:* Client gửi nhiều request liên tục<br>Attacker spam API: `POST /booking` > 1000 requests/sec | HTTP 429 Too Many Requests<br>Rate limit hoạt động<br>Không làm sập hệ thống | 1 | |
| 30 | **POSTMAN: Replay attack (idempotency)**<br>*Smoke:* Attacker gửi lại request cũ (request payment cũ)<br>Request gốc: `{ "user_id": "USR123", "amount": 50000 }`<br>Attacker gửi lại request y hệt: `{ "user_id": "USR123", "amount": 50000 }` | Không xử lý lại transaction<br>Không bị double charge<br>Trả response cũ | 1 | |
