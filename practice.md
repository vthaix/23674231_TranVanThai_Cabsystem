# SETUP

Mở Docker Desktop và khởi động PostgreSQL trên máy Mac. Lần đầu chạy, sao chép `backend/.env.example` thành `backend/.env`, điền mật khẩu rồi tạo các database bằng lệnh sau trong thư mục `backend/` (chi tiết ở `backend/README.md`):

```bash
cd backend
python3 scripts/setup-host-postgres.py
```

Sau đó build và chạy hệ thống:

```bash
docker compose up -d --build
docker compose ps
```

Sau khi sửa luồng booking/trip hoặc thời hạn token, build lại các service liên quan trong thư mục `backend/`:

```bash
docker compose up -d --build identity-service customer-service driver-service booking-service trip-service payment-service
docker compose ps
```

Tất cả request Postman bên dưới dùng Gateway `http://localhost:8000`. Token đăng nhập có hiệu lực **60 phút**. Nếu Postman trả HTTP 401 vì token hết hạn, gọi lại `POST /api/v1/auth/login` và ghi đè biến token tương ứng. Không cần đăng ký lại tài khoản.

**Dữ liệu mẫu hiện tại:** `kh01@gmail.com`–`kh05@gmail.com`, `dr01@gmail.com`–`dr10@gmail.com` và `admin@gmail.com` đều dùng mật khẩu `12345678`. Mỗi khách có 9 booking và 5 trip `COMPLETED` có review. Chỉ `dr01` và `dr02` đang `ONLINE`; các driver khác `OFFLINE` hoặc `PENDING_APPROVAL`. Hai tài xế này ở gần `10.7769, 106.7008`. Nếu chạy lại script `node scripts/reset-requested-demo-data.js` theo `backend/README.md`, mỗi khách có một booking `SEARCHING` mới. Đợi nó hết hạn 30 phút hoặc hủy trước khi tạo booking khác; không dùng `docker compose up -d --build` để mong dữ liệu mẫu tự nạp lại, vì `SEED_ON_START=false`.

**Cách nhập request trong Postman:** chọn đúng method và URL ở từng PC; với JSON chọn **Body → raw → JSON** (Postman sẽ gửi `Content-Type: application/json`). Với request cần token, chọn **Authorization → Bearer Token** và nhập biến như `{{customerToken}}`; hoặc thêm header `Authorization: Bearer {{customerToken}}`. GET không có body. Mọi URL công khai bên dưới đi qua Gateway; đường `/internal/...` chỉ dành cho service trong Docker network, không gửi trực tiếp từ Postman trên host. Tạo environment các biến `otp`, `registrationToken`, `customerToken`, `pc14CustomerToken`, `adminToken`, `driverToken`, `customerId`, `driverId`, `bookingId`, `tripId`, `paymentId`, `cancelBookingId`, `cancelTripBookingId`, `cancelTripId`. Khi có response, sao chép đúng trường được hướng dẫn vào biến tương ứng. Giữa các lần demo nên đổi email, phone và `Idempotency-Key` để tránh trùng dữ liệu.

**Số điện thoại:** nhập chuỗi đúng 10 chữ số, ví dụ `0912345001`; không thêm `+84`, khoảng trắng hoặc dấu phân cách. Quy tắc này áp dụng cho đăng ký, OTP và đăng nhập bằng số điện thoại.

Kiểm tra Gateway và 7 service:

```bash
curl -i http://localhost:8000/health
curl -i http://localhost:8000/ready
curl -i http://localhost:8000/health/services
```

Script kiểm tra PC6–PC30 dùng dữ liệu seed cũ ở một số tiêu chí. Với bộ dữ liệu mẫu hiện tại, dùng các bước Postman bên dưới để demo; có thể chạy script riêng nếu đã chuẩn bị fixture mà script yêu cầu:

```bash
npm run smoke:pc6-pc30
```

Script tạo thêm dữ liệu test mỗi lần chạy và không xóa volume. Chi tiết ở `smoke/README.md`.

PC2 (kiểm tra `.gitignore` và `.env` **trên GitHub**) chưa được ghi là đã đạt trong tài liệu này vì chưa đối chiếu repository trên GitHub; chỉ kiểm tra file tại máy không đủ để kết luận phần “trên GitHub”.

# KỊCH BẢN BÁO CÁO CÁC TIÊU CHÍ ĐÃ PASS

## PC1 – Source Code Architecture

**Thông báo giảng viên:**

“Em chuyển sang tiêu chí PC1 – Source Code Architecture.”

**CLI:**

```bash
cd backend
find services -type d -name node_modules -prune -o \
  -type f \( -name package.json -o -name index.js \) -print \
  | grep -E '^services/[^/]+/(package.json|src/index.js)$' \
  | sort
```

Chạy từ thư mục gốc dự án; kết quả cần có 14 dòng, tương ứng 7 service × 2 file. Sau đó chạy `ls` để chỉ thêm `gateway/`, `shared/`, `mocks/` và `docker-compose.yml` trong `backend/`.

**Giải thích ngắn:**

“Project hiện có 7 microservice gồm identity, customer, driver, booking, trip, payment và notification. Mỗi service đều có package.json và entry point index.js. Gateway là cửa vào API, shared chứa mã dùng chung, mocks mô phỏng nhà cung cấp ngoài và Docker Compose ghép các thành phần để chạy hệ thống.”

**Kết luận:**

“PC1 đạt.”

---

## PC3 – Nhiệm vụ của Gateway

**Hiểu đơn giản:** Gateway là cửa vào chung ở `localhost:8000`. Nó chuyển request đến đúng service, kiểm tra token/quyền và giới hạn tần suất gọi API. Client không cần biết cổng nội bộ của từng service.

**Cách test (Terminal, chạy trong `backend/` sau khi `docker compose up -d --build`):**

```bash
curl -i http://localhost:8000/health
curl -i 'http://localhost:8000/api/v1/drivers/nearby?lat=10.776889&lng=106.700806&radius=1000&limit=1'
curl -i http://localhost:8000/api/v1/bookings
```

**Trong Postman:** tạo ba request `GET` với đúng URL trên; để trống Authorization và Body.

**Cần thấy:** lần lượt HTTP `200` với `service: "gateway"`; HTTP `200` với dữ liệu tìm tài xế từ driver-service (mảng có thể rỗng); HTTP `401` vì `/bookings` cần đăng nhập. Nếu request thứ hai trả `401`/`403`, kiểm tra lại route và token; nếu `502`/`503`, kiểm tra container service bằng `docker compose ps` và `docker compose logs --tail=30 driver-service`.

**Cách nói khi demo:** “Cả ba request đều đi vào cổng 8000. Gateway tự trả health, chuyển `/drivers/nearby` sang driver-service và từ chối truy cập booking khi chưa đăng nhập. PC27–PC29 kiểm tra sâu hơn chữ ký JWT, quyền và rate limit.”

---

## PC4 – IPC giữa các microservice

**IPC là gì?** IPC (*Inter-Process Communication*) nghĩa là hai chương trình/service trao đổi dữ liệu với nhau. Ở đây có hai cách: **HTTP nội bộ** khi service A cần câu trả lời ngay từ service B; **Kafka** khi A phát sự kiện và B xử lý sau. Ví dụ PC4 dễ nhất là identity-service gọi customer-service bằng HTTP khi đăng ký khách hàng. PC7 kiểm tra riêng Kafka.

**Cách test IPC bằng Postman (mỗi lần chạy dùng email và số điện thoại mới):**

1. `POST http://localhost:8000/api/v1/auth/register`, Body → raw → JSON: `{ "fullName": "Khach Test IPC", "email": "ipc001@example.com", "phone": "0912345001", "password": "Test@123456" }`. Cần HTTP `201`; lưu `id` trong response thành `customerId`. Nếu `409`, đổi email và phone rồi thử lại.
2. `POST http://localhost:8000/api/v1/auth/login`, JSON: `{ "email": "ipc001@example.com", "password": "Test@123456" }` (dùng email vừa đăng ký). Cần HTTP `200`; lưu `token` thành `customerToken`.
3. `GET http://localhost:8000/api/v1/customers/{{customerId}}`, Authorization → Bearer Token → `{{customerToken}}`, không có Body. Cần HTTP `200`, `id` trùng `customerId`, `fullName` và `email` trùng bước 1.

**Vì sao đây là bằng chứng IPC?** Request đăng ký chỉ đi vào identity-service. Trong quá trình xử lý, identity-service gọi `POST /internal/customers` của customer-service bằng service token để tạo profile; bước 3 đọc được profile đó từ customer-service. Nếu customer-service không tạo được profile, đăng ký trả lỗi `503` thay vì `201`. Muốn đối chiếu mã nguồn, xem `services/identity-service/src/clients/customer.client.js` và `services/customer-service/src/routes/internal.routes.js`.

**Xem log khi lỗi:**

```bash
docker compose logs --tail=50 identity-service customer-service
```

**Cách nói khi demo:** “Đăng ký ở identity-service tạo đồng thời profile ở customer-service qua HTTP nội bộ. Cùng một ID đọc được ở cả hai bước. Các luồng IPC khác: booking ↔ driver/trip và payment ↔ trip; event thông báo đi qua Kafka ở PC7.”

---

## PC5 – Docker Compose / Containers

**Cách test (trong `backend/`):**

```bash
docker compose ps -a
curl -i http://localhost:8000/health/services
```

**Cần thấy:** `docker compose ps -a` liệt kê Gateway, 7 service, Kafka, Redis, MongoDB, 2 mock provider; container `kafka-init` có thể đã `Exited (0)` vì nó chỉ tạo topic rồi kết thúc. API `/health/services` trả HTTP `200` và 7 service có `status: "up"`. Nếu service `down`, xem `docker compose logs --tail=50 <tên-service>`.

**Cách nói khi demo:** “Compose chạy các service và hạ tầng liên quan. Sáu PostgreSQL database nằm trên máy Mac, ngoài Compose; service kết nối qua `host.docker.internal:5432`.”

---

## PC6 – Health Check

**Cách test (trong Terminal hoặc tạo ba request GET tương ứng trong Postman; không cần token/body):**

```bash
curl -i http://localhost:8000/health
curl -i http://localhost:8000/ready
curl -i http://localhost:8000/health/services
```

**Cần thấy:** `/health` trả HTTP `200`, `status: "ok"`; `/ready` trả HTTP `200`, `status: "ready"`; `/health/services` trả HTTP `200`, `status: "ok"` và mảng `services` có 7 phần tử đều `up`. Nếu service nào `down`, endpoint cuối trả `503` và chỉ rõ service đó. Lưu ý `/ready` hiện chỉ báo Gateway đã khởi động; `/health/services` mới hỏi health của cả 7 service.

**Cách nói khi demo:** “Gateway đang chạy, sẵn sàng nhận request; endpoint tổng hợp xác nhận cả 7 service phía sau đang up.”

---

## PC7 – Kafka / Asynchronous Communication

**Hiểu đơn giản:** Service phát một *event* vào Kafka topic (hàng đợi); service khác đọc event sau đó. Người gửi không phải chờ người nhận xử lý xong. `notification-service` dùng consumer group `notification-service` để đọc các topic nghiệp vụ.

**Cách test chỉ bằng Postman (dễ trình bày nhất):** cần có `{{customerToken}}` từ PC9–PC10. Không cần tạo Driver hay chạy PC18.

1. Gửi `POST http://localhost:8000/api/v1/bookings` với Authorization → Bearer Token → `{{customerToken}}`, header `Idempotency-Key: pc7-booking-001` và Body → raw → JSON:

   ```json
   {
     "pickupAddress": "Diem don test Kafka",
     "pickupLat": 10.7901,
     "pickupLng": 106.7101,
     "destinationAddress": "Diem den test Kafka",
     "destinationLat": 10.8001,
     "destinationLng": 106.7201
   }
   ```

   Cần HTTP `201`; lưu `id` trong response thành `pc7BookingId`. Mỗi lần chạy lại, đổi `Idempotency-Key` (ví dụ `pc7-booking-002`), vì dùng lại key sẽ trả booking cũ và không tạo event mới.
2. Gửi `GET http://localhost:8000/api/v1/notifications?limit=20` với cùng Bearer `{{customerToken}}`, không có Body. Tìm phần tử trong `data` có `eventType: "booking.created"` và trường `body` chứa `pc7BookingId`. Nếu chưa thấy, đợi vài giây rồi gửi lại GET.

**Vì sao cách này kiểm tra được Kafka?** Booking-service ghi event `booking.created` vào outbox, relay gửi lên topic `booking.events`, notification-service đọc event rồi tạo thông báo cho Customer. GET cuối đọc thông báo từ notification-service. HTTP `201` ở bước 1 **chưa đủ**; phải thấy đúng `pc7BookingId` trong thông báo ở bước 2. Postman kiểm tra được luồng nghiệp vụ này, nhưng không hiển thị trực tiếp trạng thái broker/topic/consumer group.

**Dọn booking PC7 trước PC15:** `POST http://localhost:8000/api/v1/bookings/{{pc7BookingId}}/cancel` với Bearer `{{customerToken}}`, JSON `{ "reason": "Ket thuc test Kafka" }` → HTTP 200, `status: "CANCELED"`. Nếu booking đã `EXPIRED`, không cần hủy; khách đã được phép tạo booking mới. Mỗi Customer chỉ được có một booking `SEARCHING` hoặc `ASSIGNED` tại một thời điểm.

**Cách nói khi demo:** “Em tạo booking qua Gateway; booking-service phát event lên Kafka. Notification-service nhận event, nên API thông báo của Customer xuất hiện `booking.created` với đúng booking ID vừa tạo.”

**Nếu cần kiểm tra trực tiếp broker/topic/consumer bằng Terminal:**

**Bước 1 — kiểm tra Kafka và topic (Terminal trong `backend/`):**

```bash
docker compose ps kafka notification-service
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --list
```

**Cần thấy:** Kafka `Up (healthy)` và danh sách có `booking.events`, `trip.events`, `driver.events`, `payment.events`. Có topic **chưa chứng minh** message đã được gửi và đọc.

**Bước 2 — xem consumer của ứng dụng:**

```bash
docker compose exec -T kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe \
  --group notification-service
docker compose logs --tail=50 notification-service
```

**Cần thấy:** group `notification-service` có các topic đã subscribe; log có `notification-service kafka subscribed to events`. Nếu group chưa xuất hiện, kiểm tra log lỗi kết nối Kafka; tạo event nghiệp vụ rồi xem lại.

**Bước 3 — tự gửi và đọc một message thử (chạy cùng một cửa sổ Terminal, trong `backend/`):**

```bash
PC7_TOPIC="pc7-demo-$(date +%s)"
docker compose exec -T kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --create --topic "$PC7_TOPIC" \
  --partitions 1 --replication-factor 1
printf 'hello-pc7\n' | docker compose exec -T kafka \
  /opt/kafka/bin/kafka-console-producer.sh \
  --bootstrap-server localhost:9092 --topic "$PC7_TOPIC"
docker compose exec -T kafka /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 --topic "$PC7_TOPIC" \
  --from-beginning --max-messages 1 --timeout-ms 10000
```

**Cần thấy:** lệnh cuối in `hello-pc7`. Topic `pc7-demo-...` là topic thử riêng, không phải topic nghiệp vụ. Script `npm run smoke:pc6-pc30` có kiểm tra Kafka nhưng một số bước khác còn phụ thuộc seed cũ; với dữ liệu hiện tại, ưu tiên luồng Postman và các lệnh Kafka phía trên.

**Bằng chứng end-to-end nghiệp vụ (sau khi làm PC18):** `docker compose logs --tail=50 notification-service` cần có dòng `[NOTIFICATION KAFKA] consumed ... eventType=trip.canceled`. Trong Postman, `GET http://localhost:8000/api/v1/notifications?limit=20` với Bearer `{{customerToken}}` và token Driver của trip đã hủy; response HTTP `200` có `data` chứa thông báo `trip.canceled` liên quan `{{cancelTripId}}`. Event có thể cần vài giây mới xuất hiện. Đây là kiểm tra cả producer → Kafka → consumer → dữ liệu thông báo; bài thử topic riêng ở bước 3 chỉ kiểm tra broker.

**Cách nói khi demo:** “Topic và consumer group cho thấy cấu hình; message `hello-pc7` đọc lại được chứng minh broker gửi/đọc được; notification của trip đã hủy chứng minh ứng dụng thực sự xử lý event.”

---

## PC8 – Gateway-only Access

**Cách test (trong `backend/`):**

```bash
docker compose ps
curl -i http://localhost:8000/health
curl -i --max-time 3 http://localhost:3000/health
```

**Cần thấy:** `localhost:8000/health` trả HTTP `200`. `localhost:3000/health` từ máy host báo không kết nối được (curl thường trả mã `7`), vì cổng identity-service không publish. Trong cột `PORTS` của `docker compose ps`, Gateway có `0.0.0.0:8000->8000/tcp` hoặc tương đương; 7 service không có ánh xạ host kiểu `3000:3000` đến `3006:3006`. Nếu máy đang có chương trình khác dùng cổng 3000, lệnh curl có thể trả nội dung của chương trình đó; **cột PORTS của Compose** mới là bằng chứng quyết định.

**Postman:** `GET http://localhost:8000/health` không token/body phải HTTP `200`. API của 7 service đi qua Gateway. MongoDB có cổng `127.0.0.1:27017` để quản trị DB; đó không phải cổng HTTP API.

**Cách nói khi demo:** “Compose chỉ publish cổng HTTP API của Gateway. Các service dùng mạng nội bộ Docker, nên client phải gọi API qua `localhost:8000`.”

---

## Chuẩn bị dữ liệu Postman cho PC9–PC30

Các request công khai không cần token là đăng ký, đăng nhập, OTP và tìm tài xế quanh tọa độ. Các request còn lại thêm header `Authorization: Bearer {{customerToken}}`, `{{driverToken}}` hoặc `{{adminToken}}` đúng vai trò. Với request có JSON, thêm `Content-Type: application/json`. Chỉ request tạo booking cần `Idempotency-Key`; mỗi booking mới dùng một key mới. Các trường `vehicleType` khi đặt xe, `vehicle` khi đăng ký tài xế và tọa độ khi cập nhật trạng thái trip đều có thể bỏ trong các ví dụ cơ bản bên dưới.

Thứ tự thử thuận tiện: PC9–PC14 → PC21–PC23 → PC15–PC20 → PC24–PC30. PC15–PC20 cần tài xế đã duyệt và ONLINE. Để thử hủy trip ở PC18, tạo một booking/trip **khác** với trip đã hoàn thành ở PC17, vì trip `COMPLETED` không thể hủy.

## PC9 – Đăng ký tài khoản khách hàng

**Postman:** `POST http://localhost:8000/api/v1/auth/register`

```json
{
  "fullName": "Khach Hang Demo",
  "email": "khachdemo01@example.com",
  "phone": "0912345001",
  "password": "DemoPass@123"
}
```

**Cần thấy:** HTTP 201, response có `id`, `role: "CUSTOMER"`, `status: "ACTIVE"`. Lưu `id` vào `customerId`. Dùng email/phone mới nếu đã chạy trước đó. Identity-service tạo account và gọi customer-service tạo profile; sau đó đăng nhập ở PC10.

**Postman Tests (tab Tests, tùy chọn):**

```javascript
pm.test("PC9: tạo Customer", () => pm.response.to.have.status(201));
pm.environment.set("customerId", pm.response.json().id);
```

**Kết luận:** “PC9 đạt khi tài khoản được tạo và đăng nhập được.”

---

## PC10 – Đăng nhập khách hàng

**Postman:** `POST http://localhost:8000/api/v1/auth/login`

```json
{ "email": "khachdemo01@example.com", "password": "DemoPass@123" }
```

Chỉ gửi `email` **hoặc** `phone`, kèm `password`. Không cần gửi ID, role, tên hay số dư; hệ thống xác định tài khoản và vai trò từ thông tin đăng nhập.

**Cần thấy:** HTTP 200, response có `token`, `accountId = {{customerId}}`, `role: "CUSTOMER"`. Lưu `token` vào `customerToken`. JWT ký bằng HS256 và token hết hạn sau 60 phút. Để thực hiện PC13/PC22, đăng nhập admin bằng cùng endpoint với email `admin@gmail.com`, mật khẩu `12345678`, rồi lưu `adminToken`.

**Request Admin trong Postman:** `POST http://localhost:8000/api/v1/auth/login`, không Bearer, Body → raw → JSON:

```json
{ "email": "admin@gmail.com", "password": "12345678" }
```

Lưu `token` response Customer vào `customerToken`; lưu `token` response Admin vào `adminToken`. Có thể dùng script Tests `pm.environment.set("customerToken", pm.response.json().token)` hoặc đổi tên biến thành `adminToken` trong request Admin.

Khi token hết hạn, chạy lại đúng request đăng nhập của Customer, Admin hoặc Driver để cập nhật biến token đó. Thời hạn 1 giờ chỉ áp dụng cho token được cấp sau khi build lại identity-service.

**Xem tài khoản Admin đang đăng nhập:** `GET http://localhost:8000/api/v1/admin/me` với `Bearer {{adminToken}}`, không body. Response có `id`, `email`, `displayName`, `role: "ADMIN"`, `status` và các mốc thời gian. Không có token trả HTTP 401; token Customer/Driver trả HTTP 403. API không trả mật khẩu hoặc hash.

**Kết luận:** “PC10 đạt khi token hợp lệ được cấp cho tài khoản đang hoạt động.”

---

## PC11 – Lấy thông tin khách hàng theo ID

**Postman:** `GET http://localhost:8000/api/v1/customers/{{customerId}}` với `Bearer {{customerToken}}`.

**Hồ sơ của chính Customer:** `GET http://localhost:8000/api/v1/customers/me` với `Bearer {{customerToken}}`, không cần truyền ID. Response có `fullName`, `email`, `phone`, `balance`, `status` cùng các trường hồ sơ tùy chọn. Khách mới có số dư ban đầu 1.000.000đ. Token Admin/Driver không dùng được route `/me` của Customer (HTTP 403).

**Cần thấy:** HTTP 200; `id`, `fullName`, `email` đúng khách hàng PC9. Nếu không có token: HTTP 401; nếu token Customer khác xem ID này: HTTP 403. Service chỉ trả hồ sơ của chính Customer, trừ vai trò nhân viên/admin được phép.

**Kết luận:** “PC11 đạt khi xem được đúng profile qua Gateway bằng token.”

**Danh sách khách hàng dành cho Admin:** `GET http://localhost:8000/api/v1/customers?page=1&limit=20` với `Bearer {{adminToken}}`. Response có `data` và `pagination` (`page`, `limit`, `total`); đổi `page=2` để xem trang tiếp theo. `limit` tối đa 100. Thiếu token trả HTTP 401; dùng `{{customerToken}}` trả HTTP 403. Danh sách không trả mật khẩu hoặc hash số điện thoại.

---

## PC12 – Lấy thông tin tài xế theo ID

**Postman:** `GET http://localhost:8000/api/v1/drivers/20000000-0000-4000-8000-000000000001` với `Bearer {{customerToken}}` (driver mẫu `dr01@gmail.com`).

**Cần thấy:** HTTP 200, `id` đúng, có `status`, `vehicle`, số điện thoại được che bằng dấu `•`. Đây là một tài xế mẫu. Sau PC21–PC22 có thể thay ID bằng `{{driverId}}` để xem hồ sơ vừa đăng ký.

**Kết luận:** “PC12 đạt khi lấy được thông tin tài xế và không lộ số điện thoại đầy đủ cho Customer.”

---

## PC13 – Tài xế quanh khu vực, bán kính và phân trang

**Postman:**

1. **Chứng minh dữ liệu có nhiều trạng thái:** `GET http://localhost:8000/api/v1/drivers?page=1&limit=50` với `Bearer {{adminToken}}`. Trong `data`, `dr01`–`dr02` có trạng thái `ONLINE`, `dr03`–`dr07` là `OFFLINE`, `dr08`–`dr10` là `PENDING_APPROVAL`. Có thể gọi thêm `GET /api/v1/drivers?status=OFFLINE` hoặc `?status=PENDING_APPROVAL` để chứng minh bộ lọc. Đây là danh sách quản trị; token Customer trả HTTP 403.
2. `GET http://localhost:8000/api/v1/drivers/nearby?lat=10.7769&lng=106.7008&radius=1000&limit=5&page=1`, không token, không body.
3. Để kiểm tra phân trang, gọi lại với `limit=1&page=1`, rồi `limit=1&page=2`.

**Cần thấy:** bước 2 trả `pagination.total: 2` nếu chưa thay đổi trạng thái/vị trí mẫu; `data` có `dr01` và `dr02`, mỗi người `distanceM <= 1000`, `status: "ONLINE"`. Endpoint `/drivers/nearby` mặc định chỉ tìm `ONLINE`; `OFFLINE`/`PENDING_APPROVAL` không nhận chuyến. Ở bước 3, hai trang có ID khác nhau. Nếu đã chạy PC21–PC23 hoặc tạo chuyến mới, tổng số và trạng thái có thể đổi; kiểm tra bằng `GET /drivers` của Admin trước khi kết luận.

**Kết luận:** “PC13 đạt khi có dữ liệu mẫu đủ trạng thái và danh sách quanh điểm đón được lọc/phân trang đúng.”

---

## PC14 – Danh sách booking của Customer

**Vì sao Customer xem danh sách?** Mỗi lần đặt xe là **một booking mới** và các booking đã kết thúc vẫn nằm trong lịch sử. Mỗi Customer chỉ có tối đa **một** booking ở `SEARCHING` hoặc `ASSIGNED`; hai trạng thái này không thể cùng tồn tại cho cùng khách. `GET /bookings` lọc theo Customer ID trong JWT; Admin có thể lọc theo `customerId` để xem tổng hợp.

**Dữ liệu mẫu:** `kh01@gmail.com` có ID `10000000-0000-4000-8000-000000000001`, 9 booking và 5 trip `COMPLETED` có đánh giá. Sau reset, một booking `SEARCHING` có `searchExpiresAt` sau 30 phút; khi quá hạn nó thành `EXPIRED`. Dữ liệu đang chạy có thể đã hết hạn hoặc thay đổi do các bước thực hành, nên dùng response thực tế thay vì giả định ID/trạng thái cố định.

**Postman:**

1. Đăng nhập `kh01` bằng `POST http://localhost:8000/api/v1/auth/login`, không Bearer, Body → raw → JSON:

```json
{
  "email": "kh01@gmail.com",
  "password": "12345678"
}
```

Lưu `token` thành `pc14CustomerToken` để không ghi đè `customerToken` của PC9.

2. Gọi `GET http://localhost:8000/api/v1/bookings?limit=50&page=1` với Bearer `{{pc14CustomerToken}}`, không body. Các bản ghi mẫu có `customerId = 10000000-0000-4000-8000-000000000001`; xem `status`, `fare`, `currency` và `searchExpiresAt` của booking hiện tại. Lấy một `id` trong danh sách rồi gọi `GET http://localhost:8000/api/v1/bookings/<id>` để xem riêng booking đó với cùng giá tiền.
3. Kiểm tra phân trang bằng `GET http://localhost:8000/api/v1/bookings?limit=2&page=1`, rồi `GET http://localhost:8000/api/v1/bookings?limit=2&page=2`, vẫn dùng Bearer `{{pc14CustomerToken}}`.

**Cần thấy:** HTTP 200, `pagination.total >= 9` nếu chưa xóa dữ liệu mẫu; hai trang có tối đa 2 booking/trang, ID không trùng. Mọi `customerId` bằng ID của `kh01`. Admin có thể gọi `GET /api/v1/bookings?customerId=10000000-0000-4000-8000-000000000001` với `Bearer {{adminToken}}` để xem cùng lịch sử. Nếu một booking đang `SEARCHING` hoặc `ASSIGNED`, thử tạo thêm booking với **Idempotency-Key mới** sẽ trả HTTP 409 `ACTIVE_BOOKING_EXISTS`; hủy booking đó hoặc chờ `SEARCHING` hết hạn rồi mới tạo lại.

**Kết luận:** “PC14 đạt khi Customer xem được ít nhất 5 booking của mình với limit/page.”

---

## PC21 – Đăng ký tài xế bằng OTP

Chọn số điện thoại chưa từng dùng. PC21 hiện mô phỏng OTP: service tạo và lưu mã nhưng **không gửi SMS thật**, kể cả khi nhập số điện thoại thật. Trong môi trường development, lấy mã từ `_dev_otp` của response; mã thử `123456` cũng được chấp nhận. Mã sinh ra có hạn 5 phút.

**Postman:**

1. `POST http://localhost:8000/api/v1/drivers/otp/request`, không Bearer, JSON `{ "phone": "0912345002" }` → HTTP 200; lưu `_dev_otp` vào biến `otp`.
2. `POST http://localhost:8000/api/v1/drivers/otp/verify`, không Bearer, JSON `{ "phone": "0912345002", "otp": "{{otp}}" }` → HTTP 200; lưu `registrationToken`.
3. `POST http://localhost:8000/api/v1/drivers/register`:

```json
{
  "registrationToken": "{{registrationToken}}",
  "phone": "0912345002",
  "password": "TaiXeDemo@123",
  "fullName": "Tai Xe Demo",
  "licenseNumber": "GPLX-DEMO-02",
  "licenseClass": "A1",
  "licenseExpiryDate": "2035-01-01"
}
```

**Cần thấy:** HTTP 201, `status: "PENDING_APPROVAL"`; lưu `id` vào `driverId`. Mật khẩu do tài xế nhập phải dài 8–128 ký tự và được lưu dạng bcrypt hash ở identity-service. Tài khoản đang `PENDING`, chưa thể đăng nhập; thử đăng nhập bằng số điện thoại và mật khẩu trên trước khi duyệt sẽ nhận HTTP 401. Hồ sơ Driver vẫn chờ duyệt. Số điện thoại và GPLX được mã hóa khi lưu. `nationalId` và `dateOfBirth` không cần gửi; nếu bỏ `vehicle`, hệ thống tạo xe BIKE mẫu. Thiếu mật khẩu hoặc registration token OTP hợp lệ trả HTTP 400.

Ba request trên dùng `Content-Type: application/json`. Trong môi trường development có thể dùng script Tests ở request OTP: `pm.environment.set("otp", pm.response.json()._dev_otp)`; ở request verify: `pm.environment.set("registrationToken", pm.response.json().registrationToken)`; ở request register: `pm.environment.set("driverId", pm.response.json().id)`.

**Kết luận:** “PC21 đạt khi OTP hợp lệ dẫn tới hồ sơ chờ duyệt.”

---

## PC22 – Admin duyệt hồ sơ tài xế

**Postman:**

1. `GET http://localhost:8000/api/v1/drivers?status=PENDING_APPROVAL` với `Bearer {{adminToken}}`; tìm `{{driverId}}`.
2. `GET http://localhost:8000/api/v1/drivers/{{driverId}}/application` với `Bearer {{adminToken}}` để xem chi tiết; không body.
3. `POST http://localhost:8000/api/v1/drivers/{{driverId}}/approve` với `Bearer {{adminToken}}`, body `{}`.
4. `POST http://localhost:8000/api/v1/auth/login`, không Bearer, JSON `{ "phone": "0912345002", "password": "TaiXeDemo@123" }`; lưu `token` vào `driverToken`.
5. `GET http://localhost:8000/api/v1/notifications?limit=20` với `Bearer {{driverToken}}`; không body.

**Hồ sơ của chính Driver:** Sau bước đăng nhập, gọi `GET http://localhost:8000/api/v1/drivers/me` với `Bearer {{driverToken}}`, không body. Response có tên, số điện thoại, GPLX, `balance`, trạng thái, xe và vị trí gần nhất (nếu có). Token Admin/Customer trả HTTP 403; không có token trả HTTP 401.

**Cần thấy:** bước 3 trả `status: "OFFLINE"` và kích hoạt tài khoản Driver ở identity-service; lúc này mới đăng nhập được bằng mật khẩu đã nhập ở PC21. Notification có `eventType: "driver.approved"` và `body` chứa `driverId` (có thể chờ 1–2 giây để Kafka xử lý). `APPROVED` là kết quả duyệt, còn `OFFLINE` là trạng thái tài xế đã được duyệt nhưng chưa bật nhận chuyến; chỉ từ `OFFLINE` tài xế mới có thể chuyển sang `ONLINE`. Muốn thử nhánh từ chối, đăng ký hồ sơ mới rồi gọi `POST http://localhost:8000/api/v1/drivers/{{driverIdMoi}}/reject` với `Bearer {{adminToken}}`, JSON `{ "reason": "Ho so khong hop le" }`; hồ sơ thành `REJECTED`, tài khoản ở identity-service bị xoá và không thể đăng nhập.

Các thao tác quản trị ở bước 1–3 và nhánh từ chối yêu cầu token `ADMIN`: thiếu token trả HTTP 401; dùng `{{customerToken}}` trả HTTP 403. `GET http://localhost:8000/api/v1/drivers/{{driverId}}` vẫn là API hồ sơ thông thường của PC12; xem hồ sơ để duyệt dùng `GET http://localhost:8000/api/v1/drivers/{{driverId}}/application`.

**Kết luận:** “PC22 đạt khi hồ sơ được duyệt thì tài khoản tài xế đăng nhập được, còn hồ sơ bị từ chối thì tài khoản bị huỷ và đăng nhập thất bại.”

---

## PC23 – Bật/tắt nhận chuyến

**Postman:** Dùng `Bearer {{driverToken}}`.

1. `PUT http://localhost:8000/api/v1/drivers/me/location` với `{ "latitude": 10.7901, "longitude": 106.7101 }`.
2. `PUT http://localhost:8000/api/v1/drivers/me/availability` với `{ "status": "ONLINE" }` → `ONLINE`.
3. Gọi lại availability với `{ "status": "OFFLINE" }` → `OFFLINE`.
4. Gọi lại `PUT http://localhost:8000/api/v1/drivers/me/availability` với `Bearer {{driverToken}}`, JSON `{ "status": "ONLINE" }` để tiếp tục PC15–PC17.

**Cần thấy:** mỗi response HTTP 200 và `status` đúng; `GET http://localhost:8000/api/v1/drivers/{{driverId}}` với Bearer `{{driverToken}}`, không body, phản ánh trạng thái mới. Driver đang chờ duyệt không được bật ONLINE.

**Kết luận:** “PC23 đạt khi trạng thái online/offline được lưu và trả về đúng.”

---

## PC15 – Khách hàng đặt xe, hệ thống tìm tài xế

**Postman:** `POST http://localhost:8000/api/v1/bookings` với `Bearer {{customerToken}}`, header `Idempotency-Key: demo-ride-001` và body:

```json
{
  "pickupAddress": "Diem don Quan 1",
  "pickupLat": 10.7901,
  "pickupLng": 106.7101,
  "destinationAddress": "Diem den Quan 1",
  "destinationLat": 10.8001,
  "destinationLng": 106.7201
}
```

**Cần thấy:** HTTP 201, `status: "SEARCHING"`, có `id` để lưu vào `bookingId`, `fare` (VND), `paymentStatus: "HELD"` và `searchExpiresAt` cách lúc tạo khoảng **30 phút**. Gọi `GET http://localhost:8000/api/v1/bookings/{{bookingId}}` với Bearer `{{customerToken}}`, không body: `fare` phải bằng giá lúc tạo. Booking-service tìm tài xế gần điểm đón và tạo **offer**. Gọi `GET http://localhost:8000/api/v1/offers` với `Bearer {{driverToken}}` để tìm phần tử có `bookingId = {{bookingId}}`; nếu chưa thấy ngay, đợi khoảng 1 giây rồi gọi lại. `expiresAt` của offer cũng cách lúc tạo 30 phút. Sau `searchExpiresAt`, booking chuyển sang `EXPIRED` và tiền được hoàn cho Customer.

GET offers không có body. Trong Postman, ở request tạo booking có thể đặt Tests `pm.environment.set("bookingId", pm.response.json().id)`; ở GET offers kiểm tra `data[]` có `bookingId` này. Mỗi offer gửi riêng cho một Driver: nếu tài xế đang đăng nhập không thấy offer sau vài lần kiểm tra, booking có thể đã được gửi cho tài xế gần hơn. Hãy đặt vị trí Driver thử nghiệm gần điểm đón và chọn khu vực ít tài xế khác **trước** khi tạo booking; đổi vị trí sau đó không điều phối lại booking cũ.

**Thử ràng buộc một booking hoạt động:** khi `{{bookingId}}` còn `SEARCHING`, gửi lại `POST /api/v1/bookings` với cùng Customer nhưng **Idempotency-Key mới** (ví dụ `demo-ride-blocked-001`). Cần HTTP 409 `ACTIVE_BOOKING_EXISTS`; không có booking thứ hai. Dùng key cũ `demo-ride-001` chỉ trả lại response cũ do cơ chế idempotency, nên không dùng key cũ để thử ràng buộc. Nếu request đầu tiên đã trả 409, kiểm tra `GET /bookings` để tìm booking `SEARCHING`/`ASSIGNED` đang có; hủy theo PC18 hoặc chờ nó kết thúc rồi thử lại với key mới.

**Kết luận:** “PC15 đạt khi booking SEARCHING được tạo và tài xế gần đó nhận offer.”

---

## PC16 – Tài xế nhận chuyến

**Postman:** Sau khi `GET /api/v1/offers` xác nhận tài xế có offer cho `{{bookingId}}`, gọi `POST http://localhost:8000/api/v1/bookings/{{bookingId}}/accept` với `Bearer {{driverToken}}`, không body. Không cần lưu `offerId`: backend lấy Driver ID từ token, tìm offer của Driver cho booking này và kiểm tra offer còn hạn.

**Cần thấy:** HTTP 200, `status: "ASSIGNED"`, có `tripId` để lưu. Customer gọi `GET http://localhost:8000/api/v1/trips/{{tripId}}` với `Bearer {{customerToken}}`: `driverId = {{driverId}}`, `status: "ASSIGNED"`, `fare` bằng booking, `currency: "VND"`, `paymentStatus: "HELD"`. `GET /api/v1/bookings/{{bookingId}}` cũng trả `fare` và `tripId` tương ứng. Driver-service chuyển tài xế sang BUSY. Tạo booking mới lúc này trả 409 `ACTIVE_BOOKING_EXISTS`.

Có thể đặt Tests trên request accept: `pm.environment.set("tripId", pm.response.json().tripId)`. Request GET trip không có body.

**Kết luận:** “PC16 đạt khi offer được chấp nhận và trip gắn đúng tài xế/khách hàng.”

---

## PC17 – Cập nhật trạng thái chuyến theo trình tự

**Postman:** Với `Bearer {{driverToken}}`, gọi lần lượt `PATCH http://localhost:8000/api/v1/trips/{{tripId}}/status`:

```json
{ "status": "ARRIVED" }
```

Sau đó **cùng method, URL và Bearer token**, thay toàn bộ JSON body lần lượt bằng:

```json
{ "status": "IN_PROGRESS" }
```

```json
{ "status": "COMPLETED" }
```

**Cần thấy:** mỗi bước HTTP 200, `previousStatus` và `status` đúng trình tự `ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED`; `GET http://localhost:8000/api/v1/trips/{{tripId}}` với Bearer `{{customerToken}}`, không body, trả `COMPLETED`, `fare` và `paymentStatus: "PAID"`. `GET /api/v1/bookings/{{bookingId}}` trả cùng `fare`, trạng thái `COMPLETED`. Tài xế trở lại `ONLINE` và Customer có thể tạo booking mới. Nếu thử đi thẳng từ ASSIGNED tới COMPLETED trước các bước trên, API trả HTTP 409.

**Kết luận:** “PC17 đạt khi trạng thái chỉ tiến theo thứ tự hợp lệ.”

---

## PC18 – Hủy booking/trip và nhận thông báo

**Trường hợp booking chưa gán:** `POST http://localhost:8000/api/v1/bookings` với `Bearer {{customerToken}}`, header `Idempotency-Key: demo-cancel-booking-001` và JSON sau; lưu `id` response vào `cancelBookingId`:

```json
{
  "pickupAddress": "Diem don huy booking",
  "pickupLat": 10.85,
  "pickupLng": 106.75,
  "destinationAddress": "Diem den huy booking",
  "destinationLat": 10.86,
  "destinationLng": 106.76
}
```

Sau đó `POST http://localhost:8000/api/v1/bookings/{{cancelBookingId}}/cancel` với `Bearer {{customerToken}}`, JSON `{ "reason": "Khach doi lich" }`. Response HTTP 200 cần `status: "CANCELED"`; `GET /api/v1/bookings` với cùng token phản ánh trạng thái này.

**Trường hợp đã gán tài xế:** Sau PC17, Driver `{{driverToken}}` đã trở lại `ONLINE`, nên có thể dùng lại. Gọi `PUT http://localhost:8000/api/v1/drivers/me/location` với Bearer `{{driverToken}}` và JSON `{ "latitude": 10.8001, "longitude": 106.7201 }`. Sau đó `POST http://localhost:8000/api/v1/bookings` với `Bearer {{customerToken}}`, header `Idempotency-Key: demo-cancel-trip-001`, JSON:

```json
{
  "pickupAddress": "Diem don huy trip",
  "pickupLat": 10.8001,
  "pickupLng": 106.7201,
  "destinationAddress": "Diem den huy trip",
  "destinationLat": 10.8101,
  "destinationLng": 106.7301
}
```

Lưu `id` của booking mới vào `cancelTripBookingId`. Gọi `GET http://localhost:8000/api/v1/offers` với Bearer `{{driverToken}}` để kiểm tra có offer cho `cancelTripBookingId`; `POST http://localhost:8000/api/v1/bookings/{{cancelTripBookingId}}/accept` với cùng token, không body; lưu `tripId` response vào `cancelTripId`. Chấp nhận trước `searchExpiresAt` và `expiresAt`. Cuối cùng dùng **cùng endpoint hủy booking**: `POST http://localhost:8000/api/v1/bookings/{{cancelTripBookingId}}/cancel` với `Bearer {{customerToken}}`, JSON `{ "reason": "Khach huy truoc khi bat dau" }`. Booking-service sẽ hủy trip liên kết.

**Cần thấy:** HTTP 200, booking trả `CANCELED`; `GET /api/v1/bookings/{{cancelTripBookingId}}` trả `fare` và `paymentStatus: "REFUNDED"`; `GET http://localhost:8000/api/v1/trips/{{cancelTripId}}` với Bearer `{{customerToken}}` xác nhận trip cũng `CANCELED`, vẫn hiển thị `fare`. Số dư Customer tăng lại đúng khoản đã giữ. Dùng `Idempotency-Key` mới để tạo booking tiếp theo. Gọi `GET http://localhost:8000/api/v1/notifications?limit=20` bằng token Customer **và** token Driver của trip vừa hủy: mỗi bên có notification `eventType: "trip.canceled"`, `body` chứa `cancelTripId` sau khi Kafka xử lý.

**Kết luận:** “PC18 đạt khi trip được hủy đúng thời điểm và hai bên nhận thông báo.”

---

## PC19 – Giữ tiền trong sandbox và thanh toán tự động

**Postman:** Sau khi tạo booking, kiểm tra `fare` và `paymentStatus: "HELD"` trong response. Giá được tính theo khoảng cách tọa độ: mỗi 100 m (làm tròn lên) là 900đ. `GET /api/v1/customers/me` cho thấy số dư giảm từ 1.000.000đ đúng bằng `fare`. Khi tài xế nhận booking, trip có `paymentStatus: "HELD"`. Gọi `POST http://localhost:8000/api/v1/payments` với `Bearer {{customerToken}}`, Body → raw → JSON để xem trạng thái escrow:

```json
{ "tripId": "{{tripId}}" }
```

**Cần thấy:** HTTP 200, `amount` bằng `fare`, `id` là booking ID. Trước khi hoàn tất trip, `status: "HELD"`; nếu đã làm PC17, `status: "SETTLED"`. Lưu `id` vào `paymentId`, rồi gọi `GET /api/v1/payments/{{paymentId}}` để xem trạng thái. Request này chỉ cần `tripId`; không cần nhập `amount`, phương thức thanh toán hoặc thông tin ví.

Khi booking hết hạn hoặc booking/trip bị hủy trước lúc bắt đầu, `status` thành `REFUNDED` và tiền trở lại số dư khách. Khi trip `COMPLETED`, `status` thành `SETTLED`, trip có `paymentStatus: "PAID"`, và `GET /api/v1/drivers/me` cho thấy số dư tài xế tăng đúng bằng `fare`. Callback của mock provider chỉ áp dụng cho các trip cũ chưa có escrow.

---

## PC20 – Đánh giá chuyến đi

**Postman:** `POST http://localhost:8000/api/v1/trips/{{tripId}}/reviews` với `Bearer {{customerToken}}`:

```json
{ "stars": 5, "comment": "Tai xe dung gio" }
```

**Cần thấy:** HTTP 201, response có `tripId`, `driverId`, `stars: 5`. Gọi `GET http://localhost:8000/api/v1/trips/{{tripId}}` với Bearer `{{customerToken}}`, không body, thấy `review.stars = 5`. Gửi lại đúng POST JSON trên cho cùng trip trả HTTP 409; trip chưa COMPLETED cũng không được đánh giá.

**Kết luận:** “PC20 đạt khi review được lưu duy nhất và liên kết với trip đã hoàn thành.”

---

## PC24 – Mã hóa dữ liệu nhạy cảm khi lưu DB

Sau PC9 và PC21, dùng ID thật để xem **cột lưu trong DB**, không dùng API đã che dữ liệu. PostgreSQL của hệ thống hiện chạy trên máy Mac; trong terminal `backend/`, dùng `psql` và nhập mật khẩu tương ứng từ `backend/.env` khi được hỏi:

```bash
psql -h localhost -U identity -d identity_db -c \
  "SELECT password_hash FROM accounts WHERE id = '<customerId>';"
psql -h localhost -U driver -d driver_db -c \
  "SELECT phone_enc, license_number_enc FROM drivers WHERE id = '<driverId>';"
```

**Cần thấy:** `password_hash` bắt đầu bằng `$2` (bcrypt), không phải mật khẩu gốc; `phone_enc` và `license_number_enc` bắt đầu bằng `enc:v1:` (AES-256-GCM), không có số điện thoại/GPLX plaintext. Key ID nằm trong ciphertext; module `backend/shared/src/crypto/index.js` hỗ trợ khóa qua `DATA_ENCRYPTION_KEYS` và `DATA_ENCRYPTION_ACTIVE_KEY_ID`. Compose development hiện dùng khóa fallback nếu chưa truyền hai biến này vào container.

**Kết luận:** “PC24 đạt ở mức dữ liệu lưu trong DB không đọc được plaintext.”

---

## PC25 – Thử SQL injection

**Postman:** `POST http://localhost:8000/api/v1/auth/login`, không Bearer, Body → raw → JSON:

```json
{ "email": "' OR 1=1 --", "password": "anything" }
```

**Cần thấy:** HTTP 400 hoặc 401, không có token hay dữ liệu tài khoản. Query đăng nhập dùng tham số thay vì ghép chuỗi SQL từ input.

**Kết luận:** “PC25 đạt khi payload không vượt qua đăng nhập.”

---

## PC26 – Thử XSS trong input

**Postman:** `POST http://localhost:8000/api/v1/bookings` với `Bearer {{customerToken}}`, header `Idempotency-Key: demo-xss-booking-001`, Body → raw → JSON:

```json
{
  "pickupAddress": "<script>alert('hack')</script>",
  "pickupLat": 10.85,
  "pickupLng": 106.75,
  "destinationAddress": "Diem den XSS test",
  "destinationLat": 10.86,
  "destinationLng": 106.76
}
```

Lưu `id` response, rồi gọi `GET http://localhost:8000/api/v1/bookings?limit=50` với Bearer `{{customerToken}}`, không body; tìm đúng booking vừa tạo.

Sau khi kiểm tra, gọi `POST /api/v1/bookings/<id vừa lưu>/cancel` với Bearer `{{customerToken}}`, JSON `{ "reason": "Ket thuc test XSS" }`. Nếu booking đã `EXPIRED`, không cần hủy. Dùng `Idempotency-Key` mới khi tạo chuyến tiếp theo.

**Cần thấy:** `pickup.address` trong **response danh sách** chứa `&lt;script&gt;` thay cho thẻ `<script>` gốc. Response ngay lúc tạo booking có thể echo input chưa escape, nên dùng GET danh sách để kiểm tra giá trị đã lưu. Có thể xem thêm review comment bằng payload tương tự nếu có một trip mới `COMPLETED` chưa được đánh giá; 25 trip trong dữ liệu mẫu đã có review.

**Kết luận:** “PC26 đạt khi nội dung script không được trả ra dưới dạng HTML thực thi.”

---

## PC27 – Sửa payload JWT

Lấy `customerToken` ở PC10. Từ terminal, tạo token bị sửa payload role nhưng giữ signature cũ (thay placeholder bằng token thật):

```bash
node -e 'const t=process.argv[1].split("."); const p=JSON.parse(Buffer.from(t[1],"base64url")); t[1]=Buffer.from(JSON.stringify({...p,role:"ADMIN"})).toString("base64url"); console.log(t.join("."))' '<customerToken>'
```

Copy token được in ra vào biến Postman `tamperedToken`, rồi gửi `GET http://localhost:8000/api/v1/drivers` với `Authorization: Bearer {{tamperedToken}}`; không body.

**Cần thấy:** HTTP 401 `UNAUTHORIZED`, không có danh sách tài xế. Gateway chỉ chấp nhận HS256 và xác minh chữ ký; sửa payload làm chữ ký sai.

**Kết luận:** “PC27 đạt khi token giả mạo không được chấp nhận.”

---

## PC28 – Customer gọi API dành cho Driver

**Postman:** `PUT http://localhost:8000/api/v1/drivers/me/availability` với **Bearer `{{customerToken}}`**, body `{ "status": "ONLINE" }`. Thử thêm `GET http://localhost:8000/api/v1/drivers` và `GET http://localhost:8000/api/v1/customers` với cùng token Customer.

**Cần thấy:** cả ba request trả HTTP 403 `FORBIDDEN`. Gateway chặn Customer ở route `/drivers/me`; driver-service và customer-service kiểm tra quyền `ADMIN` cho hai route danh sách.

**Kết luận:** “PC28 đạt khi role Customer không được dùng API Driver.”

---

## PC29 – Gửi dồn request kiểm tra rate limit

**Postman:** tạo `GET http://localhost:8000/api/v1/drivers/nearby?limit=1`, không token, không body. Dùng Collection Runner chạy request này **55 lần liên tiếp, không đặt delay** trong dưới 10 giây. Nếu Runner gửi chậm hoặc có request khác từ cùng IP, dùng lệnh CLI ngay dưới để tạo burst ổn định. Sau đó gửi `GET http://localhost:8000/health` để xác nhận Gateway vẫn HTTP 200.

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

**Postman:** Gửi lại đúng request `POST /api/v1/bookings` của PC15 với cùng Bearer Customer, cùng `Idempotency-Key: demo-ride-001` và cùng JSON. Sau đó gọi `GET /api/v1/customers/me`, `GET /api/v1/bookings/{{bookingId}}` và `GET /api/v1/payments/{{bookingId}}`.

**Cần thấy:** response tạo booking lặp lại vẫn có cùng `id` và `fare`; số dư Customer chỉ bị trừ một lần. Escrow vẫn là một bản ghi, dù lúc kiểm tra nó đã `HELD`, `SETTLED` hoặc `REFUNDED`. Giữ nguyên key nhưng đổi điểm đến phải nhận HTTP 422 `IDEMPOTENCY_CONFLICT`. Gửi lặp `POST /api/v1/payments` với JSON `{ "tripId": "{{tripId}}" }` chỉ đọc lại cùng `id`, `amount` và trạng thái escrow; không trừ tiền lần nữa.

**Kết luận:** “PC30 đạt khi request lặp không tạo booking, escrow hoặc biến động số dư thứ hai.”
