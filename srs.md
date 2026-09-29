# SRS rút gọn — CAB System (bản bám theo `phieucham.md`)

> Bản này thay thế `srs.md` (2.974 dòng, 38 UC, 103 FR). Chỉ giữ những gì phiếu chấm 30 tiêu chí kiểm tra.
> Mỗi FR có cột **PC#** là số thứ tự tiêu chí trong `phieucham.md`. FR không gắn với PC# nào là FR nền tảng, không có thì luồng không chạy được.

---

## 1. Mục tiêu

CAB System là hệ thống đặt xe gồm 6 microservice sau một API Gateway. Luồng cần chạy được và demo bằng Postman:

```text
Customer đăng ký / đăng nhập
        ↓
Customer đặt xe  →  hệ thống tìm tài xế gần nhất  →  gửi offer
        ↓
Tài xế nhận chuyến  →  Trip được tạo
        ↓
ARRIVED → IN_PROGRESS (+ cập nhật vị trí) → COMPLETED   (hoặc CANCELED)
        ↓
Thanh toán online (callback)  →  Đánh giá

Nhánh phụ:  Tài xế đăng ký (OTP) → Admin duyệt → Tài xế bật Online
```

## 2. Actor

| Actor | Việc được làm |
|---|---|
| **Customer** | Đăng ký, đăng nhập, xem hồ sơ của mình, tìm tài xế quanh vị trí, đặt xe, xem booking, hủy chuyến, thanh toán, đánh giá, xem thông báo |
| **Driver** | Đăng ký qua OTP, xem hồ sơ của mình, bật/tắt Online, nhận offer, cập nhật trạng thái và vị trí chuyến, hủy chuyến, xem thông báo |
| **Admin** | Xem danh sách hồ sơ tài xế, duyệt hoặc từ chối, xem mọi hồ sơ customer/driver |
| **Payment Provider** | Hệ thống ngoài, được giả lập bằng endpoint callback có chữ ký |

Đã bỏ: Operations Staff, Management User, Notification Provider.

## 3. Phạm vi

### 3.1. In scope

Account (Customer, Driver, Admin) · Driver onboarding (OTP, duyệt hồ sơ) · Driver availability · Tìm tài xế theo bán kính · Booking · Offer · Trip · Payment online · Review · Notification (lưu và liệt kê) · Health check · Bảo mật (mục 9).

### 3.2. Out of scope (đã bỏ so với SRS cũ)

Đăng xuất, đổi mật khẩu, sửa hồ sơ, khóa/mở khóa account bằng API · CRUD Role/Permission · CRUD Vehicle · Từ chối/timeout/retry offer · Booking cancel trước khi có tài xế · `PICKED_UP` · Tiền mặt · Retry payment · Fare API riêng · Notification mark-read · Incident · Operations · Reporting/Dashboard · Audit log (thay bằng log) · Lịch sử GPS.

## 4. Quy trình nghiệp vụ

### 4.1. Đặt xe → nhận chuyến

1. Customer gửi `POST /bookings` (pickup, destination, vehicleType) kèm `Idempotency-Key`.
2. `booking-service` lưu Booking `SEARCHING`.
3. `booking-service` gọi `user-service` lấy tài xế `ONLINE`, đúng `vehicleType`, trong bán kính `DISPATCH_RADIUS_M`, sắp xếp theo khoảng cách.
4. Có ứng viên: tạo Offer `PENDING` cho tài xế gần nhất, phát event `offer.created`. Không có: Booking → `NO_DRIVER_FOUND`.
5. Tài xế xem offer và gọi `POST /offers/:id/accept`.
6. Hệ thống đặt tài xế `BUSY`, Offer `ACCEPTED`, Booking `ASSIGNED`, tạo Trip `ASSIGNED`, phát `trip.assigned`.
7. Customer nhận thông báo kèm thông tin tài xế.

### 4.2. Thực hiện chuyến

`ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED`. Khi `COMPLETED` hệ thống tính `fare` và giải phóng tài xế về `ONLINE`.
Hủy chuyến (Customer hoặc Driver) chỉ được ở `ASSIGNED` hoặc `ARRIVED`, bắt buộc có `reason`, chuyển sang `CANCELED`.

### 4.3. Thanh toán và đánh giá

1. Trip `COMPLETED`, Customer gọi `POST /payments` → Payment `PENDING`.
2. Provider (giả lập) gọi `POST /payments/callback` có chữ ký → Payment `COMPLETED`, Trip `paid = true`.
3. Customer gửi review 1–5 sao cho Trip `COMPLETED`.

### 4.4. Tài xế đăng ký và được duyệt

1. `POST /auth/driver/otp/request` (phone) → hệ thống sinh OTP 6 số, lưu Redis 5 phút.
2. `POST /auth/driver/otp/verify` (phone, otp) → nhận `registrationToken` sống 15 phút.
3. `POST /auth/driver/register` (registrationToken, password, họ tên, số bằng lái, thông tin xe) → tạo Account `DRIVER` và hồ sơ `PENDING_APPROVAL`.
4. Admin xem danh sách, xem chi tiết, `PATCH` duyệt (`APPROVED`) hoặc từ chối (`REJECTED` + lý do).
5. `APPROVED` → trạng thái tài xế thành `OFFLINE` (được phép bật Online). Tài xế nhận notification kết quả.

## 5. State machine

| Đối tượng | Trạng thái | Chuyển hợp lệ |
|---|---|---|
| **Driver** | `PENDING_APPROVAL`, `REJECTED`, `OFFLINE`, `ONLINE`, `BUSY` | `PENDING_APPROVAL → OFFLINE` (duyệt), `PENDING_APPROVAL → REJECTED`, `OFFLINE ⇄ ONLINE` (tài xế), `ONLINE → BUSY` (nhận chuyến), `BUSY → ONLINE` (Trip kết thúc) |
| **Booking** | `SEARCHING`, `ASSIGNED`, `NO_DRIVER_FOUND`, `COMPLETED`, `CANCELED` | `SEARCHING → ASSIGNED / NO_DRIVER_FOUND`, `ASSIGNED → COMPLETED / CANCELED` |
| **Offer** | `PENDING`, `ACCEPTED` | `PENDING → ACCEPTED` |
| **Trip** | `ASSIGNED`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELED` | `ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED`; `ASSIGNED / ARRIVED → CANCELED` |
| **Payment** | `PENDING`, `COMPLETED`, `FAILED` | `PENDING → COMPLETED / FAILED` |

Mọi chuyển trạng thái sai trả `409 INVALID_STATE_TRANSITION`. Chuyến đã `COMPLETED` hoặc `CANCELED` là trạng thái cuối.

## 6. Yêu cầu chức năng

### 6.1. Nền tảng, Gateway, hạ tầng

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-01 | Mã nguồn tổ chức monorepo: `gateway/`, `services/*`, `db/`, `postman/`, `docs/` | 1 |
| FR-02 | `.gitignore` chặn `.env`, `node_modules/`, `*.log`; chỉ commit `.env.example` | 2 |
| FR-03 | API Gateway là điểm vào duy nhất: routing, xác thực JWT, phân quyền, rate limit, sanitize input, tổng hợp health | 3, 8 |
| FR-04 | Service giao tiếp đồng bộ bằng REST nội bộ `/internal/*` và bất đồng bộ bằng RabbitMQ | 4, 7 |
| FR-05 | `docker compose up` khởi chạy toàn bộ 10 container | 5 |
| FR-06 | Gateway có `GET /health`, `GET /ready`, `GET /health/services`; mỗi service có `/health`, `/ready` | 6 |
| FR-07 | Service nghiệp vụ không publish port ra host, chỉ nhận request từ gateway | 8 |

### 6.2. Account và hồ sơ

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-10 | Customer đăng ký bằng `fullName`, `email`, `phone`, `password`. Email và phone không trùng. Đây là orchestration 2 bước xuyên service: identity-service tạo `accounts` trước, sau đó gọi nội bộ user-service để tạo `customers` profile; nếu bước tạo profile lỗi thì phải xóa lại `accounts` vừa tạo (rollback) và trả lỗi cho client — chi tiết kỹ thuật ở `03_microservice_design_simplified.md` mục 6.1/6.2 | 9 |
| FR-11 | Đăng nhập bằng `email` + `password`, trả JWT (HS256, hạn 60 phút) chứa `sub`, `role` | 10 |
| FR-12 | Từ chối đăng nhập khi sai mật khẩu hoặc Account `LOCKED` | 10 |
| FR-13 | Customer xem hồ sơ theo id. Customer chỉ xem của mình, Admin xem mọi hồ sơ | 11 |
| FR-14 | Driver xem hồ sơ theo id. Driver chỉ xem của mình, Admin xem mọi hồ sơ | 12 |
| FR-15 | Tài xế yêu cầu OTP, xác thực OTP, gửi hồ sơ (cá nhân + 1 xe) → `PENDING_APPROVAL`. Cũng là orchestration 2 bước, nhưng theo chiều ngược lại FR-10: user-service nhận request đăng ký (vì cần field xe/bằng lái), tự verify `registrationToken` bằng JWT_SECRET dùng chung (không cần gọi lại identity-service), rồi gọi nội bộ identity-service để tạo `accounts`, cuối cùng mới tạo `drivers` với id = accountId | 21 |
| FR-16 | Admin liệt kê hồ sơ tài xế theo trạng thái (có phân trang) và xem chi tiết | 22 |
| FR-17 | Admin duyệt hoặc từ chối (từ chối bắt buộc có lý do); tài xế nhận notification | 22 |
| FR-18 | Tài xế `APPROVED` bật/tắt `ONLINE` / `OFFLINE`; tài xế `PENDING_APPROVAL`, `REJECTED` hoặc `BUSY` bị từ chối | 23 |
| FR-19 | Tài xế cập nhật vị trí hiện tại (lat, lng); chỉ lưu vị trí mới nhất | 13 |

### 6.3. Tìm tài xế, Booking, Offer

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-20 | Liệt kê tài xế quanh tọa độ, `radius` mặc định 1000 m, lọc `status` tùy chọn, sắp theo khoảng cách, hỗ trợ `page` và `limit` | 13 |
| FR-21 | Tạo Booking: bắt buộc pickup (lat, lng, address), destination, `vehicleType` hợp lệ. Trạng thái đầu `SEARCHING` | 15 |
| FR-22 | Tự động tìm tài xế `ONLINE` đúng loại xe trong `DISPATCH_RADIUS_M`, chọn gần nhất, tạo Offer `PENDING` | 15 |
| FR-23 | Không có ứng viên → Booking `NO_DRIVER_FOUND` và Customer nhận thông báo | 15 |
| FR-24 | Customer xem chi tiết Booking (thấy `SEARCHING`) và liệt kê Booking của mình (có `page`, `limit`, lọc `status`) | 14, 15 |
| FR-25 | Tài xế liệt kê offer `PENDING` của mình và xem chi tiết offer | 16 |
| FR-26 | Tài xế nhận offer: chỉ đúng tài xế được offer, chỉ khi Offer `PENDING` và Booking `SEARCHING`. Kết quả: Trip `ASSIGNED`, Driver `BUSY`, Customer nhận thông tin tài xế | 16 |

### 6.4. Trip, Payment, Review, Notification

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-30 | Driver đổi trạng thái Trip theo đúng trình tự `ARRIVED → IN_PROGRESS → COMPLETED` | 17 |
| FR-31 | Driver cập nhật vị trí Trip (lat, lng) khi Trip ở `ASSIGNED`, `ARRIVED` hoặc `IN_PROGRESS`. Customer thấy vị trí này khi xem Trip | 17 |
| FR-32 | Khi `COMPLETED`: tính `fare = baseFare + perKm × khoảng cách đường thẳng pickup–destination`, lưu vào Trip, tài xế về `ONLINE` | 17 |
| FR-33 | Customer hoặc Driver hủy Trip ở `ASSIGNED` / `ARRIVED` với `reason`. Trip → `CANCELED`, tài xế về `ONLINE`, cả hai bên nhận notification | 18 |
| FR-34 | Customer tạo Payment online cho Trip `COMPLETED`. Số tiền lấy từ `trip.fare` phía server. Payment `PENDING` | 19 |
| FR-35 | Nhận callback từ provider, xác minh chữ ký HMAC. `SUCCESS` → Payment `COMPLETED`, Trip `paid = true`; `FAILED` → Payment `FAILED` | 19 |
| FR-36 | Customer đánh giá Trip `COMPLETED` (1–5 sao, comment tùy chọn), mỗi Trip một review | 20 |
| FR-37 | Người dùng liệt kê notification của mình (có phân trang) | 15, 16, 18, 22 |

### 6.5. Bảo mật

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-40 | Password băm bằng bcrypt. Phone và số bằng lái mã hóa AES-256-GCM trước khi ghi DB; key lấy từ biến môi trường | 24 |
| FR-41 | Mọi truy vấn DB dùng tham số hóa; input được validate theo schema. Input như `' OR 1=1 --` không bypass login | 25 |
| FR-42 | Chuỗi đầu vào bị escape ở gateway. `<script>` không được lưu ở dạng thực thi được | 26 |
| FR-43 | Gateway chỉ chấp nhận JWT HS256 hợp lệ. Token sai chữ ký, sai thuật toán hoặc hết hạn → 401 | 27 |
| FR-44 | Gateway kiểm tra role theo từng route; sai role → 403, không trả dữ liệu | 28 |
| FR-45 | Rate limit theo IP và theo user; vượt ngưỡng → 429 kèm `Retry-After` | 29 |
| FR-46 | `POST /bookings` và `POST /payments` bắt buộc `Idempotency-Key`. Gửi lại cùng key trả kết quả cũ, không tạo bản ghi mới. Hai nơi lưu khác nhau vì mức độ quan trọng khác nhau: `bookings` lưu key trong Redis (`idem:booking:<customerId>:<key>`, TTL 24h) — đủ dùng vì mất Redis nhiều nhất chỉ gây tạo trùng 1 booking, sửa tay được; `payments` lưu key trong cột DB (bền, không mất khi restart) vì liên quan tiền, không được phép mất | 30 |
| FR-47 | Mỗi Trip chỉ có tối đa một Payment `PENDING` hoặc `COMPLETED` (ràng buộc DB), kể cả khi không có Idempotency-Key | 30 |

## 7. Use case (21 UC, giảm từ 38)

| UC | Tên | Actor | FR chính | PC# |
|---|---|---|---|:-:|
| UC01 | Đăng ký customer | Customer | FR-10 | 9 |
| UC02 | Đăng nhập | Customer, Driver, Admin | FR-11, 12 | 10 |
| UC03 | Xem hồ sơ customer | Customer, Admin | FR-13 | 11 |
| UC04 | Xem hồ sơ tài xế | Driver, Admin | FR-14 | 12 |
| UC05 | Tìm tài xế quanh vị trí | Customer, Admin | FR-20 | 13 |
| UC06 | Xem danh sách booking | Customer | FR-24 | 14 |
| UC07 | Đặt xe | Customer | FR-21–24 | 15 |
| UC08 | Xem và nhận offer | Driver | FR-25, 26 | 16 |
| UC09 | Cập nhật trạng thái và vị trí Trip | Driver | FR-30–32 | 17 |
| UC10 | Hủy Trip | Customer, Driver | FR-33 | 18 |
| UC11 | Thanh toán online | Customer | FR-34 | 19 |
| UC12 | Xử lý callback thanh toán | Payment Provider | FR-35 | 19 |
| UC13 | Đánh giá chuyến đi | Customer | FR-36 | 20 |
| UC14 | Yêu cầu và xác thực OTP | Driver | FR-15 | 21 |
| UC15 | Gửi hồ sơ tài xế | Driver | FR-15 | 21 |
| UC16 | Xem danh sách và chi tiết hồ sơ tài xế | Admin | FR-16 | 22 |
| UC17 | Duyệt / từ chối hồ sơ | Admin | FR-17 | 22 |
| UC18 | Bật/tắt nhận chuyến, cập nhật vị trí | Driver | FR-18, 19 | 23 |
| UC19 | Xem notification | Mọi actor | FR-37 | — |
| UC20 | Kiểm tra sức khỏe hệ thống | Bất kỳ | FR-06 | 6 |
| UC21 | Kiểm tra bảo mật (SQLi, XSS, JWT, RBAC, rate limit, replay) | Người chấm | FR-40–47 | 24–30 |

## 8. Business rules

| Mã | Quy tắc |
|---|---|
| BR-01 | Chỉ Customer đã đăng nhập mới đặt xe |
| BR-02 | Booking bắt buộc có pickup, destination, `vehicleType ∈ {BIKE, SEDAN, SUV}` |
| BR-03 | Chỉ tài xế `ONLINE`, đúng `vehicleType`, đã `APPROVED` mới được nhận offer |
| BR-04 | Offer gửi cho tài xế gần điểm đón nhất |
| BR-05 | Một Booking chỉ có một Offer `ACCEPTED`. Khi hai request accept đồng thời, chỉ một request thắng (`UPDATE ... WHERE status='PENDING'`) |
| BR-06 | Trip đổi trạng thái đúng trình tự, không đi lùi |
| BR-07 | Chỉ Trip `COMPLETED` mới được thanh toán và đánh giá |
| BR-08 | Một Trip chỉ có một Payment thành công, một Review |
| BR-09 | `amount` do server tính từ `trip.fare`, không tin số tiền client gửi |
| BR-10 | Hủy chuyến bắt buộc có `reason` (1–255 ký tự) |
| BR-11 | Người dùng chỉ đọc dữ liệu của chính mình, trừ Admin |
| BR-12 | OTP 6 số, hết hạn sau 5 phút, tối đa 5 lần nhập sai |
| BR-13 | Kiểm tra "chỉ đọc dữ liệu của chính mình" (BR-11) được chia làm 2 tầng: gateway chỉ tự kiểm tra được khi `id` trong path chính là account id của người gọi (ví dụ `/customers/:id`, `/drivers/:id`); với mọi resource khác (Booking, Offer, Trip, Payment, Review) — nơi `id` trong path là id của resource chứ không phải account id — service sở hữu resource đó (booking-service, trip-service, payment-service...) phải tự so `resource.customerId`/`resource.driverId` với người gọi (nhận qua header `X-User-Id`, `X-User-Role` do gateway gắn vào sau khi verify JWT) trước khi trả dữ liệu, sai thì trả 403 |

## 9. Yêu cầu phi chức năng

### 9.1. Bảo mật (test được bằng Postman, tương ứng PC# 24–30)

| NFR | Nội dung | Kết quả mong đợi |
|---|---|---|
| NFR-01 (24) | bcrypt cho password; AES-256-GCM cho `phone`, `license_number` (lưu ở user-service, có thể giải mã lại để hiển thị); riêng `accounts.phone_hash` (identity-service, dùng để check trùng/login) **không dùng hash trần** — dùng HMAC-SHA256 với khóa bí mật `PHONE_HASH_PEPPER` lấy từ env, vì số điện thoại VN chỉ có khoảng 10¹⁰ khả năng và đầu số cố định nên hash trần (không khóa) có thể bị dò ngược toàn bộ dải số trong vài giây; key `DATA_ENCRYPTION_KEY` (32 byte) trong env/secret, tiền tố `v1:` để xoay key | Xem DB trực tiếp không thấy plaintext lẫn `phone_hash` không dò ngược được bằng cách thử toàn bộ số điện thoại hợp lệ; API vẫn trả dữ liệu đã giải mã cho đúng chủ |
| NFR-02 (25) | Query tham số hóa, validate email/phone/UUID | `{"email":"' OR 1=1 --"}` → 400 hoặc 401, không lộ dữ liệu |
| NFR-03 (26) | Escape HTML ở gateway cho mọi chuỗi trong body | `<script>alert('hack')</script>` lưu thành `&lt;script&gt;...` |
| NFR-04 (27) | Chỉ nhận `alg = HS256`, verify chữ ký bằng `JWT_SECRET`, từ chối `alg = none` | Token bị sửa payload → 401 |
| NFR-05 (28) | Bảng RBAC theo route ở gateway, thêm kiểm tra chủ sở hữu ở service | Customer gọi API Driver → 403 |
| NFR-06 (29) | Rate limit lưu Redis: toàn cục 100 req/phút/IP, `POST /bookings` 10 req/phút/user, `POST /auth/login` 10 req/phút/IP | Vượt ngưỡng → 429, hệ thống vẫn hoạt động |
| NFR-07 (30) | `Idempotency-Key` lưu Redis 24 giờ + unique index DB; callback trùng `providerTxnId` không xử lý lại | Gửi lại request → cùng kết quả, không double charge |

### 9.2. Khác

| NFR | Nội dung |
|---|---|
| NFR-10 | Mọi API danh sách dùng `?page=1&limit=10`, `limit` tối đa 50. Response `{ "data": [...], "pagination": { "page", "limit", "total", "totalPages" } }` |
| NFR-11 | Lỗi thống nhất `{ "code", "message", "details"? }`. Mã HTTP: 400 validate, 401 chưa xác thực, 403 sai quyền, 404, 409 xung đột trạng thái, 422 sai Idempotency-Key, 429 rate limit |
| NFR-12 | Mọi request có `X-Request-Id` (gateway sinh, service ghi log) |
| NFR-13 | Cấu hình bằng biến môi trường; không hard-code secret trong mã |
| NFR-14 | Thời gian phản hồi API thông thường dưới 500 ms trong môi trường demo |

## 10. Mô hình dữ liệu (9 bảng)

| Bảng | Service | Cột chính |
|---|---|---|
| `accounts` | identity | `id`, `email` (unique), `phone_hash` (unique), `password_hash`, `role`, `status` |
| `customers` | user | `id` (= account id), `full_name`, `phone_enc`, `created_at` |
| `drivers` | user | `id` (= account id), `full_name`, `phone_enc`, `license_number_enc`, `vehicle_type`, `vehicle_plate`, `vehicle_model`, `status`, `reject_reason`, `reviewed_by`, `reviewed_at`, `lat`, `lng`, `location_updated_at` |
| `bookings` | booking | `id`, `customer_id`, `pickup_*`, `destination_*`, `vehicle_type`, `status` |
| `offers` | booking | `id`, `booking_id`, `driver_id`, `status`, `distance_m`, `created_at`, `responded_at` |
| `trips` | trip | `id`, `booking_id` (unique), `customer_id`, `driver_id`, `driver_snapshot`, `pickup_*`, `destination_*`, `status`, `current_lat`, `current_lng`, `fare`, `paid`, `cancel_reason`, mốc thời gian từng trạng thái |
| `reviews` | trip | `id`, `trip_id` (unique), `customer_id`, `driver_id`, `stars`, `comment` |
| `payments` | payment | `id`, `trip_id`, `customer_id`, `amount`, `status`, `provider_txn_id` (unique), `idempotency_key`, `request_hash` |
| `notifications` | notification | `id`, `recipient_id`, `type`, `title`, `body`, `data`, `created_at` |

Không có khóa ngoại xuyên database; các service tham chiếu nhau bằng id.

## 11. Dữ liệu seed cho smoke test

| Tiêu chí | Dữ liệu cần có |
|---|---|
| PC 13 | ≥5 tài xế quanh một tọa độ chuẩn: 2 `ONLINE` trong 1 km, 1 `ONLINE` cách khoảng 3 km, 1 `BUSY`, 1 `OFFLINE`, thêm 1 `PENDING_APPROVAL` |
| PC 14 | 1 customer có ≥5 booking với nhiều trạng thái |
| PC 22 | ≥2 hồ sơ tài xế `PENDING_APPROVAL` |
| Đăng nhập | 1 admin, 1 customer, 1 driver `APPROVED`, mật khẩu ghi trong `docs/seed-accounts.md` |
| PC 19 | 1 Trip `COMPLETED` chưa thanh toán |

## 12. Tiêu chí chấp nhận

Mỗi tiêu chí trong `phieucham.md` là một acceptance test. Postman collection đánh số 01–30 đúng theo thứ tự phiếu chấm; tiêu chí 1–5, 7–8 được minh chứng bằng cấu trúc repo, `docker compose ps`, RabbitMQ UI và log gateway.

| PC# | Điều kiện đạt |
|:-:|---|
| 1 | README mô tả cấu trúc thư mục, vai trò từng service |
| 2 | Trên GitHub không có `.env`; có `.env.example` và `.gitignore` |
| 3 | Tài liệu và code gateway thể hiện 6 nhiệm vụ ở FR-03 |
| 4 | Sơ đồ IPC: bảng REST nội bộ + bảng event RabbitMQ |
| 5 | `docker compose ps` hiển thị 10 container `healthy` / `running` |
| 6 | 3 endpoint trả 200 với JSON `healthy` / `ready` / danh sách service |
| 7 | RabbitMQ UI thấy exchange `cab.events`, các queue, message được tiêu thụ |
| 8 | Gọi thẳng cổng service bị từ chối kết nối; chỉ cổng 8080 của gateway hoạt động |
| 9–10 | 201 tạo tài khoản; 200 trả `accessToken` |
| 11–12 | 200 với token đúng chủ; 403 với token khác chủ |
| 13 | Danh sách có `pagination`, mỗi phần tử có `distanceM` ≤ 1000, `limit` hoạt động |
| 14 | ≥5 booking, `limit=2` trả 2 phần tử và `totalPages` đúng |
| 15 | 201, booking `SEARCHING`; có offer `PENDING` cho tài xế gần nhất |
| 16 | Trip `ASSIGNED` có `driverId`; customer thấy `driver` trong Trip |
| 17 | Chuyển đúng trình tự; nhảy bước → 409 |
| 18 | Trip `CANCELED`, có `reason`; notification cho cả hai bên |
| 19 | Payment `COMPLETED`, `trip.paid = true` |
| 20 | Review có `tripId`; review lần hai → 409 |
| 21 | Hồ sơ `PENDING_APPROVAL` |
| 22 | Trạng thái đổi; tài xế thấy notification kết quả |
| 23 | `ONLINE` ↔ `OFFLINE`; `BUSY` hoặc chưa duyệt → 409 |
| 24 | `SELECT` trực tiếp trong DB cho thấy chuỗi `v1:...` |
| 25–30 | Đúng kết quả mong đợi ở mục 9.1 |
