# Kịch bản demo theo `phieucham.md`

Tài liệu này đi theo đúng PC1–PC30 của phiếu chấm. **PC6 và PC9–PC30 có chữ POSTMAN trong phiếu: mọi thao tác kiểm thử ở các mục này đều thực hiện trong Postman.** PC1–PC5, PC7–PC8 là phần trình bày kiến trúc, hạ tầng hoặc đối chiếu GitHub/Docker Desktop; những mục đó có thể dùng Postman để bổ sung bằng chứng nhưng không thay thế được việc xem cấu hình hạ tầng.

## Chuẩn bị trước buổi demo

- Khởi động PostgreSQL và Docker Compose theo [backend/README.md](backend/README.md), rồi build lại Gateway, identity-service và driver-service để có các endpoint demo PC24/PC27. Docker Compose hiện đặt `NODE_ENV=development` cho Gateway. Không reset dữ liệu trong lúc demo: `scripts/reset-requested-demo-data.js` **xóa toàn bộ dữ liệu ứng dụng hiện có**.
- Dùng Postman environment với `baseUrl = http://localhost:8000`. Trong URL nhập `{{baseUrl}}/api/v1/...`. Chọn **Body → raw → JSON** cho request có JSON; request GET không có body. Với route cần đăng nhập, chọn **Authorization → Bearer Token** rồi nhập biến token tương ứng. Không cần dán JavaScript vào Postman.
- Tạo các biến environment bằng giao diện Postman: `customerId`, `customerToken`, `adminToken`, `seedCustomerToken`, `driverId`, `driverPhone`, `driverToken`, `otp`, `registrationToken`, `bookingId`, `tripId`, `paymentId`, `cancelBookingId`, `cancelTripId`. Sau mỗi response, copy giá trị vào đúng biến. Nếu token hết hạn, đăng nhập lại rồi cập nhật biến token.
- Bộ dữ liệu mẫu do script reset tạo gồm `admin@gmail.com`, `kh01@gmail.com`–`kh05@gmail.com`, `dr01@gmail.com`–`dr10@gmail.com`; mật khẩu mẫu là `12345678`. `kh01` có 9 booking; `dr01` và `dr02` ban đầu ONLINE ở gần `10.7769, 106.7008`. Số lượng/trạng thái có thể thay đổi sau khi chạy demo. Driver đăng ký qua OTP **đăng nhập bằng số điện thoại**, không dùng email.
- Các request tạo booking cần header `Idempotency-Key` riêng. Khi lặp lại để chứng minh PC30, giữ **nguyên key và body**. Dùng số điện thoại/email mới nếu đã đăng ký trước. Trong ví dụ dưới đây, `0912345001` và `0912345002` là số thử; nếu trùng, đổi toàn bộ chỗ dùng số đó.
- Thứ tự thuận tiện: PC6, PC9–PC14, PC21–PC23, PC15–PC20, PC24–PC30. PC24 cần Admin và tài khoản Driver mới; PC15–PC18 cần Driver đã duyệt và ONLINE.

## Thực hành 1

### PC1 – Kiến trúc source code

Mở cây thư mục `backend/` trong IDE. Chỉ ra `gateway/`, `shared/`, `services/` gồm 7 service (`identity`, `customer`, `driver`, `booking`, `trip`, `payment`, `notification`), `mocks/` và `docker-compose.yml`. Mỗi service có `package.json`, `src/index.js`, routes/controllers/services/repositories. Đây là tiêu chí mô tả source, không phải một API Postman.

### PC2 – `.gitignore` và `.env` trên GitHub

Mở **repository GitHub** trước giảng viên: nhánh hiện tại không có `.env`, `.env.example` hay `.gitignore`. Các file `.env` và `.gitignore` chỉ giữ trên máy. Phiếu yêu cầu kiểm tra `.gitignore` và `.env` trên GitHub, nhưng theo ràng buộc của repository này, **không thể trình bày `.gitignore` trên GitHub**; báo cáo rõ khác biệt đó, không tự nhận PC2 đạt trọn vẹn. Việc xóa file khỏi nhánh hiện tại cũng không đồng nghĩa đã xóa khỏi lịch sử commit cũ.

### PC3 – Nhiệm vụ Gateway

Chỉ ra [Gateway](backend/gateway/src/index.js): route map chuyển `/auth`, `/drivers`, `/bookings`... tới đúng service, xác minh JWT và giới hạn request. Có thể mở Postman gửi `GET {{baseUrl}}/health` và `GET {{baseUrl}}/api/v1/drivers/nearby?lat=10.7769&lng=106.7008&radius=1000&limit=1`; cả hai đi qua cổng 8000. Bằng chứng cấu hình route nằm trong code, không chỉ trong response.

### PC4 – IPC giữa các service

Dùng Postman minh họa HTTP nội bộ: đăng ký Customer ở PC9, đăng nhập PC10, rồi lấy profile PC11 với cùng `id`. Identity-service tạo account và gọi customer-service tạo profile; xem `services/identity-service/src/clients/customer.client.js`. Kafka là IPC bất đồng bộ, trình bày ở PC7.

### PC5 – Docker Compose và container

Mở `backend/docker-compose.yml` và Docker Desktop → Containers: chỉ ra Gateway, 7 service, Kafka, Redis, MongoDB và 2 mock provider. `kafka-init` có thể đã kết thúc sau khi tạo topic. PostgreSQL của dự án chạy trên máy host, không phải container trong Compose này. `GET {{baseUrl}}/health/services` trong Postman bổ sung trạng thái 7 service.

### PC6 – POSTMAN: API health check

Tạo ba request GET, không Authorization/body:

| URL | Kết quả mong đợi |
|---|---|
| `{{baseUrl}}/health` | 200, `status: "ok"`, `service: "gateway"` |
| `{{baseUrl}}/ready` | 200, `status: "ready"` |
| `{{baseUrl}}/health/services` | 200, mảng `services` có 7 service `up`; 503 nếu có service down |

`/ready` chỉ báo Gateway đã khởi động; `/health/services` mới hỏi các service phía sau.

### PC7 – Kafka/RabbitMQ

Mở Compose để chỉ Kafka, `booking.events` và notification-service consumer. Để chứng minh luồng nghiệp vụ trong Postman, dùng Customer đã đăng nhập: `POST {{baseUrl}}/api/v1/bookings` với Bearer `{{customerToken}}`, header `Idempotency-Key: pc7-booking-001` và body mẫu của PC15; lưu ID thành `pc7BookingId`. Gửi `GET {{baseUrl}}/api/v1/notifications?limit=20` cùng token, đợi vài giây nếu cần; tìm `eventType: "booking.created"` và `body` chứa `pc7BookingId`. Đây là bằng chứng producer → Kafka → consumer → thông báo; Postman **không tự chứng minh** broker/topic/consumer group đang cấu hình đúng, nên chỉ thêm Compose/Docker Desktop. Hủy booking này trước PC15 bằng `POST /api/v1/bookings/<pc7BookingId>/cancel`, JSON `{ "reason": "Ket thuc demo Kafka" }` nếu nó còn SEARCHING.

### PC8 – Mọi request qua Gateway

Trong Compose/Docker Desktop xem cột Ports: Gateway publish `8000:8000`; 7 service không publish cổng HTTP riêng ra host. Trong Postman, mọi API nghiệp vụ của tài liệu dùng `{{baseUrl}}` qua Gateway. Một request Postman thành công qua cổng 8000 **không tự chứng minh** các cổng nội bộ không được publish; cần xem cấu hình Compose.

### PC9 – POSTMAN: Đăng ký Customer

`POST {{baseUrl}}/api/v1/auth/register`, không Bearer:

```json
{"fullName":"Khach Demo","email":"khachdemo01@example.com","phone":"0912345001","password":"DemoPass@123"}
```

Mong đợi **201**, `role: "CUSTOMER"`, `status: "ACTIVE"`; lưu `id` → `customerId`. Nếu 409, đổi cả email và số điện thoại. PC10 chứng minh đăng nhập được.

### PC10 – POSTMAN: Đăng nhập Customer

`POST {{baseUrl}}/api/v1/auth/login`, không Bearer:

```json
{"email":"khachdemo01@example.com","password":"DemoPass@123"}
```

Mong đợi **200**, `role: "CUSTOMER"`, `accountId = customerId`; lưu `token` → `customerToken`. Để dùng PC13/PC22/PC24, gửi cùng endpoint với `{"email":"admin@gmail.com","password":"12345678"}` và lưu token → `adminToken`. Token mặc định hết hạn sau 60 phút.

## Thực hành 2

### PC11 – POSTMAN: Lấy Customer theo ID

`GET {{baseUrl}}/api/v1/customers/{{customerId}}` với Bearer `{{customerToken}}` → **200**, `id`, tên, email đúng PC9. Gửi không Bearer → **401**; token Customer khác xem ID này → **403**. `GET /api/v1/customers/me` với cùng token cho thấy profile và số dư.

### PC12 – POSTMAN: Lấy Driver theo ID

`GET {{baseUrl}}/api/v1/drivers/20000000-0000-4000-8000-000000000001` với Bearer `{{customerToken}}` → **200** nếu dữ liệu mẫu đã nạp; xem `id`, `status`, `vehicle`, số điện thoại được che. Sau PC21 có thể thay bằng `{{driverId}}` của tài xế vừa đăng ký.

### PC13 – POSTMAN: Driver quanh khu vực, limit, paging

1. `GET {{baseUrl}}/api/v1/drivers?page=1&limit=50` với Bearer `{{adminToken}}`: dữ liệu mẫu có ít nhất 5 Driver ở nhiều trạng thái. Nếu bộ dữ liệu đã thay đổi, đối chiếu số lượng thực tế trước khi demo.
2. `GET {{baseUrl}}/api/v1/drivers/nearby?lat=10.7769&lng=106.7008&radius=1000&limit=5&page=1`, không Bearer: **200**, `distanceM <= 1000`, mặc định chỉ `ONLINE`.
3. Gửi lại với `limit=1&page=1` rồi `limit=1&page=2`: `pagination` đúng và hai trang không trùng ID nếu có ít nhất hai Driver ONLINE. Với seed ban đầu là `dr01`, `dr02`.

### PC14 – POSTMAN: Ít nhất 5 booking của Customer

Đăng nhập `kh01@gmail.com` / `12345678` qua PC10 và lưu token **riêng** thành `seedCustomerToken`. Gửi `GET {{baseUrl}}/api/v1/bookings?limit=2&page=1` rồi `page=2`, Bearer `{{seedCustomerToken}}`: **200**, tối đa 2 booking/trang, `pagination.total >= 5`, ID hai trang không trùng. Chọn một ID gọi `GET /api/v1/bookings/<id>` với cùng token để xem chi tiết. Nếu chưa nạp bộ dữ liệu mẫu, tạo ít nhất 5 booking đã kết thúc cho cùng Customer trước khi chấm; một Customer chỉ có một booking SEARCHING/ASSIGNED tại một thời điểm.

### PC15 – POSTMAN: Đặt xe và tìm Driver

Sau PC23, đặt Driver thử nghiệm ONLINE gần `10.7901, 106.7101`. Gửi `POST {{baseUrl}}/api/v1/bookings`, Bearer `{{customerToken}}`, header `Idempotency-Key: demo-ride-001`, body:

```json
{"pickupAddress":"Diem don demo","pickupLat":10.7901,"pickupLng":106.7101,"destinationAddress":"Diem den demo","destinationLat":10.8001,"destinationLng":106.7201}
```

Mong đợi **201**, `status: "SEARCHING"`, `paymentStatus: "HELD"`, `fare`, `searchExpiresAt`; lưu `id` → `bookingId`. `GET /api/v1/bookings/{{bookingId}}` với Customer xác nhận trạng thái. `GET /api/v1/offers` với Bearer `{{driverToken}}` tìm offer có `bookingId`; nếu chưa có, gửi lại sau vài giây. Nếu tạo booking mới khi booking này còn SEARCHING/ASSIGNED với **key mới**, mong đợi **409 `ACTIVE_BOOKING_EXISTS`**.

### PC16 – POSTMAN: Driver nhận chuyến

Khi `GET /api/v1/offers` đã thấy offer cho `bookingId`, gửi `POST {{baseUrl}}/api/v1/bookings/{{bookingId}}/accept`, Bearer `{{driverToken}}`, không body. Mong đợi **200**, `status: "ASSIGNED"`, `tripId`; lưu `tripId`. Customer gọi `GET /api/v1/trips/{{tripId}}` và `GET /api/v1/bookings/{{bookingId}}` bằng `{{customerToken}}`: cùng booking/trip/Driver, tiền và trạng thái phù hợp. Driver chuyển BUSY.

### PC17 – POSTMAN: Trạng thái chuyến theo trình tự

Với Bearer `{{driverToken}}`, gửi cùng URL `PATCH {{baseUrl}}/api/v1/trips/{{tripId}}/status` lần lượt ba body:

```json
{"status":"ARRIVED","latitude":10.7901,"longitude":106.7101}
```
```json
{"status":"IN_PROGRESS","latitude":10.7950,"longitude":106.7150}
```
```json
{"status":"COMPLETED","latitude":10.8001,"longitude":106.7201}
```

Mỗi lần mong đợi **200**, `previousStatus`/`status` đúng trình tự. Gửi thẳng COMPLETED trước khi ARRIVED sẽ nhận **409**. Cuối cùng Customer gọi `GET /api/v1/trips/{{tripId}}`: `COMPLETED`, `paymentStatus: "PAID"`; booking tương ứng `COMPLETED`. Tọa độ được ghi trong lịch sử đổi trạng thái. **Lưu ý giới hạn:** `GET /trips/{{tripId}}/location` hiện trả tọa độ pickup mô phỏng, chưa trả vị trí di chuyển mới nhất; không dùng endpoint này làm bằng chứng theo dõi vị trí thực.

### PC18 – POSTMAN: Hủy chuyến và thông báo

Tạo **booking/trip khác** với PC17: đặt booking mới bằng body PC15 và `Idempotency-Key: demo-cancel-trip-001`; lưu ID → `cancelBookingId`. Driver nhận offer và `POST /bookings/{{cancelBookingId}}/accept`; lưu `tripId` mới → `cancelTripId`. Trước khi bắt đầu chuyến, Customer gửi `POST {{baseUrl}}/api/v1/bookings/{{cancelBookingId}}/cancel`, Bearer `{{customerToken}}`, JSON `{"reason":"Khach doi lich"}`. Mong đợi **200**, booking `CANCELED`; `GET /trips/{{cancelTripId}}` cũng `CANCELED`, tiền `REFUNDED`. Gửi `GET /notifications?limit=20` với token Customer và Driver, đợi Kafka xử lý; tìm `trip.canceled` chứa `cancelTripId`. Không thử hủy trip PC17 đã COMPLETED.

### PC19 – POSTMAN: Thanh toán online

Luồng booking hiện tại dùng **ví nội bộ và escrow**, không phải callback nhà cung cấp. Trong Postman: trước PC15, `GET /api/v1/customers/me` ghi số dư; sau tạo booking, xem `fare`, `paymentStatus: "HELD"` và số dư giảm đúng `fare`. Sau PC16, `POST {{baseUrl}}/api/v1/payments` với Bearer `{{customerToken}}`, JSON `{"tripId":"{{tripId}}"}` → **200**, `method: "WALLET"`, `status: "HELD"` (nếu trip chưa hoàn tất). Lưu `id` → `paymentId`. Sau PC17, `GET /api/v1/payments/{{paymentId}}` → `status: "SETTLED"`; trip → `paymentStatus: "PAID"`; số dư Driver tăng.

**Độ lệch với phiếu:** phiếu ghi callback và Payment `COMPLETED`. Luồng escrow mới trả `SETTLED`; callback mock chỉ dùng cho trip cũ không có escrow. Các request trên chứng minh thanh toán ví và quyết toán, **chưa chứng minh đúng nhánh callback/`COMPLETED`**. Không đổi tên trạng thái khi báo cáo.

### PC20 – POSTMAN: Đánh giá chuyến đi

Sau PC17, `POST {{baseUrl}}/api/v1/trips/{{tripId}}/reviews`, Bearer `{{customerToken}}`, JSON `{"stars":5,"comment":"Tai xe dung gio"}` → **201**. `GET /api/v1/trips/{{tripId}}` cùng token thấy review gắn với trip và Driver. Gửi lại POST cho cùng trip → **409**. Trip chưa COMPLETED không được đánh giá.

## Thực hành 3

### PC21 – POSTMAN: Đăng ký Driver bằng OTP

Dùng một `driverPhone` chưa đăng ký, ví dụ `0912345002`. Ba request đều không Bearer:

1. `POST {{baseUrl}}/api/v1/drivers/otp/request`, JSON `{"phone":"0912345002"}` → **200**; lưu `_dev_otp` → `otp`.
2. `POST {{baseUrl}}/api/v1/drivers/otp/verify`, JSON `{"phone":"0912345002","otp":"{{otp}}"}` → **200**; lưu `registrationToken`.
3. `POST {{baseUrl}}/api/v1/drivers/register`, JSON:

```json
{"registrationToken":"{{registrationToken}}","phone":"0912345002","password":"TaiXeDemo@123","fullName":"Tai Xe Demo","licenseNumber":"GPLX-DEMO-02","licenseClass":"A1","licenseExpiryDate":"2035-01-01"}
```

Mong đợi **201**, `status: "PENDING_APPROVAL"`; lưu `id` → `driverId`, lưu số điện thoại → `driverPhone`. Driver chưa đăng nhập được trước PC22. OTP chỉ trả `_dev_otp` ở môi trường development; service không gửi SMS thật. Nếu đã dùng số ví dụ, đổi số ở cả ba request.

### PC22 – POSTMAN: Admin duyệt/từ chối Driver

1. `GET {{baseUrl}}/api/v1/drivers?status=PENDING_APPROVAL` với Bearer `{{adminToken}}`: tìm `driverId`.
2. `GET /api/v1/drivers/{{driverId}}/application` cùng token: xem chi tiết.
3. `POST /api/v1/drivers/{{driverId}}/approve` cùng token, body `{}` → **200**, `status: "OFFLINE"`.
4. `POST /api/v1/auth/login`, không Bearer, JSON `{"phone":"0912345002","password":"TaiXeDemo@123"}` → **200**, lưu `token` → `driverToken`. **Không đăng nhập bằng email** cho Driver tạo qua OTP.
5. `GET /api/v1/notifications?limit=20` với Bearer `{{driverToken}}`: tìm `driver.approved` sau khi Kafka xử lý.

Muốn thử từ chối, tạo **Driver khác** qua PC21 rồi `POST /api/v1/drivers/<id-khac>/reject` với Admin, JSON `{"reason":"Ho so khong hop le"}`. Hồ sơ REJECTED và tài khoản đó không đăng nhập được. Không từ chối `driverId` đang dùng cho PC15–PC18.

### PC23 – POSTMAN: Online/Offline

Với Bearer `{{driverToken}}`: `PUT /api/v1/drivers/me/location` JSON `{"latitude":10.7901,"longitude":106.7101}`; `PUT /api/v1/drivers/me/availability` JSON `{"status":"ONLINE"}` → **200 ONLINE**; gửi lại JSON `{"status":"OFFLINE"}` → **200 OFFLINE**. `GET /api/v1/drivers/{{driverId}}` xác nhận trạng thái được lưu. Cuối cùng bật lại ONLINE để dùng PC15–PC18.

### PC24 – POSTMAN: Mã hóa dữ liệu lúc lưu

Hai request chẩn đoán **chỉ bật ở development và chỉ nhận token Admin**, đọc trực tiếp các cột đã lưu nhưng không trả hash/ciphertext đầy đủ:

1. `GET {{baseUrl}}/api/v1/auth/demo/storage/{{customerId}}`, Bearer `{{adminToken}}` → **200**, `passwordIsBcrypt: true`, `passwordHashPrefix` bắt đầu `$2`, `phoneIsHashed: true`.
2. `GET {{baseUrl}}/api/v1/drivers/{{driverId}}/storage`, Bearer `{{adminToken}}` → **200**, `phoneEncrypted: true`, `licenseEncrypted: true`, có `phoneKeyId`/`licenseKeyId`.

Đây là metadata lấy bằng SELECT từ DB, khác response profile đã giải mã. Key ID chỉ cho biết khóa nào dùng; **không chứng minh khóa production đã được quản lý an toàn**. Cấu hình hiện có khóa fallback cho development, nên phần key management production cần trình bày bằng cấu hình triển khai riêng. Hai route trả 404 ngoài development, 403 với token Customer.

### PC25 – POSTMAN: SQL injection

`POST {{baseUrl}}/api/v1/auth/login`, không Bearer, JSON `{"email":"' OR 1=1 --","password":"anything"}` → **400 hoặc 401**, không có `token`. Đối chiếu `account.repository.js`: query đăng nhập dùng `$1` và mảng tham số. Response thất bại đơn lẻ không chứng minh mọi query trong hệ thống đều an toàn; tiêu chí này kiểm tra đường đăng nhập.

### PC26 – POSTMAN: XSS input

`POST {{baseUrl}}/api/v1/bookings` với Bearer `{{customerToken}}`, header `Idempotency-Key: demo-xss-booking-001`, JSON:

```json
{"pickupAddress":"<script>alert('hack')</script>","pickupLat":10.85,"pickupLng":106.75,"destinationAddress":"Diem den","destinationLat":10.86,"destinationLng":106.76}
```

Lưu ID, rồi `GET /api/v1/bookings/<id>` cùng token. Trường `pickup.address` đã lưu phải chứa `&lt;script&gt;`, không còn thẻ `<script>` nguyên dạng. Response POST lúc tạo có thể echo input gốc; **Postman không chạy HTML/JavaScript**, nên chỉ chứng minh output API đã escape ở GET, chưa chứng minh an toàn của giao diện web. Hủy booking sau khi kiểm tra nếu còn SEARCHING.

### PC27 – POSTMAN: JWT tampering

1. `GET {{baseUrl}}/api/v1/drivers` với Bearer `{{customerToken}}` → **403**: chữ ký hợp lệ nhưng Customer thiếu quyền.
2. `POST {{baseUrl}}/api/v1/demo/jwt-tampered` với Bearer `{{customerToken}}`, không body → **200** ở development; copy giá trị `tamperedToken` trong response. Gateway đổi `sub` và `role` thành Admin nhưng giữ chữ ký cũ.
3. Gửi lại `GET /api/v1/drivers`: trong **Authorization → Bearer Token → Token**, dán **giá trị token vừa copy** (không dán vào Body) → **401 `UNAUTHORIZED`**. Payload vẫn decode được; bước xác minh chữ ký thất bại. Endpoint demo trả 404 ngoài development.

### PC28 – POSTMAN: Truy cập API trái quyền

`PUT {{baseUrl}}/api/v1/drivers/me/availability` với Bearer `{{customerToken}}`, JSON `{"status":"ONLINE"}` → **403**. Thử `GET /api/v1/drivers` cùng token → **403**, không trả danh sách. Không Bearer → **401**. 401 là thiếu/xác thực sai token; 403 là token hợp lệ nhưng không có quyền.

### PC29 – POSTMAN: Rate limit

Tạo `GET {{baseUrl}}/api/v1/drivers/nearby?limit=1`, không Bearer/body. Trong **Collection Runner**, chạy request **55 lần**, không đặt delay; xem từng response. Gateway hiện giới hạn **50 request trong 10 giây trên mỗi IP** cho API chung, nên nếu Runner chạy đủ nhanh sẽ có **429** và `Retry-After`. Sau đó `GET {{baseUrl}}/health` vẫn **200**. Nếu không thấy 429, Runner đã gửi quá chậm; chạy lại nhanh hơn sau khi cửa sổ 10 giây qua. Phiếu mô tả `POST /booking >1000 request/s`, nhưng triển khai hiện tại là giới hạn trên; không tuyên bố đã đo 1000 request/s bằng Postman.

### PC30 – POSTMAN: Replay/idempotency

Dùng request tạo booking của PC15, giữ **cùng Customer, cùng `Idempotency-Key: demo-ride-001` và body giống hệt**, bấm Send lại. Response có **cùng `id` và `fare`**, không tạo booking/giữ tiền lần hai. `GET /api/v1/customers/me` xác nhận số dư không giảm lần nữa. Dùng cùng key nhưng đổi `destinationAddress` → **422 `IDEMPOTENCY_CONFLICT`**. Nếu đã có `tripId`, gửi `POST /api/v1/payments` hai lần với cùng Bearer, JSON `{"tripId":"{{tripId}}"}`; cả hai đọc lại cùng escrow `id`/`amount`/`status`, không có giao dịch thu tiền thứ hai. Phiếu minh họa `user_id/amount`, còn API này dùng `tripId` và xác định Customer từ JWT.

## Đối chiếu kết quả khi báo cáo

- **PC19:** demo ví/escrow đạt `SETTLED` và trip `PAID`; chưa có bằng chứng callback Payment `COMPLETED` theo đúng câu chữ phiếu.
- **PC24:** Postman đọc metadata từ cột DB qua endpoint development; quản lý khóa production cần bằng chứng cấu hình riêng.
- **PC26:** chứng minh chuỗi đã lưu được escape khi GET; Postman không chứng minh script không chạy trên một trang web cụ thể.
- **PC27:** `401` là do xác minh chữ ký thất bại, không phải payload không decode được.
- **PC29:** 429 theo ngưỡng triển khai 50/10 giây; không đồng nghĩa đã thử tải 1000 request/giây.
