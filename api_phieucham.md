# Danh sách API theo `phieucham.md`

Mỗi request có một dòng **API** và một dòng **Data** (body). Query string nằm ngay trong dòng API. `Không` nghĩa là request không có body. Endpoint và body bổ sung được lấy từ `practice.md` và route hiện có trong `backend/`; các dữ liệu ghi rõ trong `phieucham.md` được chép riêng, không thay bằng dữ liệu ví dụ khác.

- `{{baseUrl}} = http://localhost:8000`; tất cả API đi qua Gateway.
- Với body JSON, dùng `Content-Type: application/json`. `Token` là Bearer Token.
- `{{...}}` là biến lấy từ response trước đó hoặc dữ liệu seed; đây không phải giá trị cố định.
- PC1–PC5, PC7–PC8 là mục kiểm tra kiến trúc/hạ tầng, không có API yêu cầu gọi trong phiếu.

## PC6 – API health check

- API: `GET {{baseUrl}}/health`
  - Data: Không
  - Token: Không
- API: `GET {{baseUrl}}/ready`
  - Data: Không
  - Token: Không
- API: `GET {{baseUrl}}/health/services`
  - Data: Không
  - Token: Không

## PC9 – Đăng ký tài khoản khách hàng

Email và số điện thoại ví dụ bên dưới chỉ đăng ký được một lần; nếu tài khoản đã tồn tại, thay bằng cặp email/số điện thoại chưa sử dụng.

- API: `POST {{baseUrl}}/api/v1/auth/register`
  - Data: `{"fullName":"Khach Demo","email":"khachdemo01@example.com","phone":"0912345001","password":"DemoPass@123"}`
  - Token: Không

## PC10 – Đăng nhập khách hàng

- API: `POST {{baseUrl}}/api/v1/auth/login`
  - Data: `{"email":"khachdemo01@example.com","password":"DemoPass@123"}`
  - Token: Không
- API: `POST {{baseUrl}}/api/v1/auth/login`
  - Data: `{"email":"admin@gmail.com","password":"12345678"}`
  - Token: Không

## PC11 – Lấy thông tin khách hàng với mã số

- API: `GET {{baseUrl}}/api/v1/customers/{{customerId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/customers/me`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)

## PC12 – Lấy thông tin tài xế với mã số

- API: `GET {{baseUrl}}/api/v1/drivers/20000000-0000-4000-8000-000000000001`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)

## PC13 – Liệt kê danh sách tài xế tại khu vực

Điều kiện dữ liệu trong `phieucham.md`: có sẵn ít nhất 5 tài xế với các trạng thái khác nhau; tìm trong bán kính 1 km, có `limit` và phân trang.

- API: `GET {{baseUrl}}/api/v1/drivers?page=1&limit=50`
  - Data: Không
  - Token: Admin (`{{adminToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers/nearby?lat=10.7769&lng=106.7008&radius=1000&limit=5&page=1`
  - Data: Không
  - Token: Không
- API: `GET {{baseUrl}}/api/v1/drivers/nearby?lat=10.7769&lng=106.7008&radius=1000&limit=1&page=1`
  - Data: Không
  - Token: Không
- API: `GET {{baseUrl}}/api/v1/drivers/nearby?lat=10.7769&lng=106.7008&radius=1000&limit=1&page=2`
  - Data: Không
  - Token: Không

## PC14 – Liệt kê danh sách các booking của Customer

Điều kiện dữ liệu trong `phieucham.md`: có sẵn ít nhất 5 booking.

- API: `POST {{baseUrl}}/api/v1/auth/login`
  - Data: `{"email":"kh01@gmail.com","password":"12345678"}`
  - Token: Không
- API: `GET {{baseUrl}}/api/v1/bookings?limit=2&page=1`
  - Data: Không
  - Token: Customer mẫu (`{{seedCustomerToken}}`)
- API: `GET {{baseUrl}}/api/v1/bookings?limit=2&page=2`
  - Data: Không
  - Token: Customer mẫu (`{{seedCustomerToken}}`)
- API: `GET {{baseUrl}}/api/v1/bookings/{{seedBookingId}}`
  - Data: Không
  - Token: Customer mẫu (`{{seedCustomerToken}}`)

## PC15 – Đặt xe

- API: `POST {{baseUrl}}/api/v1/bookings`
  - Data: `{"pickupAddress":"Diem don demo","pickupLat":10.7901,"pickupLng":106.7101,"destinationAddress":"Diem den demo","destinationLat":10.8001,"destinationLng":106.7201,"vehicleType":"BIKE","paymentMethod":"BANK"}`
  - Token: Customer (`{{customerToken}}`)
  - Idempotency-Key: `demo-ride-001`
- API: `POST {{baseUrl}}/api/v1/bookings`
  - Data: `{"pickupAddress":"Diem don demo","pickupLat":10.7901,"pickupLng":106.7101,"destinationAddress":"Diem den demo","destinationLat":10.8001,"destinationLng":106.7201,"vehicleType":"BIKE","paymentMethod":"CASH"}`
  - Token: Customer (`{{customerToken}}`)
  - Idempotency-Key: `demo-cash-001`
- API: `GET {{baseUrl}}/api/v1/bookings/{{bookingId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/offers`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)

## PC16 – Tài xế nhận chuyến

- API: `GET {{baseUrl}}/api/v1/offers`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)
- API: `POST {{baseUrl}}/api/v1/bookings/{{bookingId}}/accept`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)
- API: `GET {{baseUrl}}/api/v1/trips/{{tripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/bookings/{{bookingId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)

## PC17 – Cập nhật trạng thái chuyến

- API: `PATCH {{baseUrl}}/api/v1/trips/{{tripId}}/status`
  - Data: `{"status":"ARRIVED","lat":10.7901,"lng":106.7101}`
  - Token: Driver (`{{driverToken}}`)
- API: `PATCH {{baseUrl}}/api/v1/trips/{{tripId}}/status`
  - Data: `{"status":"IN_PROGRESS","lat":10.7950,"lng":106.7150}`
  - Token: Driver (`{{driverToken}}`)
- API: `PATCH {{baseUrl}}/api/v1/trips/{{tripId}}/status`
  - Data: `{"status":"COMPLETED","lat":10.8001,"lng":106.7201}`
  - Token: Driver (`{{driverToken}}`)
- API: `GET {{baseUrl}}/api/v1/trips/{{tripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)

## PC18 – Hủy chuyến

- API: `POST {{baseUrl}}/api/v1/bookings`
  - Data: `{"pickupAddress":"Diem don demo","pickupLat":10.7901,"pickupLng":106.7101,"destinationAddress":"Diem den demo","destinationLat":10.8001,"destinationLng":106.7201,"vehicleType":"BIKE","paymentMethod":"BANK"}`
  - Token: Customer (`{{customerToken}}`)
  - Idempotency-Key: `demo-cancel-trip-001`
- API: `GET {{baseUrl}}/api/v1/offers`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)
- API: `POST {{baseUrl}}/api/v1/bookings/{{cancelBookingId}}/accept`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)
- API: `POST {{baseUrl}}/api/v1/bookings/{{cancelBookingId}}/cancel`
  - Data: `{"reason":"Khach doi lich"}`
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/trips/{{cancelTripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/notifications?limit=20`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/notifications?limit=20`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)

## PC19 – Thanh toán online

Chuyến mẫu chưa thanh toán: `tripId = 40000000-0000-4000-8000-000000000027`, tài khoản `kh01@gmail.com` / `12345678`.

- API: `GET {{baseUrl}}/api/v1/customers/me`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/payments/{{tripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers/me`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)
- API: `POST {{baseUrl}}/api/v1/payments/{{tripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/payments/{{tripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/trips/{{tripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers/me`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)

## PC20 – Đánh giá chuyến đi

Chuyến mẫu chưa có review: `tripId = 40000000-0000-4000-8000-000000000026`, tài khoản `kh01@gmail.com` / `12345678`.

- API: `POST {{baseUrl}}/api/v1/trips/{{tripId}}/reviews`
  - Data: `{"stars":5,"comment":"Tai xe dung gio"}`
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/trips/{{tripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)

## PC21 – Đăng ký tài xế

- API: `POST {{baseUrl}}/api/v1/drivers/otp/request`
  - Data: `{"phone":"0912345002"}`
  - Token: Không
- API: `POST {{baseUrl}}/api/v1/drivers/otp/verify`
  - Data: `{"phone":"0912345002","otp":"{{otp}}"}`
  - Token: Không
- API: `POST {{baseUrl}}/api/v1/drivers/register`
  - Data: `{"registrationToken":"{{registrationToken}}","email":"taixe.demo@example.com","phone":"0912345002","password":"TaiXeDemo@123","fullName":"Tai Xe Demo","license":{"class":"A1"},"vehicle":{"type":"BIKE","model":"Wave"}}`
  - Token: Không

## PC22 – Duyệt hồ sơ tài xế

Tài xế seed chờ duyệt: `driverId = 20000000-0000-4000-8000-000000000011` (`dr11@gmail.com`, điện thoại `0391234511`).

- API: `GET {{baseUrl}}/api/v1/drivers?status=PENDING_APPROVAL`
  - Data: Không
  - Token: Admin (`{{adminToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers/{{driverId}}/application`
  - Data: Không
  - Token: Admin (`{{adminToken}}`)
- API: `POST {{baseUrl}}/api/v1/drivers/{{driverId}}/approve`
  - Data: `{}`
  - Token: Admin (`{{adminToken}}`)
- API: `POST {{baseUrl}}/api/v1/auth/login`
  - Data: `{"phone":"0391234511","password":"12345678"}`
  - Token: Không
- API: `GET {{baseUrl}}/api/v1/notifications?limit=20`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)

## PC23 – Bật/tắt trạng thái nhận chuyến

- API: `PUT {{baseUrl}}/api/v1/drivers/me/location`
  - Data: `{"lat":10.7901,"lng":106.7101}`
  - Token: Driver (`{{driverToken}}`)
- API: `PUT {{baseUrl}}/api/v1/drivers/me/availability`
  - Data: `{"status":"ONLINE"}`
  - Token: Driver (`{{driverToken}}`)
- API: `PUT {{baseUrl}}/api/v1/drivers/me/availability`
  - Data: `{"status":"OFFLINE"}`
  - Token: Driver (`{{driverToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers/{{driverId}}`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)
- API: `PUT {{baseUrl}}/api/v1/drivers/me/availability`
  - Data: `{"status":"ONLINE"}`
  - Token: Driver (`{{driverToken}}`)

## PC24 – Data encryption at rest

- API: `GET {{baseUrl}}/api/v1/auth/demo/storage/{{customerId}}`
  - Data: Không
  - Token: Admin (`{{adminToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers/{{driverId}}/storage`
  - Data: Không
  - Token: Admin (`{{adminToken}}`)

Dữ liệu kiểm tra ghi trong `phieucham.md`: `password = 123400` → `password = "X9f3k2s9...encrypted..."`. Chuỗi mã hóa trong phiếu là minh họa cho kết quả mong đợi, không phải giá trị cố định phải trả về.

## PC25 – SQL injection attempt

- API: `POST {{baseUrl}}/api/v1/auth/login`
  - Data: `{"email":"' OR 1=1 --","password":"anything"}`
  - Token: Không

Data gốc trong `phieucham.md`: `{"email": "' OR 1=1 --", "password": "anything"}`.

## PC26 – XSS input test

- API: `POST {{baseUrl}}/api/v1/bookings`
  - Data: `{"pickupAddress":"<script>alert('hack')</script>","pickupLat":10.85,"pickupLng":106.75,"destinationAddress":"Diem den","destinationLat":10.86,"destinationLng":106.76,"vehicleType":"BIKE","paymentMethod":"BANK"}`
  - Token: Customer (`{{customerToken}}`)
  - Idempotency-Key: `demo-xss-booking-001`
- API: `GET {{baseUrl}}/api/v1/bookings/{{xssBookingId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `POST {{baseUrl}}/api/v1/bookings/{{xssBookingId}}/cancel`
  - Data: `{"reason":"Ket thuc demo XSS"}`
  - Token: Customer (`{{customerToken}}`)

Data gốc trong `phieucham.md`: `<script>alert('hack')</script>`.

## PC27 – JWT tampering

- API: `GET {{baseUrl}}/api/v1/drivers`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `POST {{baseUrl}}/api/v1/demo/jwt-tampered`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers`
  - Data: Không
  - Token: Token đã sửa (`{{tamperedToken}}`)

Data payload JWT gốc trong `phieucham.md`: `{"sub": "user_123", "role": "USER"}` → `{"sub": "admin_001", "role": "ADMIN"}`. Đây là payload minh họa để kiểm tra chữ ký, không phải body request.

## PC28 – Unauthorized API access

- API: `PUT {{baseUrl}}/api/v1/drivers/me/availability`
  - Data: `{"status":"ONLINE"}`
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers`
  - Data: Không
  - Token: Không

## PC29 – Rate limit attack

- API: `POST {{baseUrl}}/api/v1/booking` (đường dẫn `/booking` được nêu trong `phieucham.md`; gửi > 1000 requests/sec theo tình huống chấm)
  - Data: `{"pickupAddress":"Diem don demo","pickupLat":10.7901,"pickupLng":106.7101,"destinationAddress":"Diem den demo","destinationLat":10.8001,"destinationLng":106.7201,"vehicleType":"BIKE","paymentMethod":"BANK"}`
  - Token: Customer (`{{customerToken}}`)
  - Idempotency-Key: `demo-rate-limit-001`
- API: `GET {{baseUrl}}/api/v1/drivers/nearby?limit=1`
  - Data: Không
  - Token: Không
- API: `GET {{baseUrl}}/health`
  - Data: Không
  - Token: Không

Gateway hiện có alias `/api/v1/booking` chuyển tiếp tới `/api/v1/bookings`. Body đặt xe ở trên lấy từ `practice.md`; giá trị 1000 requests/sec là dữ liệu của phiếu chấm, không phải mức giới hạn cấu hình hiện tại.

## PC30 – Replay attack (idempotency)

- API: `POST {{baseUrl}}/api/v1/bookings`
  - Data: `{"pickupAddress":"Diem don demo","pickupLat":10.7901,"pickupLng":106.7101,"destinationAddress":"Diem den demo","destinationLat":10.8001,"destinationLng":106.7201,"vehicleType":"BIKE","paymentMethod":"BANK"}`
  - Token: Customer (`{{customerToken}}`)
  - Idempotency-Key: `demo-ride-001`
- API: `GET {{baseUrl}}/api/v1/customers/me`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/payments/{{tripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `POST {{baseUrl}}/api/v1/bookings` (gửi lại request gốc với cùng Idempotency-Key)
  - Data: `{"pickupAddress":"Diem don demo","pickupLat":10.7901,"pickupLng":106.7101,"destinationAddress":"Diem den demo","destinationLat":10.8001,"destinationLng":106.7201,"vehicleType":"BIKE","paymentMethod":"BANK"}`
  - Token: Customer (`{{customerToken}}`)
  - Idempotency-Key: `demo-ride-001`
- API: `POST {{baseUrl}}/api/v1/bookings`
  - Data: `{"pickupAddress":"Diem don demo","pickupLat":10.7901,"pickupLng":106.7101,"destinationAddress":"Diem den khac","destinationLat":10.8001,"destinationLng":106.7201,"vehicleType":"BIKE","paymentMethod":"BANK"}`
  - Token: Customer (`{{customerToken}}`)
  - Idempotency-Key: `demo-ride-001`
- API: `POST {{baseUrl}}/api/v1/payments/{{tripId}}`
  - Data: Không
  - Token: Customer (`{{customerToken}}`)
- API: `GET {{baseUrl}}/api/v1/drivers/me`
  - Data: Không
  - Token: Driver (`{{driverToken}}`)

Data request gốc và request gửi lại trong `phieucham.md`: `{"user_id": "USR123", "amount": 50000}` → `{"user_id": "USR123", "amount": 50000}`. Đây là mẫu minh họa replay trong phiếu; body đặt xe và endpoint thanh toán thực tế ở các dòng API phía trên.
