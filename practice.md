# Kịch bản demo theo `phieucham.md`

Các mục có chữ POSTMAN trong phiếu chấm là **PC6 và PC9–PC30**. Mỗi bảng chỉ có Method, URL, Data body, loại token và Idempotency-Key. Đặt `baseUrl = http://localhost:8000` trong Postman; với JSON, chọn **Body → raw → JSON**. Ở cột token, chọn **Authorization → Bearer Token** và nhập biến tương ứng; `Không` nghĩa là không gửi Authorization. Với `Có: ...`, thêm header `Idempotency-Key` mang giá trị sau dấu hai chấm. Sao chép ID, token và OTP từ response vào các biến Postman được nhắc trong URL/body. PC15 chỉ gửi pickup, destination và vehicleType; phương thức thanh toán mặc định BANK. PC29 gửi request bằng Collection Runner 55 lần liên tiếp.

Thứ tự dùng để tránh booking đang hoạt động cản booking mới: PC9–PC14 → PC21–PC23 → PC15–PC17 → PC19–PC20 → PC18 → PC24–PC30. Số điện thoại/email ví dụ cần đổi nếu đã được đăng ký.

## Thực hành 1

### PC1 – Kiến trúc source code

Mở `backend/` trong IDE: `gateway/`, `shared/`, `services/` (identity, customer, driver, booking, trip, payment, notification), `mocks/` và `docker-compose.yml`.

Trình bày: “Source được tổ chức theo microservice, mỗi service phụ trách một nghiệp vụ và có Dockerfile riêng. Gateway nhận REST từ client; Gateway và các service giao tiếp đồng bộ bằng gRPC. Kafka xử lý sự kiện bất đồng bộ. Trong service, routes → controllers → services → repositories phân chia phần nhận request, xử lý nghiệp vụ và truy vấn dữ liệu. Thư mục shared chứa JWT, mã hóa, validation và hợp đồng gRPC tại shared/proto/cab.proto.”

### PC2 – `.gitignore` và `.env` trên GitHub

Mở nhánh hiện tại trên GitHub. Repository này không đưa `.env`, `.env.example` hay `.gitignore` lên nhánh; các file cần dùng chỉ giữ ở máy local. Vì vậy không thể trình bày `.gitignore` trên GitHub như câu chữ PC2.

### PC3 – Nhiệm vụ Gateway

Mở [Gateway](backend/gateway/src/index.js) và chỉ route map, xác minh JWT, rate limit. Các API nghiệp vụ bên dưới đều đi qua cổng 8000.

### PC4 – IPC giữa các service

Trình bày: “IPC đồng bộ sử dụng gRPC trên HTTP/2, hợp đồng được khai báo trong file .proto. Ví dụ Identity gọi CustomerService.CreateCustomer khi đăng ký; Booking gọi DriverService.FindNearby, ReserveDriver và TripService.CreateTrip khi đặt xe, nhận chuyến. Mỗi lời gọi mang service token và request ID; server kiểm tra caller theo từng RPC. IPC bất đồng bộ dùng Kafka: Booking ghi event vào outbox, publisher gửi lên booking.events, Notification nhận và xử lý thông báo.”

Mở các file minh chứng:

- `backend/shared/proto/cab.proto`: hợp đồng service và RPC.
- `backend/shared/src/grpc/transport.js`: gRPC client/server, metadata, deadline.
- `backend/services/booking-service/src/services/booking.service.js`: gọi FindNearby và ReserveDriver.
- `backend/services/notification-service/src/workers/kafka.consumer.js`: consumer Kafka.

```mermaid
flowchart LR
  Client -->|REST| Gateway
  Gateway -->|gRPC GatewayApi.Invoke| Booking
  Booking -->|gRPC FindNearby / ReserveDriver| Driver
  Booking -->|gRPC CreateTrip| Trip
  Booking -->|Outbox| Kafka
  Kafka --> Notification
```

Chi tiết cổng và danh mục RPC: [gRPC](backend/shared/proto/README.md).

### PC5 – Docker Compose và container

Mở `backend/docker-compose.yml` và Docker Desktop: chỉ Gateway, 7 service, Kafka, Redis, MongoDB và mock provider. PostgreSQL của dự án chạy trên host.

### PC6 – POSTMAN: API health check

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| GET | `{{baseUrl}}/health` | Không | Không | Không |
| GET | `{{baseUrl}}/ready` | Không | Không | Không |
| GET | `{{baseUrl}}/health/services` | Không | Không | Không |

### PC7 – Kafka/RabbitMQ

Mở Compose để chỉ Kafka, topic `booking.events` và consumer của notification-service. Có thể dùng booking ở PC15 rồi xem notification của Customer để minh họa sự kiện `booking.created`.

### PC8 – Mọi request của client qua Gateway

Trình bày: “Client chỉ truy cập REST qua Gateway ở cổng 8000. Gateway kiểm tra JWT, phân quyền, rate limit và chuyển yêu cầu đến service bằng gRPC. Chỉ Gateway publish cổng ra host; bảy service chỉ mở cổng gRPC nội bộ 50050–50056, không mở HTTP listener. RPC cho Gateway yêu cầu token có issuer gateway; RPC nghiệp vụ có allowlist caller riêng.”

Minh chứng:

1. Mở `backend/docker-compose.yml`: chỉ Gateway có `ports: 8000:8000`.
2. Chạy `docker compose ps` trong `backend/`: cổng gRPC chỉ hiển thị dạng `50053/tcp`, không có mapping host.
3. Gọi `GET http://localhost:8000/health/services`: Gateway kiểm tra đủ bảy service qua gRPC.
4. Gọi API qua `http://localhost:8000/api/v1/...`; thử `http://localhost:3003/health` hoặc gRPC tại `localhost:50053` sẽ không kết nối tới container khi không publish cổng.

“Mọi request” ở đây là request từ client. Các service gọi trực tiếp nhau qua gRPC trong mạng Docker.

### PC9 – POSTMAN: Đăng ký Customer

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/auth/register` | `{"fullName":"Khach Demo","email":"khachdemo01@example.com","phone":"0912345001","password":"DemoPass@123"}` | Không | Không |

### PC10 – POSTMAN: Đăng nhập Customer

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/auth/login` | `{"email":"khachdemo01@example.com","password":"DemoPass@123"}` | Không | Không |
| POST | `{{baseUrl}}/api/v1/auth/login` | `{"email":"admin@gmail.com","password":"12345678"}` | Không | Không |

## Thực hành 2

### PC11 – POSTMAN: Lấy Customer theo ID

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| GET | `{{baseUrl}}/api/v1/customers/{{customerId}}` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/customers/me` | Không | Customer (`{{customerToken}}`) | Không |

### PC12 – POSTMAN: Lấy Driver theo ID

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| GET | `{{baseUrl}}/api/v1/drivers/20000000-0000-4000-8000-000000000001` | Không | Customer (`{{customerToken}}`) | Không |

### PC13 – POSTMAN: Driver quanh khu vực, limit, paging

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| GET | `{{baseUrl}}/api/v1/drivers?page=1&limit=50` | Không | Admin (`{{adminToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers/nearby?lat=10.7769&lng=106.7008&radius=1000&limit=5&page=1` | Không | Không | Không |
| GET | `{{baseUrl}}/api/v1/drivers/nearby?lat=10.7769&lng=106.7008&radius=1000&limit=1&page=1` | Không | Không | Không |
| GET | `{{baseUrl}}/api/v1/drivers/nearby?lat=10.7769&lng=106.7008&radius=1000&limit=1&page=2` | Không | Không | Không |

### PC14 – POSTMAN: Booking của Customer

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/auth/login` | `{"email":"kh01@gmail.com","password":"12345678"}` | Không | Không |
| GET | `{{baseUrl}}/api/v1/bookings?limit=2&page=1` | Không | Customer mẫu (`{{seedCustomerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/bookings?limit=2&page=2` | Không | Customer mẫu (`{{seedCustomerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/bookings/{{seedBookingId}}` | Không | Customer mẫu (`{{seedCustomerToken}}`) | Không |

### PC15 – POSTMAN: Đặt xe và tìm Driver

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/bookings` | `{"pickup":{"lat":10.7901,"lng":106.7101},"destination":{"lat":10.8001,"lng":106.7201},"vehicleType":"BIKE"}` | Customer (`{{customerToken}}`) | Có: `demo-ride-001` |
| GET | `{{baseUrl}}/api/v1/bookings/{{bookingId}}` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/offers` | Không | Driver (`{{driverToken}}`) | Không |

### PC16 – POSTMAN: Driver nhận chuyến

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| GET | `{{baseUrl}}/api/v1/offers` | Không | Driver (`{{driverToken}}`) | Không |
| POST | `{{baseUrl}}/api/v1/bookings/{{bookingId}}/accept` | Không | Driver (`{{driverToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/trips/{{tripId}}` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/bookings/{{bookingId}}` | Không | Customer (`{{customerToken}}`) | Không |

### PC17 – POSTMAN: Trạng thái chuyến theo trình tự

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| PATCH | `{{baseUrl}}/api/v1/trips/{{tripId}}/status` | `{"status":"ARRIVED","lat":10.7901,"lng":106.7101}` | Driver (`{{driverToken}}`) | Không |
| PATCH | `{{baseUrl}}/api/v1/trips/{{tripId}}/status` | `{"status":"IN_PROGRESS","lat":10.7950,"lng":106.7150}` | Driver (`{{driverToken}}`) | Không |
| PATCH | `{{baseUrl}}/api/v1/trips/{{tripId}}/status` | `{"status":"COMPLETED","lat":10.8001,"lng":106.7201}` | Driver (`{{driverToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/trips/{{tripId}}` | Không | Customer (`{{customerToken}}`) | Không |

### PC18 – POSTMAN: Hủy chuyến và thông báo

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/bookings` | `{"pickup":{"lat":10.7901,"lng":106.7101},"destination":{"lat":10.8001,"lng":106.7201},"vehicleType":"BIKE"}` | Customer (`{{customerToken}}`) | Có: `demo-cancel-trip-001` |
| GET | `{{baseUrl}}/api/v1/offers` | Không | Driver (`{{driverToken}}`) | Không |
| POST | `{{baseUrl}}/api/v1/bookings/{{cancelBookingId}}/accept` | Không | Driver (`{{driverToken}}`) | Không |
| POST | `{{baseUrl}}/api/v1/bookings/{{cancelBookingId}}/cancel` | `{"reason":"Khach doi lich"}` | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/trips/{{cancelTripId}}` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/notifications?limit=20` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/notifications?limit=20` | Không | Driver (`{{driverToken}}`) | Không |

### PC19 – POSTMAN: Thanh toán online

Chuyến mẫu chưa thanh toán: đăng nhập `kh01@gmail.com` / `12345678`, dùng `tripId = 40000000-0000-4000-8000-000000000027` để thử API thanh toán.

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| GET | `{{baseUrl}}/api/v1/customers/me` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/payments/{{tripId}}` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers/me` | Không | Driver (`{{driverToken}}`) | Không |
| POST | `{{baseUrl}}/api/v1/payments/{{tripId}}` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/payments/{{tripId}}` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/trips/{{tripId}}` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers/me` | Không | Driver (`{{driverToken}}`) | Không |

### PC20 – POSTMAN: Đánh giá chuyến đi

Chuyến mẫu chưa có review: đăng nhập `kh01@gmail.com` / `12345678`, dùng `tripId = 40000000-0000-4000-8000-000000000026` để gửi đánh giá.

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/trips/{{tripId}}/reviews` | `{"stars":5,"comment":"Tai xe dung gio"}` | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/trips/{{tripId}}` | Không | Customer (`{{customerToken}}`) | Không |

## Thực hành 3

### PC21 – POSTMAN: Đăng ký Driver bằng OTP

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/drivers/otp/request` | `{"phone":"0912345002"}` | Không | Không |
| POST | `{{baseUrl}}/api/v1/drivers/otp/verify` | `{"phone":"0912345002","otp":"{{otp}}"}` | Không | Không |
| POST | `{{baseUrl}}/api/v1/drivers/register` | `{"registrationToken":"{{registrationToken}}","email":"taixe.demo@example.com","phone":"0912345002","password":"TaiXeDemo@123","fullName":"Tai Xe Demo","license":{"class":"A1"},"vehicle":{"type":"BIKE","model":"Wave"}}` | Không | Không |

### PC22 – POSTMAN: Admin duyệt/từ chối Driver

Tài xế mẫu đang chờ duyệt: `driverId = 20000000-0000-4000-8000-000000000011` (`dr11@gmail.com`, điện thoại `0391234511`). Có thể dùng ID này để thử API duyệt mà không cần đăng ký lại.

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| GET | `{{baseUrl}}/api/v1/drivers?status=PENDING_APPROVAL` | Không | Admin (`{{adminToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers/{{driverId}}/application` | Không | Admin (`{{adminToken}}`) | Không |
| POST | `{{baseUrl}}/api/v1/drivers/{{driverId}}/approve` | `{}` | Admin (`{{adminToken}}`) | Không |
| POST | `{{baseUrl}}/api/v1/auth/login` | `{"phone":"0391234511","password":"12345678"}` | Không | Không |
| GET | `{{baseUrl}}/api/v1/notifications?limit=20` | Không | Driver (`{{driverToken}}`) | Không |

### PC23 – POSTMAN: Online/Offline

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| PUT | `{{baseUrl}}/api/v1/drivers/me/location` | `{"lat":10.7901,"lng":106.7101}` | Driver (`{{driverToken}}`) | Không |
| PUT | `{{baseUrl}}/api/v1/drivers/me/availability` | `{"status":"ONLINE"}` | Driver (`{{driverToken}}`) | Không |
| PUT | `{{baseUrl}}/api/v1/drivers/me/availability` | `{"status":"OFFLINE"}` | Driver (`{{driverToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers/{{driverId}}` | Không | Driver (`{{driverToken}}`) | Không |
| PUT | `{{baseUrl}}/api/v1/drivers/me/availability` | `{"status":"ONLINE"}` | Driver (`{{driverToken}}`) | Không |

### PC24 – POSTMAN: Mã hóa dữ liệu lúc lưu

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| GET | `{{baseUrl}}/api/v1/auth/demo/storage/{{customerId}}` | Không | Admin (`{{adminToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers/{{driverId}}/storage` | Không | Admin (`{{adminToken}}`) | Không |

### PC25 – POSTMAN: SQL injection

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/auth/login` | `{"email":"' OR 1=1 --","password":"anything"}` | Không | Không |

### PC26 – POSTMAN: XSS input

Tạo booking với body `{"pickup":{"lat":10.85,"lng":106.75},"destination":{"lat":10.86,"lng":106.76},"vehicleType":"BIKE"}` qua `POST {{baseUrl}}/api/v1/bookings`, dùng Customer token và header `Idempotency-Key: demo-xss-booking-001`. Lưu ID vào `xssBookingId`.

Gọi `POST {{baseUrl}}/api/v1/bookings/{{xssBookingId}}/cancel` với Customer token và body `{"reason":"<script>alert('hack')</script>"}`. Kiểm tra `cancelReason` trong response được escape thành `&lt;script&gt;...`, không chứa thẻ script thô. Có thể gọi `GET {{baseUrl}}/api/v1/bookings/{{xssBookingId}}` để xem dữ liệu đã lưu.

### PC27 – POSTMAN: JWT tampering

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| GET | `{{baseUrl}}/api/v1/drivers` | Không | Customer (`{{customerToken}}`) | Không |
| POST | `{{baseUrl}}/api/v1/demo/jwt-tampered` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers` | Không | Token đã sửa (`{{tamperedToken}}`) | Không |

### PC28 – POSTMAN: Truy cập API trái quyền

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| PUT | `{{baseUrl}}/api/v1/drivers/me/availability` | `{"status":"ONLINE"}` | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers` | Không | Không | Không |

### PC29 – POSTMAN: Rate limit

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/booking` | `{"pickup":{"lat":10.7901,"lng":106.7101},"destination":{"lat":10.8001,"lng":106.7201},"vehicleType":"BIKE"}` | Customer (`{{customerToken}}`) | Có: `demo-rate-limit-001` |
| GET | `{{baseUrl}}/api/v1/drivers/nearby?limit=1` | Không | Không | Không |
| GET | `{{baseUrl}}/health` | Không | Không | Không |

### PC30 – POSTMAN: Replay/idempotency

| Method | URL | Data body | Loại token | Idempotency-Key |
|---|---|---|---|---|
| POST | `{{baseUrl}}/api/v1/bookings` | `{"pickup":{"lat":10.7901,"lng":106.7101},"destination":{"lat":10.8001,"lng":106.7201},"vehicleType":"BIKE"}` | Customer (`{{customerToken}}`) | Có: `demo-ride-001` |
| GET | `{{baseUrl}}/api/v1/customers/me` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/payments/{{tripId}}` | Không | Customer (`{{customerToken}}`) | Không |
| POST | `{{baseUrl}}/api/v1/bookings` | `{"pickup":{"lat":10.7901,"lng":106.7101},"destination":{"lat":10.8001,"lng":106.7201},"vehicleType":"BIKE"}` | Customer (`{{customerToken}}`) | Có: `demo-ride-001` |
| POST | `{{baseUrl}}/api/v1/bookings` | `{"pickup":{"lat":10.7901,"lng":106.7101},"destination":{"lat":10.8001,"lng":106.7211},"vehicleType":"BIKE"}` | Customer (`{{customerToken}}`) | Có: `demo-ride-001` |
| POST | `{{baseUrl}}/api/v1/payments/{{tripId}}` | Không | Customer (`{{customerToken}}`) | Không |
| GET | `{{baseUrl}}/api/v1/drivers/me` | Không | Driver (`{{driverToken}}`) | Không |
