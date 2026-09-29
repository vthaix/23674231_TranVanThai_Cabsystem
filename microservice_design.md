# Microservice Design rút gọn — CAB System

> Thay thế `microservice_design.md` (2.900 dòng, 11 bounded context, 3 loại DB, 78 endpoint).
> Nguồn nghiệp vụ: `02_srs_simplified.md`. Mục tiêu duy nhất: chạy đủ 30 tiêu chí trong `phieucham.md`.

---

## 1. Nguyên tắc rút gọn

| Giữ | Bỏ |
|---|---|
| Mỗi service một database riêng | DDD đầy đủ (Aggregate/Value Object/Domain Service tách lớp) |
| Gateway là điểm vào duy nhất | Mongo cho notification (dùng chung Postgres) |
| 1 message broker (RabbitMQ) cho việc bất đồng bộ thật sự cần (notification, tổng hợp trạng thái) | Saga phức tạp, event versioning, contracts/schemas riêng |
| REST nội bộ cho gọi đồng bộ bắt buộc (booking cần hỏi driver còn trống không) | BC10 Operations, BC11 Reporting & Audit |
| Cấu trúc thư mục phẳng `routes → service → repository` | Cấu trúc `domain/application/infrastructure/interfaces` 4 lớp |

## 2. Danh sách service

| # | Service | Thay cho BC cũ | Database | Vai trò | FR liên quan | Business Process phục vụ (SRS mục 4) |
|---|---|---|---|---|---|---|
| 0 | `gateway` | — (mới) | Redis (rate limit, OTP) | Điểm vào duy nhất, auth, RBAC, rate limit, health | FR-01–07 | Xuyên suốt mọi workflow |
| 1 | `identity-service` | BC01 (rút gọn) | `cab_identity_db` (Postgres) | Account, login, JWT | FR-10, 11, 12, 15, 40, 43 | Đăng ký/Đăng nhập (mục 1 sơ đồ tổng); Tài xế đăng ký — bước 1–3 (mục 4.4) |
| 2 | `user-service` | BC02 + BC03 | `cab_user_db` (Postgres) | Hồ sơ Customer, hồ sơ Driver, duyệt Driver, availability, location, tìm tài xế theo bán kính | FR-13, 14, 15–20, 41 | Tài xế đăng ký & duyệt (mục 4.4); Đặt xe — bước tìm ứng viên (mục 4.1 bước 3) |
| 3 | `booking-service` | BC04 + BC05 | `cab_booking_db` (Postgres) | Booking, tìm & gửi Offer, Offer accept | FR-21–26, 46 | Đặt xe → nhận chuyến (mục 4.1) |
| 4 | `trip-service` | BC06 + BC08 (Feedback nhập vào) | `cab_trip_db` (Postgres) | Vòng đời Trip, fare, review | FR-30–33, 36, 47 | Thực hiện chuyến (mục 4.2); Đánh giá (mục 4.3 bước 3) |
| 5 | `payment-service` | BC07 (rút gọn, bỏ Fare API riêng) | `cab_payment_db` (Postgres) | Payment online + callback, idempotency | FR-34, 35, 46, 47 | Thanh toán (mục 4.3 bước 1–2) |
| 6 | `notification-service` | BC09 | `cab_notification_db` (Postgres) | Nhận event, lưu, cho xem theo user | FR-37 | Hỗ trợ tất cả workflow (chỉ tiêu thụ event, không khởi tạo workflow) |

**Database Type**: chỉ dùng 2 trong 3 loại được phép (**PostgreSQL**, Redis) — không dùng MongoDB vì không có dữ liệu dạng semi-structured/volume lớn nào cần đến (notification cũng chỉ là bảng quan hệ đơn giản, để chung Postgres cho gọn thay vì tách thêm 1 loại DB).

Đã bỏ hoàn toàn: BC10 Operations, BC11 Reporting & Audit — không có tiêu chí nào cần.

```mermaid
flowchart LR
    C[Client / Postman] --> GW[API Gateway]
    GW --> ID[identity-service]
    GW --> US[user-service]
    GW --> BK[booking-service]
    GW --> TR[trip-service]
    GW --> PM[payment-service]
    GW --> NT[notification-service]

    BK -. REST nội bộ: driver còn trống? .-> US
    TR -. REST nội bộ: fare cần gì .-> BK

    BK -. event .-> MQ[(RabbitMQ)]
    TR -. event .-> MQ
    PM -. event .-> MQ
    US -. event .-> MQ
    MQ -. consume .-> NT
```

## 3. Cấu trúc thư mục

```text
cab-system/
├── gateway/
│   └── src/{routes,middlewares,config}/
├── services/
│   ├── identity-service/src/{routes,services,repositories,db}/
│   ├── user-service/src/{routes,services,repositories,db}/
│   ├── booking-service/src/{routes,services,repositories,db}/
│   ├── trip-service/src/{routes,services,repositories,db}/
│   ├── payment-service/src/{routes,services,repositories,db}/
│   └── notification-service/src/{routes,services,repositories,db}/
├── db/
│   └── init/*.sql            # mỗi service 1 file tạo bảng + seed
├── postman/
│   └── CAB_System_30_criteria.postman_collection.json
├── docs/
│   └── seed-accounts.md
└── docker-compose.yml
```

Mỗi service dùng đúng 1 mẫu:

```text
<service>/src/
├── routes/*.routes.js        # định nghĩa endpoint, validate input
├── services/*.service.js     # business rule
├── repositories/*.repo.js    # SQL, tham số hóa
├── db/pool.js
└── server.js
```

Không tách `domain/application/infrastructure` — hệ thống nhỏ, tách 4 lớp sẽ chỉ tạo file rỗng chuyển tiếp cho nhau.

## 4. API Gateway

### 4.1. Nhiệm vụ (đáp ứng PC 3, 8)

1. **Routing** — map `/api/v1/...` sang đúng service qua network nội bộ Docker.
2. **Xác thực** — verify JWT (HS256), gắn `req.user = { id, role }`.
3. **Phân quyền** — bảng route → role cho phép; sai quyền → 403.
4. **Rate limit** — Redis, theo IP và theo user.
5. **Sanitize input** — escape HTML trong `body` trước khi forward.
6. **Health aggregation** — `/health`, `/ready`, `/health/services`.

Chỉ `gateway` publish port ra host (`8080:8080`); 6 service còn lại không có `ports:` trong compose, chỉ giao tiếp qua Docker network nội bộ — đáp ứng PC 8 ("mọi request đều phải đi qua Gateway").

### 4.2. Route công khai (không cần token)

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/driver/otp/request
POST /api/v1/auth/driver/otp/verify
POST /api/v1/auth/driver/register
POST /api/v1/payments/callback        # xác thực bằng chữ ký, không bằng JWT
```

### 4.3. Bảng RBAC (rút gọn, ví dụ)

| Route pattern | CUSTOMER | DRIVER | ADMIN |
|---|:-:|:-:|:-:|
| `POST /bookings` | ✓ | – | – |
| `GET /drivers/nearby` | ✓ | – | ✓ |
| `POST /offers/:id/accept` | – | ✓ | – |
| `PATCH /trips/:id/status` | – | ✓ | – |
| `GET /driver-applications` | – | – | ✓ |
| `PATCH /driver-applications/:id/review` | – | – | ✓ |
| `GET /customers/:id`, `GET /drivers/:id` | chủ sở hữu | chủ sở hữu | ✓ |

**Ranh giới trách nhiệm role-check (gateway) vs ownership-check (service)**: Gateway chỉ tự kiểm tra được "chủ sở hữu" khi `id` trong path chính là account id của người gọi — đúng cho `/customers/:id`, `/drivers/:id`. Với mọi route khác trong bảng trên và các route không liệt kê (`GET /bookings/:id`, `GET /trips/:id`, `GET /offers/:id`, `GET /payments/:id`...), `id` trong path là id của **resource**, không phải account id, nên gateway **không có cách nào** tự biết ai là chủ mà không tự ý gọi vào business logic của service khác (sai nguyên tắc tách bounded context). Với các route này, gateway chỉ làm đúng việc của nó là check **role** (bảng trên) và gắn header `X-User-Id`, `X-User-Role` khi forward; **service sở hữu resource đó phải tự so `resource.customerId`/`resource.driverId` với `X-User-Id`** trước khi trả dữ liệu, sai thì tự trả 403. Đây là lý do PC #28 không thể coi là "gateway lo hết" — thiếu bước này ở tầng service là lỗ hổng IDOR (đã từng xảy ra ở bản code cũ, xem `04_audit.md` mục 2.2).

### 4.4. Health endpoints (PC 6)

```text
GET /health              -> { "status": "UP" }
GET /ready               -> { "status": "READY" }   # kiểm tra Redis + tối thiểu 1 service phản hồi
GET /health/services     -> {
  "identity-service": "UP",
  "user-service": "UP",
  "booking-service": "UP",
  "trip-service": "UP",
  "payment-service": "UP",
  "notification-service": "UP"
}
```

## 5. IPC — giao tiếp giữa các service (PC 4)

### 5.1. Đồng bộ (REST nội bộ, `axios`/`fetch`, timeout 2s, có retry 1 lần)

| Gọi từ | Gọi đến | Endpoint | Khi nào |
|---|---|---|---|
| `identity-service` | `user-service` | `POST /internal/customers` | Ngay sau khi tạo `accounts` cho Customer, tạo profile tương ứng |
| `user-service` | `identity-service` | `POST /internal/accounts` | Khi driver hoàn tất đăng ký (sau OTP), tạo `accounts` cho Driver trước khi tạo `drivers` |
| `user-service` | `identity-service` | `DELETE /internal/accounts/:id` | Rollback nếu tạo `accounts` thành công nhưng tạo `drivers` thất bại |
| `booking-service` | `user-service` | `GET /internal/drivers/nearby?lat&lng&radius&vehicleType` | Khi tạo Booking, tìm ứng viên |
| `booking-service` | `user-service` | `GET /internal/drivers/:id` | Khi Offer được accept, lấy thông tin tài xế mới nhất để làm `driver_snapshot` (dữ liệu lúc tìm kiếm có thể đã cũ) |
| `booking-service` | `user-service` | `POST /internal/drivers/:id/reserve` | Khi Offer được accept, khóa tài xế thành `BUSY` |
| `booking-service` | `trip-service` | `POST /internal/trips` | Khi Offer được accept: đẩy toàn bộ dữ liệu cần thiết (bookingId, customerId, driverId, driverSnapshot, pickup/destination, vehicleType) sang trip-service để tạo Trip, nhận về `tripId` |
| `trip-service` | `user-service` | `POST /internal/drivers/:id/release` | Khi Trip `COMPLETED`/`CANCELED`, trả tài xế về `ONLINE` |
| `payment-service` | `trip-service` | `GET /internal/trips/:id` | Lấy `fare` thật, không tin số tiền client gửi |
| gateway | tất cả | `GET /health`, `GET /ready` | Health aggregation |

**Lưu ý về hướng gọi**: `booking-service` là nơi điều phối luồng accept (nó nhận request, biết booking/offer nào) nên nó **chủ động đẩy** dữ liệu sang `trip-service` bằng `POST /internal/trips`, thay vì để `trip-service` tự quay lại hỏi `booking-service` — tránh phụ thuộc ngược chiều và một lời gọi round-trip thừa.

### 5.2. Bất đồng bộ (RabbitMQ, exchange `cab.events` loại `topic`)

| Routing key | Publisher | Consumer | Payload chính |
|---|---|---|---|
| `driver.application.submitted` | user-service | notification-service | `driverId` |
| `driver.application.reviewed` | user-service | notification-service | `driverId`, `decision`, `reason?` |
| `booking.offer_created` | booking-service | notification-service | `bookingId`, `driverId` |
| `booking.no_driver_found` | booking-service | notification-service | `bookingId`, `customerId` |
| `trip.assigned` | booking-service | notification-service | `tripId`, `customerId`, `driverSnapshot` |
| `trip.canceled` | trip-service | notification-service | `tripId`, `reason`, `canceledBy` |
| `trip.completed` | trip-service | notification-service | `tripId`, `fare` |
| `payment.completed` | payment-service | notification-service | `tripId`, `amount` |

Dùng RabbitMQ (không phải Kafka) vì khối lượng thấp, cần queue đơn giản có UI quản lý dễ demo cho PC 7. Mỗi service publish qua `amqplib`, `notification-service` là consumer duy nhất, queue `notification.queue` bind vào toàn bộ routing key trên qua wildcard `#`.

## 6. Chi tiết từng service

### 6.1. identity-service

**API công khai**

| Method | Endpoint | PC# |
|---|---|:-:|
| POST | `/api/v1/auth/register` | 9 |
| POST | `/api/v1/auth/login` | 10 |
| POST | `/api/v1/auth/driver/otp/request` | 21 |
| POST | `/api/v1/auth/driver/otp/verify` | 21 |

`POST /auth/driver/otp/verify` trả `registrationToken` = JWT `{ phone, purpose: "driver_registration", exp: now + 15p }`, ký HS256 bằng `JWT_SECRET` dùng chung — user-service tự verify được token này mà không cần gọi lại identity-service (xem mục 6.2).

**Internal API**

```text
GET    /internal/accounts/:id/status
POST   /internal/accounts              # gọi bởi user-service khi driver hoàn tất đăng ký sau OTP
                                        # body: { role, phone, passwordHash } -> trả { accountId }
DELETE /internal/accounts/:id          # rollback, gọi bởi user-service nếu tạo drivers thất bại
                                        # sau khi accounts đã tạo thành công
```

**Database `cab_identity_db`**

```text
accounts
- id UUID PK
- email UNIQUE NULL
- phone_hash UNIQUE NULL     -- HMAC-SHA256(PHONE_HASH_PEPPER, phone), KHÔNG dùng hash trần
                             -- (số điện thoại VN entropy thấp, hash trần dò ngược được)
- password_hash
- role  ENUM(CUSTOMER, DRIVER, ADMIN)
- status ENUM(ACTIVE, LOCKED)
- created_at, updated_at
```

OTP không lưu Postgres — lưu Redis (gateway hoặc identity-service dùng chung Redis instance) với TTL 5 phút, key `otp:driver:<phone>`.

**Ngôn ngữ thống nhất (Ubiquitous Language)**

| Thuật ngữ | Định nghĩa |
|---|---|
| Account | Bản ghi định danh (email/phone/password/role), **không** chứa họ tên hay thông tin hồ sơ |
| Login | Xác thực bằng `email` + `password`, trả về JWT |
| OTP | Mã 6 số dùng 1 lần để xác minh số điện thoại tài xế trước khi cho đăng ký hồ sơ |
| Registration Token | JWT tạm (15 phút) chứng minh đã qua bước OTP, dùng để hoàn tất đăng ký driver |

**ERD**

```mermaid
erDiagram
    ACCOUNTS {
        uuid id PK
        string email UK
        string phone_hash UK
        string password_hash
        enum role
        enum status
    }
```

**Luồng đăng ký Customer** (orchestration đồng bộ 2 bước, không phải event-driven — chấp nhận được ở quy mô đồ án):
```text
1. Client -> gateway -> identity-service: POST /auth/register (fullName, email, phone, password)
2. identity-service tạo accounts row -> có accountId
3. identity-service gọi NỘI BỘ user-service: POST /internal/customers (accountId, fullName, phone)
4. Bước 3 lỗi -> identity-service xóa accounts row vừa tạo, trả 500 cho client
5. Bước 3 thành công -> trả 201 + accessToken cho client
```

### 6.2. user-service

**API công khai**

| Method | Endpoint | PC# |
|---|---|:-:|
| GET | `/api/v1/customers/:id` | 11 |
| GET | `/api/v1/drivers/:id` | 12 |
| GET | `/api/v1/drivers/nearby?lat&lng&radius&limit&page` | 13 |
| POST | `/api/v1/auth/driver/register` | 21 |
| GET | `/api/v1/driver-applications?status&page&limit` | 22 |
| GET | `/api/v1/driver-applications/:id` | 22 |
| PATCH | `/api/v1/driver-applications/:id/review` | 22 |
| PATCH | `/api/v1/drivers/me/availability` | 23 |
| PATCH | `/api/v1/drivers/me/location` | 17 |

**Internal API**

```text
GET  /internal/drivers/nearby
GET  /internal/drivers/:id            # trả full_name, phone (giải mã), vehicle_type, vehicle_plate, vehicle_model
                                       # dùng bởi booking-service để lấy driver_snapshot mới nhất khi accept
POST /internal/drivers/:id/reserve
POST /internal/drivers/:id/release
POST /internal/customers              # gọi bởi identity-service ngay sau khi tạo accounts cho Customer
                                       # body: { accountId, fullName, phone } -> tạo dòng customers
```

**Database `cab_user_db`**

```text
customers
- id UUID PK (= account id)
- full_name
- phone_enc
- created_at

drivers
- id UUID PK (= account id)
- full_name
- phone_enc
- license_number_enc
- vehicle_type ENUM(BIKE, SEDAN, SUV)
- vehicle_plate
- vehicle_model
- status ENUM(PENDING_APPROVAL, REJECTED, OFFLINE, ONLINE, BUSY)
- reject_reason NULL
- reviewed_by NULL, reviewed_at NULL
- lat DOUBLE NULL, lng DOUBLE NULL, location_updated_at NULL
```

**Ngôn ngữ thống nhất (Ubiquitous Language)**

| Thuật ngữ | Định nghĩa |
|---|---|
| Customer Profile / Driver Profile | Hồ sơ nghiệp vụ gắn 1-1 với 1 `Account` (identity-service), id trùng account id |
| Driver Application | Hồ sơ tài xế đang chờ xử lý — chính là dòng `drivers` khi `status = PENDING_APPROVAL` |
| Availability | Trạng thái `ONLINE`/`OFFLINE` do tài xế tự bật/tắt, khác với `BUSY` (hệ thống tự đặt khi có Trip) |
| Nearby Search | Tìm tài xế `ONLINE` trong bán kính cho trước quanh 1 tọa độ |

**ERD**

```mermaid
erDiagram
    CUSTOMERS {
        uuid id PK "= account id"
        string full_name
        string phone_enc
    }
    DRIVERS {
        uuid id PK "= account id"
        string full_name
        string phone_enc
        string license_number_enc
        enum vehicle_type
        string vehicle_plate
        enum status
        double lat
        double lng
    }
```
Không có quan hệ giữa `CUSTOMERS` và `DRIVERS` — 2 bảng độc lập, cùng nằm trong `cab_user_db` chỉ vì cùng thuộc bounded context "hồ sơ người dùng".

Tìm tài xế theo bán kính dùng công thức Haversine trực tiếp trong SQL (đủ cho vài nghìn dòng, không cần PostGIS):

```sql
SELECT *, (
  6371000 * acos(
    cos(radians(:lat)) * cos(radians(lat)) *
    cos(radians(lng) - radians(:lng)) +
    sin(radians(:lat)) * sin(radians(lat))
  )
) AS distance_m
FROM drivers
WHERE status = 'ONLINE' AND vehicle_type = :vehicleType
HAVING distance_m <= :radius
ORDER BY distance_m ASC
LIMIT :limit OFFSET :offset;
```

**Luồng đăng ký Driver** (`POST /auth/driver/register`, xử lý ở user-service vì cần field xe/bằng lái — đảo hướng gọi so với luồng Customer ở mục 6.1):
```text
1. Client verify OTP xong (identity-service), có registrationToken — là JWT ký bằng JWT_SECRET
   dùng chung giữa các service, nên user-service tự verify được, KHÔNG cần gọi lại identity-service
2. Client -> gateway -> user-service: POST /auth/driver/register
   (registrationToken, password, fullName, licenseNumber, vehicleType, vehiclePlate, vehicleModel)
3. user-service verify registrationToken (phone, purpose=driver_registration, chưa hết hạn)
4. user-service tự `bcrypt.hash(password, 10)` trước khi gọi (vì `POST /internal/accounts` chỉ nhận `passwordHash` đã hash sẵn, không nhận plaintext), sau đó gọi NỘI BỘ identity-service: POST /internal/accounts (role=DRIVER, phone, passwordHash)
   -> nhận accountId
5. user-service tạo drivers row với id = accountId, status = PENDING_APPROVAL
6. Bước 5 lỗi sau khi bước 4 đã thành công -> gọi DELETE /internal/accounts/:id để rollback,
   trả lỗi cho client
```

### 6.3. booking-service

**API công khai**

| Method | Endpoint | PC# |
|---|---|:-:|
| POST | `/api/v1/bookings` | 15 |
| GET | `/api/v1/bookings?status&page&limit` | 14 |
| GET | `/api/v1/bookings/:id` | 14 |
| GET | `/api/v1/offers?status&page&limit` | 16 |
| GET | `/api/v1/offers/:id` | 16 |
| POST | `/api/v1/offers/:id/accept` | 16 |

**Database `cab_booking_db`**

```text
bookings
- id UUID PK
- customer_id
- pickup_lat, pickup_lng, pickup_address
- destination_lat, destination_lng, destination_address
- vehicle_type
- status ENUM(SEARCHING, ASSIGNED, NO_DRIVER_FOUND, CANCELED)
- trip_id UUID NULL      -- set khi status chuyển ASSIGNED, để client lần sang GET /trips/:id
- created_at

offers
- id UUID PK
- booking_id FK -> bookings.id
- driver_id
- distance_m
- status ENUM(PENDING, ACCEPTED)
- created_at, responded_at
```

**Ngôn ngữ thống nhất (Ubiquitous Language)**

| Thuật ngữ | Định nghĩa |
|---|---|
| Booking | Yêu cầu đặt xe của Customer, **chưa** có tài xế cụ thể |
| Offer | Lời mời gửi cho **1 tài xế cụ thể** ứng với 1 Booking; 1 Booking chỉ có 1 Offer (đã bỏ retry/reject) |
| Dispatch | Hành động tìm ứng viên (gọi user-service) + tạo Offer, xảy ra ngay khi Booking được tạo |

**ERD**

```mermaid
erDiagram
    BOOKINGS ||--o| OFFERS : "có 1 offer"
    BOOKINGS {
        uuid id PK
        uuid customer_id
        enum vehicle_type
        enum status
        uuid trip_id "set khi ASSIGNED"
    }
    OFFERS {
        uuid id PK
        uuid booking_id FK
        uuid driver_id
        float distance_m
        enum status
    }
```

Idempotency cho `POST /bookings` (FR-46) lưu ở Redis, không phải cột DB: key `idem:booking:<customerId>:<idempotencyKey>`, TTL 24h, value = `bookingId` đã tạo — nhẹ hơn cột DB, đủ dùng vì hậu quả tối đa khi mất Redis chỉ là tạo trùng 1 booking (sửa tay được), không nghiêm trọng như trùng payment.

Chống race condition khi 2 tài xế cùng accept 1 offer, **và** chặn tài xế khác accept nhầm offer không phải của mình (khớp FR-26): dùng câu lệnh có điều kiện, không phải đọc rồi ghi:

```sql
UPDATE offers SET status = 'ACCEPTED', responded_at = now()
WHERE id = :offerId AND status = 'PENDING' AND driver_id = :callerId;
-- rowCount = 0 => 403 nếu offer không thuộc về caller, hoặc 409 nếu offer đã bị xử lý bởi request khác
```

**Luồng đầy đủ của `POST /offers/:id/accept`** (nối các Gap đã audit thành 1 luồng thống nhất):
```text
1. UPDATE offers ... WHERE id=:offerId AND status='PENDING' AND driver_id=:callerId (câu SQL trên)
   rowCount = 0 -> dừng, trả lỗi (403/409)
2. Gọi user-service: GET /internal/drivers/:id -> lấy driver_snapshot mới nhất
3. Gọi user-service: POST /internal/drivers/:id/reserve -> khóa tài xế BUSY
4. Gọi trip-service: POST /internal/trips (bookingId, customerId, driverId, driverSnapshot,
   pickup/destination, vehicleType) -> nhận tripId
5. UPDATE bookings SET status='ASSIGNED', trip_id=:tripId WHERE id=:bookingId
6. Publish event trip.assigned (routing key đã có ở mục 5.2)
7. Trả response cho driver: { tripId, booking, driverSnapshot }
```
Nếu bước 2–4 lỗi sau khi bước 1 đã thành công: `UPDATE offers SET status='PENDING' WHERE id=:offerId` để rollback, trả lỗi 500 cho client — chấp nhận eventual-consistency ngắn hạn ở quy mô đồ án, không cần Saga/outbox pattern đầy đủ.

### 6.4. trip-service

**API công khai**

| Method | Endpoint | PC# |
|---|---|:-:|
| GET | `/api/v1/trips/:id` | 16, 17 |
| PATCH | `/api/v1/trips/:id/status` | 17 |
| PATCH | `/api/v1/trips/:id/location` | 17 |
| POST | `/api/v1/trips/:id/cancel` | 18 |
| POST | `/api/v1/trips/:id/review` | 20 |

**Internal API**

```text
POST /internal/trips
  # gọi bởi booking-service khi Offer accepted (xem luồng 7 bước ở mục 6.3)
  # body: { bookingId, customerId, driverId, driverSnapshot,
  #         pickupLat, pickupLng, destinationLat, destinationLng, vehicleType }
  # tạo trips row với status=ASSIGNED, trả về { tripId }
  # booking_id UNIQUE ở schema dưới tự chặn việc gọi 2 lần tạo 2 Trip cho cùng 1 booking
GET  /internal/trips/:id              # gọi bởi payment-service lấy fare thật
```

**Database `cab_trip_db`**

```text
trips
- id UUID PK
- booking_id UNIQUE
- customer_id, driver_id
- driver_snapshot JSONB      -- tên, biển số, sđt lúc nhận chuyến
- pickup_lat, pickup_lng, destination_lat, destination_lng
- status ENUM(ASSIGNED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELED)
- current_lat, current_lng
- fare NUMERIC NULL
- paid BOOLEAN DEFAULT false
- cancel_reason NULL, canceled_by NULL
- assigned_at, arrived_at, started_at, completed_at, canceled_at

reviews
- id UUID PK
- trip_id UNIQUE FK -> trips.id
- customer_id, driver_id
- stars SMALLINT CHECK (stars BETWEEN 1 AND 5)
- comment NULL
- created_at
```

**Ngôn ngữ thống nhất (Ubiquitous Language)**

| Thuật ngữ | Định nghĩa |
|---|---|
| Trip | 1 chuyến đi **đã có tài xế**, vòng đời trạng thái riêng biệt với Booking |
| Fare | Cước phí, chỉ tính khi Trip chuyển `COMPLETED`, server tính — không tin số client gửi |
| Driver Snapshot | Bản chụp tên/biển số/sđt tài xế **tại thời điểm nhận chuyến**, không đổi dù hồ sơ driver sau này đổi |
| Review | Đánh giá 1–5 sao, gắn 1-1 với 1 Trip đã `COMPLETED` |

**ERD**

```mermaid
erDiagram
    TRIPS ||--o| REVIEWS : "có tối đa 1 review"
    TRIPS {
        uuid id PK
        uuid booking_id UK
        uuid customer_id
        uuid driver_id
        jsonb driver_snapshot
        enum status
        numeric fare
        boolean paid
    }
    REVIEWS {
        uuid id PK
        uuid trip_id FK UK
        int stars
        string comment
    }
```

State machine thực thi bằng bảng chuyển hợp lệ trong code, không hard-code if/else lặp:

```js
const NEXT = {
  ASSIGNED: ["ARRIVED", "CANCELED"],
  ARRIVED: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["COMPLETED"],
};
```

### 6.5. payment-service

**API công khai**

| Method | Endpoint | PC# |
|---|---|:-:|
| POST | `/api/v1/payments` | 19 |
| POST | `/api/v1/payments/callback` | 19 |
| GET | `/api/v1/payments/:id` | 19 |

**Database `cab_payment_db`**

```text
payments
- id UUID PK
- trip_id UNIQUE
- customer_id
- amount NUMERIC
- status ENUM(PENDING, COMPLETED, FAILED)
- provider_txn_id UNIQUE NULL
- idempotency_key UNIQUE
- request_hash          -- hash(body) để phát hiện replay với key trùng nhưng body khác
- created_at, updated_at
```

**Ngôn ngữ thống nhất (Ubiquitous Language)**

| Thuật ngữ | Định nghĩa |
|---|---|
| Payment | Giao dịch thanh toán gắn 1-1 với 1 Trip (`trip_id UNIQUE`) |
| Callback | Xác nhận kết quả thanh toán do provider ngoài gửi tới, có chữ ký, không dùng JWT |
| Idempotency Key | Khóa client tự sinh gửi kèm request, dùng để nhận diện request lặp lại |

**ERD**

```mermaid
erDiagram
    PAYMENTS {
        uuid id PK
        uuid trip_id UK
        numeric amount
        enum status
        string provider_txn_id UK
        string idempotency_key UK
    }
```

`trip_id UNIQUE` tự đảm bảo "một Trip chỉ một Payment thành công" ở tầng DB, không chỉ ở code.

### 6.6. notification-service

**API công khai**

| Method | Endpoint | PC# |
|---|---|:-:|
| GET | `/api/v1/notifications?page&limit` | (hỗ trợ 15,16,18,22) |

**Database `cab_notification_db`**

```text
notifications
- id UUID PK
- recipient_id
- type
- title, body
- data JSONB
- created_at
```

**Ngôn ngữ thống nhất (Ubiquitous Language)**

| Thuật ngữ | Định nghĩa |
|---|---|
| Notification | Thông báo hệ thống gửi cho 1 user, sinh ra **duy nhất** từ event RabbitMQ, không có API tạo trực tiếp |

**ERD**

```mermaid
erDiagram
    NOTIFICATIONS {
        uuid id PK
        uuid recipient_id
        string type
        jsonb data
    }
```

Không có API tạo notification công khai — chỉ tạo qua consumer RabbitMQ.

## 7. docker-compose (PC 5)

10 container:

```text
1. gateway
2. identity-service
3. user-service
4. booking-service
5. trip-service
6. payment-service
7. notification-service
8. postgres        (1 instance, 6 database khác nhau qua init script, hoặc 6 container Postgres nếu muốn tách hẳn — chọn 1 instance cho gọn)
9. redis
10. rabbitmq       (image rabbitmq:3-management, để có UI :15672 phục vụ PC 7)
```

```yaml
services:
  gateway:
    build: ./gateway
    ports: ["8080:8080"]
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on: [redis, identity-service, user-service, booking-service, trip-service, payment-service, notification-service]

  identity-service:
    build: ./services/identity-service
    environment:
      - DATABASE_URL=postgres://postgres:postgres@postgres:5432/cab_identity_db
      - REDIS_URL=redis://redis:6379
    depends_on: [postgres, redis]

  # user-service, booking-service, trip-service, payment-service, notification-service: tương tự,
  # mỗi service 1 DATABASE_URL trỏ đúng database riêng, KHÔNG publish "ports"

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=postgres
    volumes:
      - ./db/init:/docker-entrypoint-initdb.d
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7

  rabbitmq:
    image: rabbitmq:3-management
    ports: ["15672:15672"]   # chỉ mở UI quản trị để demo PC 7, không phải API nghiệp vụ

volumes:
  pgdata:
```

`db/init/*.sql` chứa `CREATE DATABASE cab_identity_db; CREATE DATABASE cab_user_db; ...` và bảng của từng service, chạy tự động khi container Postgres khởi tạo lần đầu.

## 8. Mapping Service → API → PC# (tổng hợp)

| Service | Số endpoint public | PC# liên quan |
|---|---:|---|
| gateway | 3 (health) + middleware xuyên suốt | 3, 6, 8, 24–30 |
| identity-service | 4 | 9, 10, 21 |
| user-service | 9 | 11, 12, 13, 21, 22, 23, 17 |
| booking-service | 6 | 14, 15, 16 |
| trip-service | 5 | 16, 17, 18, 20 |
| payment-service | 3 | 19 |
| notification-service | 1 | hỗ trợ 15, 16, 18, 22 |
| **Tổng** | **31** | — |

So với 78 endpoint trong thiết kế cũ, còn 31 endpoint — đúng bằng số POSTMAN request mà `phieucham.md` liệt kê cộng thêm vài GET phụ trợ (xem chi tiết offer/booking) cần để demo được luồng.

## 9. Việc không làm (nhắc lại để tránh mở rộng khi code)

- Không thêm Vehicle là entity riêng — 1 driver = 1 xe, lưu thẳng trong bảng `drivers`.
- Không làm reject/timeout/retry offer — 1 offer 1 tài xế, không nhận thì thôi (ngoài scope điểm).
- Không làm CRUD Role/Permission — role cố định 3 giá trị enum.
- Không làm Reporting/Dashboard/Audit log riêng — dùng log ứng dụng (stdout) là đủ.
- Không tách Fare thành service/API riêng — tính và lưu thẳng trong `trips.fare`.
