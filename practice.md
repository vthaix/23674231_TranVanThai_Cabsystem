# SETUP

Mở Docker Desktop, sau đó chạy các lệnh CLI trong thư mục `backend/`:

```bash
cd backend
docker compose up -d --build
docker compose ps
```

Các ví dụ bên dưới dùng Gateway `http://localhost:8000`. Trong Postman, tạo environment với `baseUrl = http://localhost:8000`; những giá trị `customerToken`, `adminToken`, `driverToken`, `customerId`, `driverId`, `bookingId`, `offerId`, `tripId`, `paymentId` sẽ được điền từ response của từng bước. Mỗi lần thử đăng ký cần email, số điện thoại, CCCD và biển số mới để tránh HTTP 409 do trùng dữ liệu. Token JWT hết hạn sau khoảng 15 phút; đăng nhập lại nếu nhận HTTP 401.

Kiểm tra Gateway và 7 service:

```bash
curl -i http://localhost:8000/health
curl -i http://localhost:8000/ready
curl -i http://localhost:8000/health/services
```

Để chạy toàn bộ 25 kiểm tra PC6–PC30 tự động sau khi thực hành thủ công:

```bash
npm run smoke:pc6-pc30
```

Kết quả cần thấy là `25/25 criteria passed`. Script tạo dữ liệu test riêng cho mỗi lần chạy và không xóa volume. Chi tiết ở `smoke/README.md`.

# KỊCH BẢN BÁO CÁO CÁC TIÊU CHÍ ĐÃ PASS

## PC1 – Source Code Architecture

**Thông báo giảng viên:**

“Em chuyển sang tiêu chí PC1 – Source Code Architecture.”

**CLI:**

```bash
find services -maxdepth 2 -type f \( -name "package.json" -o -name "index.js" \) | sort
```

**Giải thích ngắn:**

“Project hiện có 7 microservice gồm identity, customer, driver, booking, trip, payment và notification. Mỗi service đều có package.json và entry point index.js, source code không để rỗng.”

**Kết luận:**

“PC1 đạt.”

---

## PC5 – Docker Compose / Containers

**Thông báo:**

“Em chuyển sang tiêu chí PC5 – Docker Compose và Containers.”

**CLI:**

```bash
docker compose ps
```

**Giải thích:**

“Các container của hệ thống đã được Docker Compose khởi động. Các service, database, Kafka và Redis đều đang chạy; các dependency health check cũng ở trạng thái healthy.”

**Kết luận:**

“PC5 đạt.”

---

## PC6 – Health Check

**Thông báo:**

“Em chuyển sang tiêu chí PC6 – Health Check.”

**CLI:**

```bash
curl -i http://localhost:8000/health
curl -i http://localhost:8000/ready
curl -i http://localhost:8000/health/services
```

**Giải thích:**

“Gateway cung cấp health check và readiness check. Endpoint health services kiểm tra trực tiếp trạng thái của 7 microservice phía sau Gateway.”

**Khi thấy HTTP 200:**

“Các endpoint trả về HTTP 200, các service backend đều ở trạng thái up.”

**Kết luận:**

“PC6 đạt.”

---

## PC7 – Kafka / Asynchronous Communication

**Thông báo:**

“Em chuyển sang tiêu chí PC7 – Kafka.”

**CLI:**

```bash
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka:9092 \
  --list
```

**Giải thích:**

“Kafka đang được sử dụng cho giao tiếp bất đồng bộ giữa các service. Topic booking.events đã được tạo.”

**Tiếp tục kiểm tra consumer:**

```bash
docker compose exec -T kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --describe \
  --group notification-service
```

**Giải thích:**

“Notification-service sử dụng consumer group notification-service để nhận event từ Kafka.”

**Kiểm tra publish và consume thực tế:** Chạy `npm run smoke:pc6-pc30`; dòng `PASS PC7 Kafka publish and consume` chứng minh script đã tạo topic test, publish một message và đọc lại đúng message đó. Với dữ liệu nghiệp vụ, sau khi hủy trip ở PC18, kiểm tra `GET /api/v1/notifications` cho cả hai token.

**Giải thích kết quả:**

“Outbox của booking, trip và driver được chuyển lên các topic Kafka; notification-service consume và tạo notification. Lệnh CLI trên cho thấy topic và consumer group, còn script PC7 kiểm tra publish/consume bằng một message thật.”

**Kết luận:**

“PC7 đạt.”

---

## PC8 – Gateway-only Access

**Thông báo:**

“Em chuyển sang tiêu chí PC8 – Gateway-only Access.”

**CLI:**

```bash
docker compose ps
```

**Giải thích:**

“Trong Docker Compose, chỉ Gateway publish port ra host. Các microservice backend chỉ expose port nội bộ trong Docker network.”

**Kiểm tra trực tiếp từ host:**

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3001/health
curl -i http://localhost:3002/health
curl -i http://localhost:3003/health
curl -i http://localhost:3004/health
curl -i http://localhost:3005/health
curl -i http://localhost:3006/health
```

**Giải thích:**

“Các port 3000 đến 3006 không publish ra host nên client bên ngoài không truy cập trực tiếp được vào microservice.”

**Sau đó kiểm tra Gateway:**

```bash
curl -i http://localhost:8000/health
```

**Giải thích:**

“Gateway là entry point được publish ra ngoài, còn các service backend chỉ giao tiếp trong mạng nội bộ Docker.”

**Kết luận:**

“PC8 đạt.”

---

## Chuẩn bị dữ liệu Postman cho PC9–PC30

Các request công khai không cần token là đăng ký, đăng nhập, OTP và tìm tài xế quanh tọa độ. Các request còn lại thêm header `Authorization: Bearer {{customerToken}}`, `{{driverToken}}` hoặc `{{adminToken}}` đúng vai trò. Với POST/PUT/PATCH, thêm `Content-Type: application/json`. Chỉ request tạo booking và tạo payment cần `Idempotency-Key`; mỗi giao dịch mới dùng một key mới.

Thứ tự thử thuận tiện: PC9–PC14 → PC21–PC23 → PC15–PC20 → PC24–PC30. PC15–PC20 cần tài xế đã duyệt và ONLINE. Để thử hủy trip ở PC18, tạo một booking/trip **khác** với trip đã hoàn thành ở PC17, vì trip `COMPLETED` không thể hủy.

## PC9 – Đăng ký tài khoản khách hàng

**Postman:** `POST {{baseUrl}}/api/v1/auth/register`

```json
{
  "fullName": "Khach Hang Demo",
  "email": "khachdemo01@example.com",
  "phone": "+84912345001",
  "password": "DemoPass@123"
}
```

**Cần thấy:** HTTP 201, response có `id`, `role: "CUSTOMER"`, `status: "ACTIVE"`. Lưu `id` vào `customerId`. Dùng email/phone mới nếu đã chạy trước đó. Identity-service tạo account và gọi customer-service tạo profile; sau đó đăng nhập ở PC10.

**Kết luận:** “PC9 đạt khi tài khoản được tạo và đăng nhập được.”

---

## PC10 – Đăng nhập khách hàng

**Postman:** `POST {{baseUrl}}/api/v1/auth/login`

```json
{ "email": "khachdemo01@example.com", "password": "DemoPass@123" }
```

**Cần thấy:** HTTP 200, response có `token`, `accountId = {{customerId}}`, `role: "CUSTOMER"`. Lưu `token` vào `customerToken`. Mật khẩu được so sánh bằng bcrypt, JWT được ký HS256. Để thực hiện PC13/PC22, đăng nhập admin bằng cùng endpoint với email `admin@cabsystem.com`, password seed mặc định `Admin@123456` (hoặc giá trị `SEED_PASSWORD` nếu đã cấu hình) và lưu `adminToken`.

**Kết luận:** “PC10 đạt khi token hợp lệ được cấp cho tài khoản đang hoạt động.”

---

## PC11 – Lấy thông tin khách hàng theo ID

**Postman:** `GET {{baseUrl}}/api/v1/customers/{{customerId}}` với `Bearer {{customerToken}}`.

**Cần thấy:** HTTP 200; `id`, `fullName`, `email` đúng khách hàng PC9. Nếu không có token: HTTP 401; nếu token Customer khác xem ID này: HTTP 403. Service chỉ trả hồ sơ của chính Customer, trừ vai trò nhân viên/admin được phép.

**Kết luận:** “PC11 đạt khi xem được đúng profile qua Gateway bằng token.”

---

## PC12 – Lấy thông tin tài xế theo ID

**Postman:** `GET {{baseUrl}}/api/v1/drivers/00000000-0000-0000-0000-000000000011` với `Bearer {{customerToken}}`.

**Cần thấy:** HTTP 200, `id` đúng, có `status`, `vehicle`, số điện thoại được che bằng dấu `•`. Đây là một tài xế mẫu. Sau PC21–PC22 có thể thay ID bằng `{{driverId}}` để xem hồ sơ vừa đăng ký.

**Kết luận:** “PC12 đạt khi lấy được thông tin tài xế và không lộ số điện thoại đầy đủ cho Customer.”

---

## PC13 – Tài xế quanh khu vực, bán kính và phân trang

**Postman:**

1. `GET {{baseUrl}}/api/v1/admin/drivers?limit=50` với `Bearer {{adminToken}}`: `pagination.total` ít nhất 5; dữ liệu seed gồm ONLINE, OFFLINE, BUSY, PENDING_APPROVAL.
2. `GET {{baseUrl}}/api/v1/drivers/nearby?lat=10.776889&lng=106.700806&radius=1000&limit=1&page=1`.
3. Gọi lại với `page=2`.

**Cần thấy:** mỗi trang tối đa 1 tài xế; ID của hai trang khác nhau; `distanceM <= 1000`, `status: "ONLINE"`. Tài xế ở xa hơn 1 km không xuất hiện. Driver-service tính khoảng cách từ tọa độ và áp dụng limit/page.

**Kết luận:** “PC13 đạt khi có dữ liệu mẫu đủ trạng thái và danh sách quanh điểm đón được lọc/phân trang đúng.”

---

## PC14 – Danh sách booking của Customer

**Postman:** Với `Bearer {{customerToken}}`, gửi `POST {{baseUrl}}/api/v1/bookings` **5 lần**, mỗi lần đổi header `Idempotency-Key` (`demo-list-1` đến `demo-list-5`). Dùng pickup ở xa tài xế để các booking này không ảnh hưởng luồng nhận chuyến:

```json
{
  "pickupAddress": "Diem don danh sach",
  "pickupLat": 10.85,
  "pickupLng": 106.75,
  "destinationAddress": "Diem den danh sach",
  "destinationLat": 10.86,
  "destinationLng": 106.76,
  "vehicleType": "BIKE"
}
```

Sau đó gọi `GET {{baseUrl}}/api/v1/bookings?limit=2&page=1`, rồi `page=2`.

**Cần thấy:** HTTP 200, `pagination.total >= 5`, mỗi trang có 2 bản ghi, ID hai trang khác nhau, mọi `customerId` bằng `{{customerId}}`. Booking-service lọc theo người trong JWT.

**Kết luận:** “PC14 đạt khi Customer xem được ít nhất 5 booking của mình với limit/page.”

---

## PC21 – Đăng ký tài xế bằng OTP

Chọn số điện thoại, CCCD và biển số chưa từng dùng. Trong môi trường development, OTP có trong `_dev_otp` của response.

**Postman:**

1. `POST {{baseUrl}}/api/v1/drivers/otp/request` với `{ "phone": "+84912345002" }` → HTTP 200; lưu `_dev_otp`.
2. `POST {{baseUrl}}/api/v1/drivers/otp/verify` với `{ "phone": "+84912345002", "otp": "<OTP vừa nhận>" }` → HTTP 200; lưu `registrationToken`.
3. `POST {{baseUrl}}/api/v1/drivers/register`:

```json
{
  "registrationToken": "<registrationToken>",
  "phone": "+84912345002",
  "fullName": "Tai Xe Demo",
  "nationalId": "012345678902",
  "licenseNumber": "GPLX-DEMO-02",
  "licenseClass": "A1",
  "licenseExpiryDate": "2035-01-01",
  "vehicle": {
    "vehicleType": "BIKE",
    "plateNumber": "59A-DEMO-02",
    "brand": "Honda",
    "model": "Wave"
  }
}
```

**Cần thấy:** HTTP 201, `status: "PENDING_APPROVAL"`; lưu `id` vào `driverId`. Dữ liệu nhạy cảm được mã hóa khi lưu. Tài khoản Driver được tạo ở identity-service với password demo mặc định `DriverPass@123`.

**Kết luận:** “PC21 đạt khi OTP hợp lệ dẫn tới hồ sơ chờ duyệt.”

---

## PC22 – Admin duyệt hồ sơ tài xế

**Postman:**

1. `GET {{baseUrl}}/api/v1/admin/drivers?status=PENDING_APPROVAL` với `Bearer {{adminToken}}`; tìm `{{driverId}}`.
2. `GET {{baseUrl}}/api/v1/admin/drivers/{{driverId}}` để xem chi tiết.
3. `POST {{baseUrl}}/api/v1/admin/drivers/{{driverId}}/approve` với `Bearer {{adminToken}}`, body `{}`.
4. Đăng nhập Driver bằng `POST /api/v1/auth/login`, body `{ "phone": "+84912345002", "password": "DriverPass@123" }`; lưu `driverToken`.
5. `GET {{baseUrl}}/api/v1/notifications` với `Bearer {{driverToken}}`.

**Cần thấy:** bước 3 trả `status: "OFFLINE"`; notification có `eventType: "driver.approved"` và `body` chứa `driverId` (có thể chờ 1–2 giây để Kafka xử lý). Muốn thử nhánh từ chối, đăng ký hồ sơ mới rồi gọi `POST /api/v1/admin/drivers/{{driverIdMoi}}/reject` với `{ "reason": "Ho so khong hop le" }`; kết quả là `REJECTED`.

**Kết luận:** “PC22 đạt khi Admin duyệt/từ chối đúng trạng thái và Driver nhận kết quả.”

---

## PC23 – Bật/tắt nhận chuyến

**Postman:** Dùng `Bearer {{driverToken}}`.

1. `PUT {{baseUrl}}/api/v1/drivers/me/location` với `{ "latitude": 10.7901, "longitude": 106.7101 }`.
2. `PUT {{baseUrl}}/api/v1/drivers/me/availability` với `{ "status": "ONLINE" }` → `ONLINE`.
3. Gọi lại availability với `{ "status": "OFFLINE" }` → `OFFLINE`.
4. Chuyển về `ONLINE` để tiếp tục PC15–PC17.

**Cần thấy:** mỗi response HTTP 200 và `status` đúng; `GET /api/v1/drivers/{{driverId}}` phản ánh trạng thái mới. Driver đang chờ duyệt không được bật ONLINE.

**Kết luận:** “PC23 đạt khi trạng thái online/offline được lưu và trả về đúng.”

---

## PC15 – Khách hàng đặt xe, hệ thống tìm tài xế

**Postman:** `POST {{baseUrl}}/api/v1/bookings` với `Bearer {{customerToken}}`, header `Idempotency-Key: demo-ride-001` và body:

```json
{
  "pickupAddress": "Diem don Quan 1",
  "pickupLat": 10.7901,
  "pickupLng": 106.7101,
  "destinationAddress": "Diem den Quan 1",
  "destinationLat": 10.8001,
  "destinationLng": 106.7201,
  "vehicleType": "BIKE"
}
```

**Cần thấy:** HTTP 201, `status: "SEARCHING"`, có `id` để lưu vào `bookingId`. Gọi ngay `GET {{baseUrl}}/api/v1/offers` với `Bearer {{driverToken}}`: phần tử `bookingId = {{bookingId}}`. Offer có hạn khoảng 30 giây, nên chuyển ngay sang PC16. Booking-service gọi driver-service tìm tài xế quanh điểm đón và tạo offer.

**Kết luận:** “PC15 đạt khi booking SEARCHING được tạo và tài xế gần đó nhận offer.”

---

## PC16 – Tài xế nhận chuyến

**Postman:** Lấy `id` của offer ở PC15, lưu thành `offerId`; gọi `POST {{baseUrl}}/api/v1/offers/{{offerId}}/accept` với `Bearer {{driverToken}}`, body `{}`.

**Cần thấy:** HTTP 200, `status: "ASSIGNED"`, có `tripId` để lưu. Customer gọi `GET {{baseUrl}}/api/v1/trips/{{tripId}}` với `Bearer {{customerToken}}`: `driverId = {{driverId}}`, `status: "ASSIGNED"`, có `driverSnapshot`. Driver-service chuyển tài xế sang BUSY.

**Kết luận:** “PC16 đạt khi offer được chấp nhận và trip gắn đúng tài xế/khách hàng.”

---

## PC17 – Cập nhật trạng thái chuyến theo trình tự

**Postman:** Với `Bearer {{driverToken}}`, gọi lần lượt `PATCH {{baseUrl}}/api/v1/trips/{{tripId}}/status`:

```json
{ "status": "ARRIVED", "latitude": 10.7905, "longitude": 106.7105 }
```

Sau đó body `{ "status": "IN_PROGRESS", "latitude": 10.795, "longitude": 106.715 }`, rồi `{ "status": "COMPLETED", "latitude": 10.8001, "longitude": 106.7201 }`.

**Cần thấy:** mỗi bước HTTP 200, `previousStatus` và `status` đúng trình tự `ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED`; `GET /api/v1/trips/{{tripId}}` trả `COMPLETED`. Nếu thử đi thẳng từ ASSIGNED tới COMPLETED trước các bước trên, API trả HTTP 409. Trip-service lưu lịch sử trạng thái và tọa độ cập nhật.

**Kết luận:** “PC17 đạt khi trạng thái chỉ tiến theo thứ tự hợp lệ.”

---

## PC18 – Hủy booking/trip và nhận thông báo

**Trường hợp booking chưa gán:** Tạo booking mới bằng `POST /api/v1/bookings` với một `Idempotency-Key` mới, lưu ID `cancelBookingId`; gọi `POST {{baseUrl}}/api/v1/bookings/{{cancelBookingId}}/cancel` với `Bearer {{customerToken}}`, body `{ "reason": "Khach doi lich" }`. Response cần `status: "CANCELED"`; danh sách PC14 phản ánh trạng thái này.

**Trường hợp đã gán tài xế:** Dùng **một Driver ONLINE khác** (đăng ký/duyệt như PC21–PC23; đổi phone/CCCD/biển số), cập nhật vị trí của Driver này thành `10.8001, 106.7201`. Tạo booking mới với điểm đón `pickupLat: 10.8001`, `pickupLng: 106.7201` và `Idempotency-Key` mới; nhận offer như PC15–PC16. Lưu trip ID mới `cancelTripId`, rồi gọi `POST {{baseUrl}}/api/v1/trips/{{cancelTripId}}/cancel` với `Bearer {{customerToken}}`, body `{ "reason": "Khach huy truoc khi bat dau" }`.

**Cần thấy:** HTTP 200, trip trả `CANCELED`; `GET /api/v1/trips/{{cancelTripId}}` xác nhận. Gọi `GET /api/v1/notifications` bằng token Customer **và** token Driver của trip vừa hủy: mỗi bên có notification `eventType: "trip.canceled"`, `body` chứa `cancelTripId` sau khi Kafka xử lý. Không dùng trip PC17 đã COMPLETED vì trạng thái đó không được hủy.

**Kết luận:** “PC18 đạt khi trip được hủy đúng thời điểm và hai bên nhận thông báo.”

---

## PC19 – Thanh toán online và callback có chữ ký

**Postman:** Dùng trip `{{tripId}}` đã COMPLETED ở PC17. Gọi `POST {{baseUrl}}/api/v1/payments` với `Bearer {{customerToken}}`, header `Idempotency-Key: demo-pay-001`, body `{ "tripId": "{{tripId}}" }`.

**Cần thấy:** HTTP 201, `status: "PENDING"`; lưu `id` vào `paymentId`, `providerTransactionId` vào biến cùng tên và `amount` vào `paymentAmount`. Để mock provider gửi callback HMAC thật, từ terminal trong `backend/` chạy (thay ba giá trị bằng response vừa nhận):

```bash
docker compose exec -T mock-payment-provider node -e '
fetch("http://localhost:4001/mock/transactions/" + process.argv[1] + "/complete", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ paymentId: process.argv[2], amount: Number(process.argv[3]) })
}).then(r => r.json()).then(console.log)
' '<providerTransactionId>' '<paymentId>' '<paymentAmount>'
```

Sau đó dùng Postman gọi `GET {{baseUrl}}/api/v1/payments/{{paymentId}}` và `GET {{baseUrl}}/api/v1/trips/{{tripId}}` với `Bearer {{customerToken}}`.

**Cần thấy:** payment `COMPLETED`, trip `paymentStatus: "PAID"`. Callback không đúng `X-Signature` bị HTTP 401. Mock provider tạo chữ ký HMAC SHA-256 từ body rồi gửi tới payment-service trong Docker network.

**Kết luận:** “PC19 đạt khi callback hợp lệ hoàn tất payment và cập nhật trip.”

---

## PC20 – Đánh giá chuyến đi

**Postman:** `POST {{baseUrl}}/api/v1/trips/{{tripId}}/reviews` với `Bearer {{customerToken}}`:

```json
{ "stars": 5, "comment": "Tai xe dung gio" }
```

**Cần thấy:** HTTP 201, response có `tripId`, `driverId`, `stars: 5`. `GET /api/v1/trips/{{tripId}}` có `review.stars = 5`. Gửi lại cho cùng trip trả HTTP 409; trip chưa COMPLETED cũng không được đánh giá.

**Kết luận:** “PC20 đạt khi review được lưu duy nhất và liên kết với trip đã hoàn thành.”

---

## PC24 – Mã hóa dữ liệu nhạy cảm khi lưu DB

Sau PC9 và PC21, dùng ID thật để xem **cột lưu trong DB**, không dùng API đã che dữ liệu. Trong terminal `backend/`:

```bash
docker compose exec -T identity-db psql -U identity -d identity_db -c \
  "SELECT password_hash FROM accounts WHERE id = '<customerId>';"
docker compose exec -T driver-db psql -U driver -d driver_db -c \
  "SELECT phone_enc, national_id_enc, license_number_enc FROM drivers WHERE id = '<driverId>';"
```

**Cần thấy:** `password_hash` bắt đầu bằng `$2` (bcrypt), không phải mật khẩu gốc; ba cột Driver bắt đầu bằng `enc:v1:` (AES-256-GCM), không có số điện thoại/CCCD/GPLX plaintext. Key ID nằm trong ciphertext; module `backend/shared/src/crypto/index.js` hỗ trợ khóa qua `DATA_ENCRYPTION_KEYS` và `DATA_ENCRYPTION_ACTIVE_KEY_ID`. Compose development hiện dùng khóa fallback nếu chưa truyền hai biến này vào container. Smoke test xác minh dữ liệu đã mã hóa; xoay vòng khóa và quản lý secret production cần kiểm tra vận hành riêng.

**Kết luận:** “PC24 đạt ở mức dữ liệu lưu trong DB không đọc được plaintext.”

---

## PC25 – Thử SQL injection

**Postman:** `POST {{baseUrl}}/api/v1/auth/login`:

```json
{ "email": "' OR 1=1 --", "password": "anything" }
```

**Cần thấy:** HTTP 400 hoặc 401, không có token hay dữ liệu tài khoản. Query đăng nhập dùng tham số thay vì ghép chuỗi SQL từ input.

**Kết luận:** “PC25 đạt khi payload không vượt qua đăng nhập.”

---

## PC26 – Thử XSS trong input

**Postman:** Tạo booking mới với `Bearer {{customerToken}}`, `Idempotency-Key` mới, body như PC14 nhưng thay `pickupAddress` bằng `<script>alert('hack')</script>`. Gọi `GET {{baseUrl}}/api/v1/bookings?limit=50` và tìm booking vừa tạo.

**Cần thấy:** `pickup.address` trong response danh sách không chứa thẻ `<script>` thực thi; ký tự đặc biệt đã được escape. Có thể xem thêm review comment bằng payload tương tự trên một trip COMPLETED **chưa có review**.

**Kết luận:** “PC26 đạt khi nội dung script không được trả ra dưới dạng HTML thực thi.”

---

## PC27 – Sửa payload JWT

Lấy `customerToken` ở PC10. Từ terminal, tạo token bị sửa payload role nhưng giữ signature cũ (thay placeholder bằng token thật):

```bash
node -e 'const t=process.argv[1].split("."); const p=JSON.parse(Buffer.from(t[1],"base64url")); t[1]=Buffer.from(JSON.stringify({...p,role:"ADMIN"})).toString("base64url"); console.log(t.join("."))' '<customerToken>'
```

Copy token được in ra và gửi `GET {{baseUrl}}/api/v1/admin/drivers` với `Authorization: Bearer <token đã sửa>`.

**Cần thấy:** HTTP 401 `UNAUTHORIZED`, không có danh sách tài xế. Gateway chỉ chấp nhận HS256 và xác minh chữ ký; sửa payload làm chữ ký sai.

**Kết luận:** “PC27 đạt khi token giả mạo không được chấp nhận.”

---

## PC28 – Customer gọi API dành cho Driver

**Postman:** `PUT {{baseUrl}}/api/v1/drivers/me/availability` với **Bearer `{{customerToken}}`**, body `{ "status": "ONLINE" }`.

**Cần thấy:** HTTP 403 `FORBIDDEN`, không trả dữ liệu Driver. Gateway chặn Customer ở route `/drivers/me` trước khi proxy.

**Kết luận:** “PC28 đạt khi role Customer không được dùng API Driver.”

---

## PC29 – Gửi dồn request kiểm tra rate limit

Trong terminal `backend/`, chạy nhanh nhiều request từ cùng một client:

```bash
for i in $(seq 1 55); do
  curl -s -o /dev/null -w '%{http_code}\n' \
    'http://localhost:8000/api/v1/drivers/nearby?limit=1'
done
curl -i http://localhost:8000/health
```

**Cần thấy:** trong 55 lần có HTTP 429 (giới hạn Gateway hiện tại là 50 request/10 giây cho tuyến API chung); `/health` vẫn HTTP 200. Cần chạy vòng lặp đủ nhanh trong một cửa sổ 10 giây. Smoke script cũng tự kiểm tra PC29.

**Kết luận:** “PC29 đạt khi request vượt ngưỡng bị chặn và Gateway vẫn hoạt động.”

---

## PC30 – Chống replay/double charge

**Postman:** Gửi lại **đúng** request tạo payment của PC19: cùng Customer token, cùng `tripId`, cùng header `Idempotency-Key: demo-pay-001`.

**Cần thấy:** response HTTP 201 có **cùng** `id`, `providerTransactionId`, `amount` như response ban đầu; không có payment thứ hai. Nếu giữ key nhưng đổi `tripId`, API trả HTTP 422 `IDEMPOTENCY_CONFLICT`. Callback provider gửi lại cùng `providerEventId` được trả `ALREADY_PROCESSED` và không cập nhật giao dịch lần nữa. Booking PC15 cũng dùng cơ chế idempotency tương tự.

**Kết luận:** “PC30 đạt khi replay trả response cũ và không double charge.”
