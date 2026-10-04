# SOFTWARE REQUIREMENTS SPECIFICATION
# CAB SYSTEM

**Phiên bản:** 1.3.1 (01/10/2026) — xem [mục 19](#19-lịch-sử-thay-đổi)

---

# 1. Mục tiêu

CAB System là nền tảng quản lý và vận hành dịch vụ đặt xe, gồm các chức năng dành cho Customer, Driver, nhân viên vận hành, Administrator và Ban giám đốc; đồng thời tích hợp Payment Provider, Map Provider và Kafka cho messaging/notification.

Hệ thống quản lý xuyên suốt vòng đời:

```text
Account / Authentication
        ↓
Customer / Driver / Fleet
        ↓
Booking → Dispatch → Offer
        ↓
Trip
        ↓
Payment → Review
        ↓
Notification / Reporting / Audit
```

---

# 2. Stakeholders

| Stakeholder | Vai trò | Mối quan tâm |
|---|---|---|
| **Customer** | Người đặt xe và sử dụng dịch vụ | Đặt xe, theo dõi chuyến, thanh toán, đánh giá |
| **Driver** | Người nhận và thực hiện chuyến | Nhận chuyến, cập nhật trạng thái/vị trí, xem lịch sử |
| **Employee** | Nhân viên vận hành hệ thống | Quản lý user, driver, booking, trip, payment, incident |
| **Administrator** | Quản trị hệ thống | Account, role, permission, security |
| **Board of Directors** | Ban giám đốc | Dashboard, KPI, doanh thu, hiệu quả vận hành |
| **Payment Provider** | Cổng thanh toán bên ngoài | Thanh toán và callback |
| **Map Provider** | Dịch vụ bản đồ bên ngoài | Geocoding, route distance, ETA |
| **Kafka** | Event streaming backbone | Publish/subscribe nghiệp vụ và notification |

---

# 3. Actors

## 3.1 Customer

Customer có thể:

- Đăng ký và đăng nhập.
- Xem và cập nhật hồ sơ trong phạm vi cho phép.
- Tìm Driver quanh vị trí.
- Tạo và xem Booking.
- Theo dõi Trip.
- Hủy chuyến theo rule.
- Thanh toán.
- Đánh giá chuyến.
- Xem Notification.

## 3.2 Driver

Driver có thể:

- Đăng ký bằng OTP.
- Đăng nhập bằng Account đã được tạo/hoàn tất đăng ký.
- Xem hồ sơ.
- Chờ Admin duyệt.
- Bật/tắt nhận chuyến.
- Cập nhật vị trí.
- Xem và nhận Offer.
- Thực hiện Trip.
- Hủy Trip theo rule.
- Xem Notification.

## 3.3 Employee

Employee là nhóm người dùng nội bộ phục vụ vận hành, gồm các role:

| Role | Phạm vi chính |
|---|---|
| `OPERATIONS_STAFF` | Booking, Dispatch, Trip, Driver |
| `USER_STAFF` | Customer, Driver, Account |
| `FINANCE_STAFF` | Payment, transaction |
| `SUPERVISOR` | Reassign, exception handling, giám sát vận hành |

Employee đăng nhập bằng Account có role/permission phù hợp và chỉ thực hiện nghiệp vụ theo permission được cấp.

## 3.4 Administrator

Administrator đăng nhập bằng Account có role `ADMIN` và quản lý:

- Account.
- Role.
- Permission.
- Khóa/mở khóa account.
- Gán role.
- Kiểm soát truy cập.

## 3.5 Board of Directors

Board of Directors đăng nhập bằng Account có role `BOARD` và sử dụng hệ thống ở chế độ **read-only** để xem:

- Dashboard.
- Booking/Trip KPI.
- Doanh thu.
- Completion rate.
- Cancellation rate.
- Driver performance.
- Báo cáo theo thời gian và khu vực.

## 3.6 Payment Provider

Payment Provider xử lý thanh toán bên ngoài và gửi callback về hệ thống.

## 3.7 Map Provider

Map Provider cung cấp:

- Geocoding.
- Reverse geocoding.
- Route distance.
- ETA.

## 3.8 Kafka

Kafka là event streaming backbone cho các event nghiệp vụ và notification. Client không kết nối Kafka trực tiếp.

---

# 4. Business Goals

| Mã | Business Goal |
|---|---|
| BG01 | Quản lý account và authentication |
| BG02 | Cho phép Customer tạo và quản lý Booking |
| BG03 | Tìm và phân công Driver phù hợp |
| BG04 | Quản lý vòng đời Trip |
| BG05 | Hỗ trợ thanh toán và đánh giá |
| BG06 | Gửi và lưu Notification |
| BG07 | Hỗ trợ nhân viên vận hành Customer, Driver, Booking, Trip |
| BG08 | Tra cứu Payment và xử lý Incident |
| BG09 | Quản lý RBAC và bảo mật hệ thống |
| BG10 | Cung cấp Dashboard/KPI/báo cáo cho Ban giám đốc |
| BG11 | Tích hợp Map Provider để chuẩn hóa vị trí, distance và ETA |
| BG12 | Sử dụng Kafka cho Pub/Sub và event-driven integration |
| BG13 | Ghi nhận Audit đối với thao tác quản trị/vận hành nhạy cảm |

---

# 5. Scope

## 5.1 Chức năng hệ thống

- Account, Authentication và RBAC.
- Customer Profile.
- Driver Profile và Driver onboarding.
- Fleet/Vehicle.
- Driver availability và location.
- Booking, Dispatch và Offer.
- Trip operations.
- Fare và Payment.
- Review.
- Notification.
- Employee Operations.
- Incident.
- Reporting và Dashboard.
- Audit.
- Map integration.
- Kafka event streaming.

## 5.2 Không thuộc hệ thống

- Quản lý lương Driver.
- Kế toán doanh nghiệp đầy đủ.
- Quản lý kho/nhiên liệu.
- Bảo dưỡng Vehicle chi tiết.
- Dynamic pricing phức tạp.
- Loyalty/Membership/Subscription.
- Machine Learning dự đoán nhu cầu.
- GPS history chi tiết không phục vụ nghiệp vụ.
- Hoa hồng/phí nền tảng: hệ thống **không thu hoa hồng**; số tiền Payment bằng đúng `Trip.fare`.
- Chi trả (payout) cho Driver, giữ tiền (hold/authorization) và hoàn tiền (refund): Payment chỉ xử lý thanh toán của Customer cho Trip đã `COMPLETED`.

---

# 6. Business Workflows

## 6.1 Customer đặt xe

```text
Customer
  ↓
Create Booking
  ↓
SEARCHING
  ↓
Dispatch tìm Driver đủ điều kiện
  ↓
Offer (TTL)
  ├── Accept → ASSIGNED → Trip
  └── Reject/Expire → Offer tiếp theo
              ↓
       hết lượt tìm → NO_DRIVER_FOUND

Trip
  ↓
Payment
  ↓
Review
```

Matching được kích hoạt tự động sau khi Booking được tạo. Hệ thống thử tối đa số lần `OFFER_MAX_ATTEMPTS` đã cấu hình; mỗi Offer có thời gian sống `OFFER_TTL_SEC`. Nếu không có Offer được chấp nhận, Booking chuyển `NO_DRIVER_FOUND`.

## 6.2 Thực hiện Trip

```text
ASSIGNED
   ↓
ARRIVED
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

hoặc:

```text
ASSIGNED / ARRIVED
        ↓
     CANCELED
```

## 6.3 Employee vận hành

```text
Employee Login
      ↓
Search / Monitor
      ├── Customer
      ├── Driver
      ├── Booking
      ├── Offer
      ├── Trip
      └── Payment
      ↓
Operation
      ├── Cancel
      ├── Reassign
      ├── Incident
      └── Exception handling
      ↓
Audit Log
```

## 6.4 Board xem báo cáo

```text
Board Login
   ↓
Dashboard
   ├── Booking
   ├── Trip
   ├── Revenue
   ├── Completion Rate
   ├── Cancellation Rate
   └── Driver Performance
```

## 6.5 Notification qua Kafka

```text
Domain Service
      ↓
Kafka Topic
      ↓
notification-service
      ↓
Notification DB
      ↓
Customer / Driver / Employee
```

Event mẫu:

- `booking.created`
- `booking.no_driver_found`
- `offer.created`
- `trip.assigned`
- `trip.canceled`
- `trip.completed`
- `payment.completed`
- `payment.failed`
- `driver.approved`
- `driver.rejected`
- `incident.created`
- `incident.resolved`

## 6.6 Map Provider

```text
Client / Employee
      ↓
Gateway
      ↓
Domain Service
      ↓
Map Provider
      ↓
Distance / ETA / Geocoding
```

---
## 6.7 Thanh toán

```text
Trip COMPLETED
    ↓
Customer: POST /payments (Idempotency-Key)
    ↓
payment-service: kiểm tra Trip COMPLETED + đúng Customer, amount = Trip.fare
    ↓
Payment PENDING ──▶ Payment Provider (tạo transaction → providerTransactionId)
    ↓
Provider xử lý
    ↓
Callback HMAC → POST /payments/callback
    ├── chữ ký hợp lệ + SUCCESS → Payment COMPLETED → Trip.paymentStatus = PAID
    ├── chữ ký hợp lệ + FAILED  → Payment FAILED (Customer có thể tạo Payment mới)
    └── chữ ký sai              → 401, không đổi trạng thái
```

Số tiền do server lấy từ `Trip.fare`; client không được gửi `amount` và không được tự xác nhận Payment success. Callback lặp lại theo `providerTransactionId` không tạo Payment thành công lần hai.

Quy tắc bổ sung:

1. Payment chỉ phát sinh **sau khi** Trip `COMPLETED`. Hủy Booking/Trip không tạo Payment nên không có refund.
2. `POST /payments` nhận `tripId`, `method` (`ONLINE`) và `paymentMethodId` tùy chọn; không nhận `amount`.
3. Payment `PENDING` quá `PAYMENT_PENDING_TIMEOUT_MIN` phút mà chưa có callback chuyển `FAILED` (`failureCode = TIMEOUT`). Callback `SUCCESS` đến muộn sau đó được ghi nhận, không tự đổi trạng thái và phát cảnh báo cho Finance.
4. Payment Provider là hệ thống ngoài (mock trong môi trường test); hợp đồng giao tiếp ở [FR-P03–FR-P05](#96-payment-provider--fr).

## 6.8 Driver onboarding bằng OTP

```text
Driver request OTP
    ↓
OTP 6 số / TTL 5 phút
    ↓
Verify OTP
    ├── sai quá 5 lần → khóa 15 phút
    └── đúng → registrationToken (15 phút)
                     ↓
               Submit profile + Vehicle
                     ↓
                PENDING_APPROVAL
```


# 6.9 Quy tắc Account và Registration

## 6.9.1 Customer registration

`POST /auth/register` yêu cầu tối thiểu:

| Field | Quy tắc |
|---|---|
| `fullName` | bắt buộc, không rỗng |
| `email` | bắt buộc, định dạng email hợp lệ, unique |
| `phone` | bắt buộc, định dạng số điện thoại hợp lệ, unique qua `phone_hash` |
| `password` | bắt buộc, tối thiểu 8 ký tự |

Trùng email/phone trả `409 Conflict`; dữ liệu sai định dạng trả `400 Bad Request`.

## 6.9.2 Role login

`POST /auth/login` dùng chung cho Customer, Driver, Employee, Administrator và Board. Body gồm `password` và **một** định danh: `email` hoặc `phone`. Customer đăng ký bằng cả email lẫn phone nên dùng được cả hai; Driver chỉ cần `phone`. Account phải ở trạng thái hoạt động và credential hợp lệ; role lấy từ server-side account record. Sai thông tin trả `401` với thông báo chung, không tiết lộ định danh nào tồn tại.

## 6.9.3 Internal accounts

Môi trường test phải seed ít nhất một Account cho Admin, Board và từng role Employee. Driver login sử dụng Account được tạo trong quá trình onboarding.

## 6.9.4 Driver registration

`POST /drivers/register` (sau khi verify OTP) nhận `registrationToken` và:

| Field | Quy tắc |
|---|---|
| `phone` | bắt buộc, đã verify OTP, unique qua `phone_hash`; là định danh đăng nhập của Driver |
| `password` | bắt buộc, tối thiểu 8 ký tự |
| `fullName` | bắt buộc |
| `email` | tùy chọn; nếu có phải hợp lệ và unique |
| `dateOfBirth`, `nationalId` | bắt buộc; `nationalId` unique qua hash |
| `licenseNumber`, `licenseClass`, `licenseExpiryDate` | bắt buộc; bằng lái hết hạn bị từ chối |
| `vehicle` | bắt buộc: `vehicleType`, `plateNumber` (unique), `brand`, `model`, `color`, `manufactureYear`, `seatCount` |

Kết quả: Account role `DRIVER` ở trạng thái `PENDING` và hồ sơ Driver `PENDING_APPROVAL`. Driver chưa được duyệt không thể đăng nhập hoặc chuyển `ONLINE`; duyệt thì Account `ACTIVE`, từ chối thì Account bị xoá.

# 7. State Machine

## 7.1 Trạng thái

| Đối tượng | Trạng thái chính |
|---|---|
| Driver | `PENDING_APPROVAL`, `REJECTED`, `OFFLINE`, `ONLINE`, `BUSY` |
| Booking | `SEARCHING`, `ASSIGNED`, `NO_DRIVER_FOUND`, `COMPLETED`, `CANCELED` |
| Offer | `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELED` |
| Trip | `ASSIGNED`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELED` |
| Payment | `PENDING`, `COMPLETED`, `FAILED` |
| Incident | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |

`APPROVED` là điều kiện nghiệp vụ sau khi Administrator duyệt hồ sơ, không phải trạng thái Driver lưu độc lập. Sau khi được duyệt, Driver được chuyển về `OFFLINE`; chỉ Driver đã được duyệt mới được chuyển sang `ONLINE`.

## 7.2 Chuyển trạng thái hợp lệ

| Đối tượng | Chuyển trạng thái hợp lệ | Chuyển không hợp lệ |
|---|---|---|
| Driver | `PENDING_APPROVAL → OFFLINE`; `REJECTED → PENDING_APPROVAL` khi được cho đăng ký lại; `OFFLINE ↔ ONLINE`; `ONLINE → BUSY`; `BUSY → ONLINE` | `PENDING_APPROVAL → ONLINE`, `REJECTED → ONLINE`, `BUSY → OFFLINE` |
| Booking | `SEARCHING → ASSIGNED/NO_DRIVER_FOUND/CANCELED`; `ASSIGNED → COMPLETED/CANCELED` | Mọi chuyển từ `COMPLETED`, `CANCELED`, `NO_DRIVER_FOUND` sang trạng thái khác |
| Offer | `PENDING → ACCEPTED/REJECTED/EXPIRED/CANCELED` | Chuyển từ trạng thái cuối |
| Trip | `ASSIGNED → ARRIVED/CANCELED`; `ARRIVED → IN_PROGRESS/CANCELED`; `IN_PROGRESS → COMPLETED` | `IN_PROGRESS → CANCELED`, nhảy bước, hoặc chuyển từ trạng thái cuối |
| Payment | `PENDING → COMPLETED/FAILED`; Payment mới được tạo lại sau `FAILED` | `COMPLETED → FAILED/PENDING` hoặc xử lý thành công lần hai |
| Incident | `OPEN → IN_PROGRESS → RESOLVED → CLOSED` | Nhảy trạng thái hoặc thay đổi sau `CLOSED` |

## 7.3 Quy tắc Booking/Trip cascade

1. Khi Trip chuyển `COMPLETED`, Booking tương ứng chuyển `COMPLETED`.
2. Khi Trip chuyển `CANCELED`, Booking tương ứng chuyển `CANCELED`.
3. Khi Customer hủy Booking ở `SEARCHING`, không tạo Trip và không phát sinh Payment.
4. Khi Trip bị hủy từ `ASSIGNED`/`ARRIVED`, Driver trở về `ONLINE`; các Offer còn `PENDING` chuyển `CANCELED`.

## 7.4 Quy tắc Dispatch/Offer

1. Chỉ Driver đã được duyệt, đang `ONLINE`, không `BUSY` và phù hợp `vehicleType` mới đủ điều kiện nhận Offer.
2. Hệ thống ưu tiên Driver gần điểm đón nhất theo khoảng cách đã tính.
3. Mỗi Offer có TTL `OFFER_TTL_SEC`; hết TTL chuyển `EXPIRED`.
4. Một Booking có tối đa `OFFER_MAX_ATTEMPTS` lần Offer.
5. Chỉ một Driver có thể `ACCEPTED` cho một Booking. Khi hai request Accept đồng thời, request thắng là request commit transaction đầu tiên; request còn lại nhận `409 Conflict`.
6. Khi Offer được Accept, Booking chuyển `ASSIGNED`, Trip được tạo, Driver chuyển `BUSY` và các Offer `PENDING` còn lại của Booking chuyển `CANCELED`.
7. Khi tất cả Offer đều hết hạn/từ chối và không còn Driver phù hợp, Booking chuyển `NO_DRIVER_FOUND` và phát event `booking.no_driver_found`.
8. Khi Booking đang `SEARCHING`, mỗi Driver chỉ có tối đa một Offer `PENDING` tại một thời điểm và không được mời lại cho cùng Booking.
9. `POST /offers/{id}/accept` là idempotent với cùng Driver: nếu Offer đã `ACCEPTED` bởi chính Driver đó thì tiếp tục/trả kết quả của luồng nhận chuyến thay vì lỗi.
10. Luồng nhận chuyến gồm: Offer `ACCEPTED` → tạo Trip (idempotent theo `bookingId`) → Driver `BUSY` → Booking `ASSIGNED`. Nếu một bước lỗi tạm thời, hệ thống phải tự hoàn tất lại (recovery) mà không tạo Trip trùng.
11. Khi Driver chuyển `OFFLINE` trong lúc có Offer `PENDING`, Offer đó chuyển `CANCELED` và Booking thử Driver kế tiếp.

# 8. Use Cases

> **Nguyên tắc:** UC được dùng cho các luồng nghiệp vụ có ý nghĩa độc lập. Các tiêu chí kỹ thuật như source structure, secret management và internal REST được đặc tả bằng FR/NFR/architecture thay vì tạo UC chỉ để tăng số lượng. Các tiêu chí có luồng kiểm tra trực tiếp được giữ UC riêng.
>
> `Đăng nhập` là **một UC dùng chung** cho Customer, Driver, Employee, Administrator và Board. Role/permission được xác định từ Account và kiểm soát bằng RBAC; không tạo UC đăng nhập riêng cho từng actor.

## 8.1 Use Cases phục vụ trực tiếp phiếu chấm

| UC | Actor | Use Case | FR liên quan | PC# |
|---|---|---|---|:-:|
| UC01 | Customer | Đăng ký Customer | FR-C01 | 9 |
| UC02 | Customer / Driver / Employee / Administrator / Board | Đăng nhập và nhận JWT | FR-C02 | 10 |
| UC03 | Customer | Xem hồ sơ Customer | FR-C03 | 11 |
| UC04 | Driver | Xem hồ sơ Driver | FR-D04 | 12 |
| UC05 | Customer / Driver | Tìm Driver quanh vị trí và cập nhật location | FR-C04, FR-D06 | 13 |
| UC06 | Customer | Xem Booking của mình | FR-C05 | 14 |
| UC07 | Customer | Đặt xe và matching Driver | FR-C06, FR-C07 | 15 |
| UC08 | Driver | Xem và nhận Offer | FR-D07, FR-D08 | 16 |
| UC09 | Customer / Driver | Theo dõi và cập nhật vòng đời Trip | FR-C08, FR-D09 | 17 |
| UC10 | Customer / Driver | Hủy Booking/Trip | FR-C09, FR-D10 | 18 |
| UC11 | Customer / Payment Provider | Thanh toán online và callback | FR-C10, FR-P01, FR-P02 | 19 |
| UC12 | Customer | Đánh giá Trip | FR-C11 | 20 |
| UC13 | Driver | Đăng ký Driver bằng OTP và gửi hồ sơ | FR-D01, FR-D02, FR-D03 | 21 |
| UC14 | Administrator | Xem và duyệt/từ chối Driver | FR-A01, FR-A02, FR-A03 | 22 |
| UC15 | Driver | Bật/tắt nhận chuyến | FR-D05 | 23 |
| UC16 | Client / Gateway | Gateway Routing / Authentication / RBAC / Rate Limit | FR-S02, FR-S03 | 3, 8 |
| UC17 | System Operator | Docker Compose Deployment | FR-S04 | 5 |
| UC18 | System | Health Check / Readiness | FR-S01 | 6 |
| UC19 | Domain Services / Notification Service | Kafka Messaging / Notification Event | FR-S06, FR-K01–FR-K04 | 7 |
| UC20 | Tester / System | Security Validation | FR-S07–FR-S13 | 24–30 |

## 8.2 Use Cases cơ bản của actor không có tiêu chí chấm riêng

Các actor này **không bị loại khỏi hệ thống**. Vì không có tiêu chí chấm riêng, chỉ giữ những UC cơ bản đủ để thể hiện họ sử dụng hệ thống như thế nào; chi tiết nghiệp vụ được đặc tả bằng FR/BR.

| UC | Actor | Use Case | FR liên quan | Ghi chú |
|---|---|---|---|---|
| UC21 | Employee | Vận hành và hỗ trợ nghiệp vụ | FR-E01–FR-E15 | Gom tìm kiếm, giám sát, hỗ trợ Booking/Trip, Reassign, Payment, Incident và Audit |
| UC22 | Board of Directors | Xem Dashboard và báo cáo quản trị | FR-B01–FR-B06 | Read-only; không tạo UC riêng cho từng KPI/report |
| UC23 | Map Provider | Cung cấp dịch vụ bản đồ | FR-M01–FR-M06 | Gom Geocoding, Reverse Geocoding, Distance và ETA thành một integration UC |

## 8.3 Nghiệp vụ không tạo UC riêng

Các chức năng sau vẫn thuộc SRS nhưng được mô tả bằng FR/BR/workflow thay vì tách thành UC riêng:

- **Administrator:** quản lý Account, Role và Permission theo `FR-A04–FR-A06`.
- **Notification:** Customer, Driver và Employee xem Notification theo các FR tương ứng; Kafka/Notification được kiểm tra tập trung ở `UC19`.
- **Authentication theo từng role:** không có `UC62–UC65`; mọi role sử dụng `UC02`.
- **Map sub-function:** Geocoding, Reverse Geocoding, Route Distance và ETA thuộc `UC23`, không tách thành 4 UC.
- **Employee sub-function:** Search Customer, Search Driver, Booking support, Trip monitoring, Reassign, Incident và Audit thuộc `UC21`, không tách thành 15 UC.
- **Board sub-function:** KPI, Revenue, Driver Performance và filter report thuộc `UC22`, không tách thành các UC riêng.

PC1, PC2 và PC4 là các tiêu chí kỹ thuật/quality attribute nên được truy vết trực tiếp tới `FR-S14`, `FR-S05` và `FR-S06`, không cần tạo UC riêng chỉ để chứa chúng.

# 9. Functional Requirements theo Actor

## 9.1 Customer — FR

| Mã | Yêu cầu | PC# |
|---|---|:-:|
| FR-C01 | Customer đăng ký tài khoản bằng thông tin hợp lệ | 9 |
| FR-C02 | Người dùng (Customer, Driver, Employee, Administrator hoặc Board) đăng nhập bằng credential hợp lệ và nhận JWT; role được lấy từ Account server-side và không được tin từ client | 10 |
| FR-C03 | Customer lấy thông tin hồ sơ của chính mình bằng token | 11 |
| FR-C04 | Customer tìm Driver quanh tọa độ với radius, filter status và paging | 13 |
| FR-C05 | Customer liệt kê Booking của chính mình bằng `page` và `limit`; response có `data`, `pagination.page`, `pagination.limit`, `pagination.total`, `pagination.totalPages` | 14 |
| FR-C06 | Customer tạo Booking với pickup, destination và vehicleType hợp lệ | 15 |
| FR-C07 | Hệ thống tự động matching sau khi tạo Booking, tìm Driver phù hợp, tạo Offer theo TTL và giới hạn số lần thử | 15 |
| FR-C08 | Customer theo dõi trạng thái Trip, thông tin Driver/Vehicle được gán và vị trí hiện tại của Driver trong Trip | 16, 17 |
| FR-C09 | Customer hủy Booking/Trip khi state cho phép và cung cấp reason; Booking ở `SEARCHING` có thể chuyển `CANCELED` trước khi có Driver | 18 |
| FR-C10 | Customer tạo Payment và theo dõi kết quả | 19 |
| FR-C11 | Customer đánh giá Trip đã hoàn thành bằng `stars` từ 1–5 và `comment` tối đa 500 ký tự; mỗi Trip chỉ có một Review | 20 |
| FR-C12 | Customer xem danh sách Notification của mình (`GET /notifications`, có paging) và đánh dấu đã đọc | 15, 16 |

## 9.2 Driver — FR

| Mã | Yêu cầu | PC# |
|---|---|:-:|
| FR-D01 | Driver yêu cầu OTP khi đăng ký | 21 |
| FR-D02 | Driver xác thực OTP trước khi gửi hồ sơ | 21 |
| FR-D03 | Driver gửi hồ sơ cá nhân, giấy tờ, mật khẩu và Vehicle theo [mục 6.9.4](#694-driver-registration); hồ sơ được tạo ở `PENDING_APPROVAL` | 21 |
| FR-D04 | Driver xem thông tin hồ sơ của mình | 12 |
| FR-D05 | Driver bật/tắt trạng thái nhận chuyến theo state machine; `BUSY` không được chuyển trực tiếp sang `OFFLINE`; khi chuyển `ONLINE` phải có location hợp lệ gần nhất | 23 |
| FR-D06 | Driver cập nhật vị trí hiện tại | 13 |
| FR-D07 | Driver xem Offer được giao | 16 |
| FR-D08 | Driver accept Offer theo state machine | 16 |
| FR-D09 | Driver cập nhật trạng thái Trip | 17 |
| FR-D10 | Driver hủy Trip từ `ASSIGNED` hoặc `ARRIVED`, bắt buộc reason; `IN_PROGRESS` không được hủy | 18 |
| FR-D11 | Driver xem Notification của mình |  |

## 9.3 Administrator — FR

| Mã | Yêu cầu | PC# |
|---|---|:-:|
| FR-A01 | Administrator xem danh sách hồ sơ Driver chờ duyệt | 22 |
| FR-A02 | Administrator duyệt hồ sơ Driver; Driver chuyển từ `PENDING_APPROVAL` sang `OFFLINE`, kích hoạt Account, ghi Audit và phát `driver.approved` | 22 |
| FR-A03 | Administrator từ chối hồ sơ Driver, ghi `rejectReason`, phát `driver.rejected` và ghi Audit; Driver chuyển `REJECTED`, Account bị xoá | 22 |
| FR-A04 | Administrator khóa/mở khóa Account |  |
| FR-A05 | Administrator quản lý trạng thái Account |  |
| FR-A06 | Administrator gán/quản lý Role và Permission |  |

## 9.4 Employee — FR

| Mã | Yêu cầu |
|---|---|
| FR-E01 | Employee tìm Customer theo id/name/phone/email theo permission; khi tìm bằng phone, hệ thống HMAC phone bằng `PHONE_HASH_PEPPER` rồi đối chiếu `phone_hash`, không query plaintext trên cột mã hóa |
| FR-E02 | Employee xem và quản lý Customer theo permission |
| FR-E03 | Employee tìm Driver theo id/name/status/vehicleType/khu vực |
| FR-E04 | Employee xem và quản lý Driver/Vehicle theo permission |
| FR-E05 | Employee xem Booking theo status/time/customer/driver |
| FR-E06 | Employee hỗ trợ Booking theo state machine và permission |
| FR-E07 | Employee xem Offer và trạng thái dispatch |
| FR-E08 | Employee theo dõi Trip đang hoạt động, gồm Driver, state và location |
| FR-E09 | Employee hủy Booking/Trip khi state và permission cho phép; bắt buộc reason |
| FR-E10 | Supervisor reassign Driver cho Booking/Trip khi điều kiện state cho phép |
| FR-E11 | FINANCE_STAFF hoặc role được cấp quyền tra cứu Payment và provider transaction |
| FR-E12 | Employee tạo Incident gắn với Booking/Trip/Account |
| FR-E13 | Employee cập nhật Incident đến trạng thái RESOLVED/CLOSED |
| FR-E14 | Employee xem Audit Log trong phạm vi permission |
| FR-E15 | Employee xem Notification liên quan tới nghiệp vụ mình được phép xem |

## 9.5 Board of Directors — FR

| Mã | Yêu cầu |
|---|---|
| FR-B01 | Board xem Dashboard tổng quan Booking, Trip, Driver và Payment |
| FR-B02 | Board xem tổng số Trip, completed/canceled và completion/cancellation rate |
| FR-B03 | Board xem doanh thu theo ngày/tháng/quý |
| FR-B04 | Board xem hiệu quả Driver theo số chuyến và các KPI vận hành |
| FR-B05 | Board lọc Dashboard/Report theo khoảng thời gian và khu vực |
| FR-B06 | Board chỉ có quyền đọc dữ liệu báo cáo và không được mutate nghiệp vụ |

## 9.6 Payment Provider — FR

| Mã | Yêu cầu | PC# |
|---|---|:-:|
| FR-P01 | Payment Provider xử lý transaction theo payment request hợp lệ | 19 |
| FR-P02 | Payment Provider gửi callback có xác thực HMAC về hệ thống; `providerTransactionId` phải duy nhất | 19 |
| FR-P03 | Payment Service gọi Payment Provider `POST /transactions` với `merchantRef` (= `paymentId`), `amount`, `currency`, `callbackUrl`; Provider trả `providerTransactionId` và trạng thái `PENDING` | 19 |
| FR-P04 | Callback gồm header `X-Signature = HMAC-SHA256(rawBody, PAYMENT_CALLBACK_SECRET)` và body `providerTransactionId`, `merchantRef`, `status` (`SUCCESS`/`FAILED`), `amount`, `occurredAt`; Payment kiểm tra chữ ký trên raw body, khớp `amount` với Payment, xử lý idempotent | 19, 30 |
| FR-P05 | Mock Payment Provider tự gửi callback sau `MOCK_CALLBACK_DELAY_MS` và có endpoint `POST /mock/transactions/{id}/complete?result=SUCCESS` hoặc `?result=FAILED` để kiểm thử thủ công bằng Postman | 19 |

## 9.7 Map Provider — FR

| Mã | Yêu cầu |
|---|---|
| FR-M01 | Hệ thống gọi Map Provider để geocode địa chỉ |
| FR-M02 | Hệ thống reverse geocode tọa độ khi nghiệp vụ cần địa chỉ hiển thị |
| FR-M03 | Hệ thống lấy route distance cho điểm đi/điểm đến |
| FR-M04 | Hệ thống lấy ETA cho Trip/ước lượng |
| FR-M05 | Map Provider timeout/error phải được chuẩn hóa; không làm lộ lỗi nội bộ |
| FR-M06 | API key/secret của Map Provider chỉ tồn tại ở server-side configuration |

## 9.8 Kafka / Notification — FR

| Mã | Yêu cầu |
|---|---|
| FR-K01 | Domain Service publish event với envelope thống nhất lên Kafka |
| FR-K02 | Notification Service subscribe các topic nghiệp vụ cần thiết |
| FR-K03 | Notification Service tạo Notification tương ứng recipient từ event |
| FR-K04 | Consumer Kafka có retry, idempotency và DLQ |
| FR-K05 | Notification được lưu vào DB để Customer/Driver/Employee xem lại |
| FR-K06 | Duplicate event không tạo duplicate Notification |
| FR-K07 | Notification event phải có `eventId`, `eventType`, `occurredAt`, `producer` và dữ liệu nghiệp vụ tối thiểu |

## 9.9 Security / System — FR

| Mã | Yêu cầu | PC# |
|---|---|:-:|
| FR-S01 | Các service có `/health`, `/ready`; Gateway có `GET /health/services`. `/ready` trả `503` nếu dependency bắt buộc như DB/Kafka chưa sẵn sàng. | 6 |
| FR-S02 | Gateway là entry point của client, thực hiện routing và JWT validation. | 3, 8 |
| FR-S03 | Gateway/service áp dụng RBAC, rate limit và input validation/sanitization theo endpoint. | 3, 8, 29 |
| FR-S04 | Toàn hệ thống chạy được bằng Docker Compose. | 5 |
| FR-S05 | Không để lộ secret trong repository, image, response hoặc log không cần thiết; cấu hình nhạy cảm dùng environment/secret management. | 2 |
| FR-S06 | Internal service sử dụng REST cho synchronous call; event-driven communication sử dụng Kafka. Internal API chỉ được gọi từ service network và phải có service credential. | 4, 7 |
| FR-S07 | Dữ liệu nhạy cảm phải được bảo vệ khi lưu trữ: password dùng bcrypt; PII nhạy cảm như `phone`, `license_number` dùng AES-256-GCM; giá trị tra cứu như `phone_hash` sử dụng HMAC-SHA256 với secret key. Encryption key và HMAC key nằm ngoài source code/image. | 24 |
| FR-S08 | Chống SQL/NoSQL Injection bằng parameterized query, schema validation và input validation; payload độc hại không được thay đổi logic truy vấn. | 25 |
| FR-S09 | Chống XSS/input injection: dữ liệu text phải được validate và encode/sanitize; response API sử dụng JSON và không thực thi HTML/JavaScript từ user input. | 26 |
| FR-S10 | JWT phải kiểm tra thuật toán `HS256`, signature, `exp`, `iat`, `sub`, `role`; token sửa payload, sai signature, hết hạn hoặc `alg=none` phải bị từ chối với `401`. | 27 |
| FR-S11 | Unauthorized resource access phải bị từ chối bằng RBAC/ownership check; service sở hữu resource phải kiểm tra ownership, không chỉ tin Gateway. | 28 |
| FR-S12 | Rate limit: mặc định `100 req/phút/IP`; `POST /bookings` là `10 req/phút/user`; `POST /auth/login` là `10 req/phút/IP`. Khi vượt ngưỡng trả `429` và `Retry-After`. Counter dùng Redis. | 29 |
| FR-S13 | Idempotency: `POST /bookings` và `POST /payments` bắt buộc `Idempotency-Key`; cùng key + cùng payload trả lại response cũ; cùng key + payload khác trả `422`; callback dùng unique `providerTransactionId`; duplicate event dùng `eventId` và không tạo duplicate effect. TTL idempotency mặc định 24 giờ. | 30 |
| FR-S14 | Project có đầy đủ source structure, Postman collection, automated test và documentation phục vụ kiểm tra 30 tiêu chí. | 1 |
| FR-S15 | Chỉ API Gateway publish port ra host trong môi trường Compose; service nghiệp vụ không publish port trực tiếp ra host. | 8 |
| FR-S16 | Mọi API danh sách trả `{ "data": [...], "pagination": { "page", "limit", "total", "totalPages" } }`; `page` bắt đầu từ 1, `limit` mặc định `PAGE_LIMIT_DEFAULT`, tối đa `PAGE_LIMIT_MAX`; giá trị ngoài miền hợp lệ trả `400`. | 13, 14 |
| FR-S17 | Request thiếu `Idempotency-Key` trên endpoint bắt buộc trả `400`; Internal API xác thực bằng service credential (JWT nội bộ ngắn hạn có `iss`/`aud`), service kiểm tra `iss` nằm trong danh sách được phép gọi endpoint đó. | 4, 8, 30 |
| FR-S18 | Mỗi service phải có `GET /health` (liveness) và `GET /ready` (kiểm tra DB/Redis/Kafka mà service phụ thuộc); Gateway tổng hợp tại `/health/services`. | 6 |

### 9.9.1 Chuẩn cấu trúc project

Project phải có cấu trúc logic tương đương:

```text
gateway/
services/
  identity-service/
  customer-service/
  driver-service/
  booking-service/
  trip-service/
  payment-service/
  notification-service/
  backoffice-service/        # giai đoạn P2
mocks/
  mock-payment-provider/
  mock-map-provider/
shared/                      # thư viện dùng chung: auth, service-auth, kafka, outbox, idempotency, crypto, sanitize, errors, pagination
postman/
tests/
docs/
scripts/                     # init Kafka topics, seed dữ liệu
docker-compose.yml
.env.example
.gitignore
README.md
```

Mỗi service có `src/` (routes, controllers, services, repositories, events), `migrations/`, `Dockerfile`, `package.json`, `tests/`. `node_modules/`, `.env` và secret không được commit; `.env.example` bắt buộc commit.

Tên thư mục có thể khác nếu vẫn thể hiện rõ các boundary tương ứng.

### 9.9.2 Chuẩn response lỗi

Mọi API lỗi sử dụng format:

```json
{
  "code": "RESOURCE_FORBIDDEN",
  "message": "You do not have permission to access this resource.",
  "requestId": "req_123"
}
```

Mã HTTP chuẩn: `400` validation, `401` chưa xác thực/token không hợp lệ, `403` sai quyền/ownership, `404` không tồn tại, `409` xung đột state, `422` sai Idempotency-Key/payload, `429` rate limit.

### 9.9.3 Authentication và JWT

- Customer, Driver, Employee, Administrator và Board đều sử dụng JWT.
- JWT sử dụng `HS256` với secret từ environment/secret management.
- `exp` mặc định 15 phút.
- Claims tối thiểu: `sub`, `role`, `iat`, `exp`.


# 10. Business Rules theo Actor

## 10.1 Customer — BR

| Mã | Quy tắc |
|---|---|
| BR-C01 | Chỉ Customer đã xác thực mới được tạo Booking |
| BR-C02 | Customer chỉ được đọc/sửa resource thuộc mình nếu không có quyền đặc biệt |
| BR-C03 | Booking phải có pickup, destination và vehicleType hợp lệ |
| BR-C04 | Customer chỉ được hủy Trip ở trạng thái được phép |
| BR-C05 | Chỉ Trip `COMPLETED` và thuộc Customer hiện tại mới được đánh giá; mỗi Trip chỉ một Review; `stars` từ 1–5, `comment` tối đa 500 ký tự |
| BR-C06 | Payment amount do server xác định, không tin amount từ client |

## 10.2 Driver — BR

| Mã | Quy tắc |
|---|---|
| BR-D01 | OTP gồm 6 chữ số, TTL 5 phút |
| BR-D02 | Giới hạn số lần nhập OTP sai theo policy |
| BR-D03 | Chỉ Driver đã được Administrator duyệt và đang ở `OFFLINE` mới được chuyển `ONLINE` |
| BR-D04 | Chỉ Driver đã được duyệt, `ONLINE`, phù hợp `vehicleType` và không `BUSY` mới được nhận Offer |
| BR-D05 | Driver không được tự ý nhảy trạng thái Trip và chỉ được cập nhật Trip được phân công |
| BR-D06 | Driver chỉ được cập nhật Trip mà mình được phân công |

## 10.3 Administrator — BR

| Mã | Quy tắc |
|---|---|
| BR-A01 | Chỉ Administrator hoặc role được cấp quyền mới quản lý RBAC |
| BR-A02 | Lock/unlock Account phải ghi Audit |
| BR-A03 | Thay đổi Role/Permission phải ghi Audit |
| BR-A04 | Administrator không được bỏ qua state machine nghiệp vụ nếu thao tác ảnh hưởng Booking/Trip |

## 10.4 Employee — BR

| Mã | Quy tắc |
|---|---|
| BR-E01 | Employee chỉ thực hiện thao tác theo RBAC permission |
| BR-E02 | `OPERATIONS_STAFF` không được sửa Role/Permission |
| BR-E03 | `FINANCE_STAFF` chỉ truy cập Payment theo phạm vi quyền được cấp |
| BR-E04 | Hủy Booking/Trip phải thỏa state transition và có reason |
| BR-E05 | Reassign chỉ được thực hiện khi Booking/Trip chưa ở terminal state |
| BR-E06 | Reassign phải ghi actor, lý do và thời điểm vào Audit |
| BR-E07 | Incident phải gắn với resource liên quan và có người xử lý khi chuyển `IN_PROGRESS` |
| BR-E08 | Các thao tác quản trị/vận hành nhạy cảm phải tạo Audit Log |

## 10.5 Board of Directors — BR

| Mã | Quy tắc |
|---|---|
| BR-B01 | Board chỉ có quyền đọc dữ liệu Dashboard/Report |
| BR-B02 | Board không được mutate Booking, Trip, Payment hoặc Account |
| BR-B03 | Dữ liệu nhạy cảm phải được mask/aggregate khi đưa vào báo cáo |
| BR-B04 | Report phải hỗ trợ giới hạn theo thời gian/khu vực |

## 10.6 Payment Provider — BR

| Mã | Quy tắc |
|---|---|
| BR-P01 | Callback phải được xác thực bằng HMAC theo secret cấu hình; sai chữ ký trả `401` và không đổi Payment. |
| BR-P02 | Payment callback phải idempotent theo `providerTransactionId`; callback trùng không được tạo Payment success lần hai. |
| BR-P03 | Client không được tự xác nhận Payment success |

## 10.7 Map Provider — BR

| Mã | Quy tắc |
|---|---|
| BR-M01 | Map Provider không phải source of truth cho Booking/Trip ownership |
| BR-M02 | Không gửi API key/secret Map Provider cho client |
| BR-M03 | Khi Map Provider lỗi, service trả lỗi chuẩn hóa hoặc fallback đã định nghĩa |
| BR-M04 | Map timeout không được làm transaction nghiệp vụ treo vô hạn; Nearby có thể dùng Haversine fallback để vẫn lọc bán kính khi Map Provider unavailable |

## 10.8 Kafka / Notification — BR

| Mã | Quy tắc |
|---|---|
| BR-K01 | Mỗi event có `eventId` duy nhất |
| BR-K02 | Consumer phải idempotent theo `eventId` |
| BR-K03 | Delivery có thể at-least-once; duplicate phải được xử lý an toàn |
| BR-K04 | Publisher không cần biết subscriber cụ thể |
| BR-K05 | Event lỗi lặp lại phải đi qua retry/DLQ |
| BR-K06 | Kafka outage không được làm mất transaction nghiệp vụ chính nếu transaction đã commit; event phải có cơ chế recovery phù hợp |

## 10.9 Payment / Fare — BR

| Mã | Quy tắc |
|---|---|
| BR-F01 | Fare do server tính theo `vehicleType` và `distanceKm`; không nhận `amount` từ client. |
| BR-F02 | Công thức mặc định: `fare = round(baseFare[vehicleType] + perKm[vehicleType] × distanceKm)`. Bảng giá được seed/config theo môi trường test. |
| BR-F03 | Chỉ Trip `COMPLETED` mới được tạo Payment. |
| BR-F04 | Một Trip chỉ có tối đa một Payment `COMPLETED`. Payment `FAILED` có thể tạo Payment mới. |
| BR-F05 | `Payment.amount` = `Trip.fare` tại thời điểm Trip `COMPLETED`; không có hoa hồng, không có payout cho Driver. |
| BR-F06 | Chỉ Customer sở hữu Trip mới được tạo Payment cho Trip đó. |
| BR-F07 | Trong lúc một Payment `PENDING` còn hiệu lực, không cho tạo Payment khác cho cùng Trip (`409`). |

## 10.10 OTP / Registration — BR

| Mã | Quy tắc |
|---|---|
| BR-O01 | OTP gồm 6 chữ số và TTL 5 phút. |
| BR-O02 | Tối đa 5 lần nhập sai; vượt ngưỡng thì OTP bị khóa 15 phút. |
| BR-O03 | OTP được lưu dạng hash trong Redis hoặc persistence store tương đương, không lưu plaintext. Trong môi trường test, SMS Provider có thể được mock bằng log/test endpoint để lấy OTP mà không gửi SMS thật. |
| BR-O04 | Xác thực OTP thành công cấp `registrationToken` sống 15 phút; token chỉ dùng để hoàn tất Driver registration và chỉ dùng một lần. |

## 10.11 Security / System — BR

| Mã | Quy tắc |
|---|---|
| BR-S01 | Service sở hữu resource phải kiểm tra ownership/permission |
| BR-S02 | State transition phải được kiểm tra ở service sở hữu state |
| BR-S03 | JWT phải được kiểm tra signature, expiration và permission |
| BR-S04 | Secret không được ghi vào source code, response hoặc log không cần thiết |
| BR-S05 | Rate limiting áp dụng ở các endpoint cần bảo vệ |
| BR-S06 | Security-sensitive action phải có request/correlation id để trace; Internal REST phải xác thực service credential |

---

# 11. Audit Requirements

Các thao tác sau phải tạo Audit Log:

- Lock/unlock Account.
- Gán/thay đổi Role hoặc Permission.
- Duyệt/từ chối Driver.
- Hủy Booking/Trip bởi Employee.
- Reassign Driver.
- Tạo/cập nhật/đóng Incident.
- Các thao tác quản trị khác được cấu hình là sensitive action.

Audit Log tối thiểu có:

| Field | Mô tả |
|---|---|
| `id` | Audit ID |
| `actorId` | Người thực hiện |
| `actorRole` | Role tại thời điểm thao tác |
| `action` | Hành động |
| `resourceType` | Loại resource |
| `resourceId` | ID resource |
| `requestId` | Correlation/trace ID |
| `metadata` | Metadata cần thiết |
| `createdAt` | Thời gian |

---

# 12. Notification Requirements

## 12.1 Kafka Topics

| Topic | Producer | Consumer |
|---|---|---|
| `identity.events` | identity-service | notification-service |
| `booking.events` | booking-service | notification-service, driver-service, customer-service, backoffice-service (P2) |
| `trip.events` | trip-service | booking-service, driver-service, customer-service, notification-service, backoffice-service (P2) |
| `driver.events` | driver-service | notification-service, booking-service, backoffice-service (P2) |
| `driver.location` | driver-service | trip-service |
| `payment.events` | payment-service | trip-service, customer-service, notification-service, backoffice-service (P2) |
| `incident.events` (P2) | backoffice-service (P2) | notification-service |
| `notification.commands` | domain services | notification-service |
| `notification.dlq` | notification-service | operator/admin |

Consumer/producer ghi **(P2)** chỉ có hiệu lực khi dựng `backoffice-service`; ở P1 các topic vận hành bình thường không có `backoffice-service`.

## 12.1.1 Partition key và consumer group

- `identity.events`: partition key = `accountId`.
- `booking.events`: partition key = `bookingId`.
- `trip.events`: partition key = `tripId`.
- `driver.events`, `driver.location`: partition key = `driverId`.
- `payment.events`: partition key = `tripId`.
- Mỗi service dùng consumer group trùng tên service (ví dụ `notification-service`, `booking-service`).
- Các event của cùng aggregate phải dùng cùng partition key để giữ thứ tự tương đối trong partition.
- Consumer lỗi quá số lần retry chuyển event sang topic DLT/`notification.dlq` và không chặn partition.

## 12.2 Event Envelope

```json
{
  "eventId": "evt_01J...",
  "eventType": "trip.assigned",
  "occurredAt": "2026-09-30T10:00:00Z",
  "eventVersion": 1,
  "producer": "trip-service",
  "aggregateType": "Trip",
  "aggregateId": "trip_123",
  "requestId": "req_123",
  "recipientIds": ["user_123"],
  "data": {
    "tripId": "trip_123",
    "driverId": "driver_456"
  }
}
```

Các trường `eventVersion`, `aggregateType`, `aggregateId`, `requestId` là bổ sung bắt buộc từ v1.3 để truy vết và tiến hóa schema; `data` không chứa dữ liệu nhạy cảm.

## 12.3 Notification Flow

```text
Booking / Trip / Driver / Payment / Incident
                    ↓
              Domain Event
                    ↓
                   Kafka
                    ↓
          notification-service
                    ↓
          Idempotency / Retry
                    ↓
             Notification DB
                    ↓
        Customer / Driver / Employee
```

---

# 13. Data Model

## 13.1 Các entity chính

| Service | Entity |
|---|---|
| identity-service | `accounts`, `roles`, `permissions`, `account_roles`, `role_permissions`, `refresh_tokens` (P2), `audit_logs` |
| customer-service | `customer_profiles`, `payment_methods` (P2), `customer_activity` (P2) |
| driver-service | `drivers`, `vehicles`, `work_schedules`, `driver_locations`, `driver_status_history`, OTP (Redis) |
| booking-service | `bookings`, `offers`, `booking_status_history`, `idempotency_keys` |
| trip-service | `trips`, `trip_status_history`, `fare_rules`, `reviews` |
| payment-service | `payments`, `webhook_events`, `idempotency_keys` |
| notification-service | `notifications`, `notification_templates`, `device_tokens`, `delivery_attempts` |
| mọi service phát event | `outbox_events` |
| mọi service nhận event | `processed_events` |
| backoffice-service (P2) | `incidents`, `audit_logs`, read model báo cáo |

Chi tiết cột, kiểu và ràng buộc nằm ở `microservice_design` mục 8.

## 13.2 Fare

| Field | Mô tả |
|---|---|
| `vehicleType` | BIKE / SEDAN / SUV |
| `baseFare` | Cước cơ bản |
| `perKm` | Đơn giá theo km |
| `active` | Bảng giá đang hiệu lực |

Fare được chọn theo `vehicleType` và dùng để tính amount phía server.

## 13.3 Incident

| Field | Mô tả |
|---|---|
| `id` | Incident ID |
| `type` | Loại sự cố |
| `severity` | Mức độ |
| `status` | OPEN / IN_PROGRESS / RESOLVED / CLOSED |
| `bookingId` | Booking liên quan |
| `tripId` | Trip liên quan |
| `reportedBy` | Actor tạo incident |
| `assignedTo` | Employee xử lý |
| `description` | Mô tả |
| `resolution` | Kết quả |
| `createdAt` | Thời điểm tạo |
| `resolvedAt` | Thời điểm xử lý xong |

## 13.4 Audit Logs

| Field | Mô tả |
|---|---|
| `id` | Audit ID |
| `actorId` | Employee/Admin |
| `actorRole` | Role |
| `action` | Hành động |
| `resourceType` | Loại resource |
| `resourceId` | ID resource |
| `requestId` | Trace ID |
| `metadata` | JSON metadata |
| `createdAt` | Timestamp |

---
## 13.5 Location và Fare Inputs

- `Driver.location` gồm `lat`, `lng`, `updatedAt`; latitude nằm trong `[-90,90]`, longitude trong `[-180,180]`.
- `Booking.pickup` và `Booking.destination` lưu cả địa chỉ hiển thị và `lat/lng` chuẩn hóa.
- Nearby filtering dùng tọa độ Driver + Haversine để xác định phạm vi bán kính. Map Provider dùng cho route distance/ETA và có thể fallback sang Haversine cho distance khi Provider unavailable trong môi trường test.
- `distanceKm` dùng trong Fare được lấy từ route service; nếu route provider unavailable thì dùng distance fallback đã định nghĩa.


## 13.6 Idempotency Keys

| Field | Mô tả |
|---|---|
| `userId` | User thực hiện request |
| `endpoint` | Endpoint áp dụng key |
| `key` | Idempotency-Key |
| `requestHash` | Hash payload |
| `responseStatus` | HTTP status đã trả |
| `responseBody` | Response đã trả |
| `createdAt` | Thời gian tạo |
| `expiresAt` | Thời gian hết hiệu lực |

Unique key: `(userId, endpoint, key)`.

## 13.7 Outbox Events

| Field | Mô tả |
|---|---|
| `eventId` | ID duy nhất |
| `eventType` | Loại event |
| `aggregateType` | Booking/Trip/Payment/... |
| `aggregateId` | ID aggregate |
| `payload` | Event payload |
| `status` | PENDING / PUBLISHED |
| `createdAt` | Thời gian tạo |

Outbox dùng để bảo đảm event được phát sau khi transaction nghiệp vụ commit và có thể recovery khi Kafka tạm thời không khả dụng.

## 13.8 Booking / Trip / Payment fields tối thiểu

### Booking

- `id`
- `customerId`
- `pickupAddress`, `pickupLat`, `pickupLng`
- `destinationAddress`, `destinationLat`, `destinationLng`
- `vehicleType`
- `note` (tùy chọn)
- `status`
- `attemptCount`
- `currentDriverId` (nullable), `tripId` (nullable)
- `cancelReason` (khi `CANCELED`)
- `createdAt`, `updatedAt`

### Offer

- `id`
- `bookingId`
- `driverId`
- `attemptNo`
- `status`
- `expiresAt`, `respondedAt`
- `createdAt`

### Trip

- `id`
- `bookingId` (unique)
- `customerId`
- `driverId`, `vehicleId`, `driverSnapshot` (tên, xe, biển số, rating tại thời điểm gán)
- `status`
- `fare`, `distanceKm`
- `paymentStatus` (`UNPAID`, `PAID`)
- `assignedAt`, `arrivedAt`, `startedAt`, `completedAt`, `canceledAt`, `cancelReason`
- `createdAt`, `updatedAt`

### Payment

- `id`
- `tripId`
- `customerId`
- `amount` (bằng `Trip.fare`), `currency` (`VND`)
- `method` (`ONLINE`), `paymentMethodId` (tùy chọn)
- `status`, `failureCode` (khi `FAILED`)
- `providerTransactionId` (unique khi có)
- `createdAt`, `updatedAt`

### Review

- `id`
- `tripId` (unique)
- `customerId`, `driverId`
- `stars` (1–5), `comment` (≤ 500 ký tự)
- `createdAt`

# 14. Deployment Components

Môi trường Compose tối thiểu gồm:

| Component | Vai trò | Publish port ra host |
|---|---|:-:|
| `gateway` | API Gateway, entry point duy nhất của client | ✓ |
| `identity-service` | Account, authentication, RBAC | ✗ |
| `customer-service` | Customer profile, phương thức thanh toán | ✗ |
| `driver-service` | Driver profile, Vehicle, location, availability, OTP | ✗ |
| `booking-service` | Booking, Dispatch, Offer | ✗ |
| `trip-service` | Trip, Fare, tracking, Review | ✗ |
| `payment-service` | Payment, callback | ✗ |
| `notification-service` | Notification + Kafka consumer/producer | ✗ |
| `kafka` | Event streaming | ✗ |
| `redis` | OTP, rate limit, GEO/reservation, realtime data | ✗ |
| `identity-db`, `customer-db`, `driver-db`, `booking-db`, `trip-db`, `payment-db` | PostgreSQL, mỗi service một instance | ✗ |
| `notification-db` | MongoDB | ✗ |
| `mock-payment-provider` | Payment Provider cho môi trường test | ✗ |
| `mock-map-provider` | Map Provider cho môi trường test | ✗ |

Bảy service nghiệp vụ trên là **toàn bộ ranh giới vật lý P1** (chi tiết ở [mục 15](#15-microservice-ownership)). `backoffice-service` (Employee Operations, Incident, Reporting, Audit) thuộc giai đoạn P2, **không** có trong Compose tối thiểu P1 và không nằm trong ranh giới 7 service.

Các service nghiệp vụ không publish port ra host; client chỉ truy cập Gateway. Database được sở hữu theo service, không dùng shared domain database làm source of truth.

## 14.1 Service Call Graph

| Caller | Callee | Cơ chế |
|---|---|---|
| Gateway | mọi service | REST (forward JWT + service credential) |
| identity-service | customer-service | Internal REST |
| driver-service | identity-service | Internal REST |
| booking-service | driver-service | Internal REST |
| booking-service | trip-service | Internal REST |
| trip-service | driver-service | Internal REST |
| payment-service | trip-service | Internal REST |
| payment-service | customer-service | Internal REST (khi có `paymentMethodId`) |
| booking-service, trip-service | Map Provider adapter | REST |
| payment-service | Payment Provider adapter | REST + callback |
| Domain services | Kafka | Publish event (outbox) |
| Domain services, notification-service | Kafka | Subscribe |

Internal REST dùng prefix `/internal`, phải có service credential và chỉ khả dụng trong service network. Đồ thị gọi **không có vòng**.

## 14.2 Phạm vi triển khai

| Giai đoạn | Nội dung |
|---|---|
| **P1** (30 tiêu chí) | Gateway, Identity, Customer (profile), Driver, Booking, Trip (gồm Review), Payment, Notification, Kafka, Redis, mock provider, Compose, seed, Postman, test |
| **P2** | Employee Operations, Incident, Board dashboard/report, xem Audit, quản lý account/role (FR-A04–FR-A06), refresh/logout, CRUD `payment_methods`, `customer_activity`, `backoffice-service` |

# 15. Microservice Ownership

## 15.1 Ranh giới vật lý P1: đúng 7 service

| Service | Bounded Context | Trách nhiệm |
|---|---|---|
| `identity-service` | Identity | Account, authentication, RBAC |
| `customer-service` | Customer | Customer profile, phương thức thanh toán |
| `driver-service` | Driver / Fleet | Driver profile, Vehicle, availability, driver location, OTP, reservation |
| `booking-service` | Booking + Dispatch/Assignment | Booking, Dispatch, Offer, Assignment (nhận chuyến) |
| `trip-service` | Trip Operations + Fare + Feedback | Trip, tracking, Fare, Review |
| `payment-service` | Billing / Payment | Payment, callback Payment Provider |
| `notification-service` | Notification | Notification DB, Kafka consumer/producer, delivery |

`backoffice-service` (Operations, Incident, Reporting, Dashboard, Audit) là **P2**, nằm ngoài ranh giới P1 ở bảng trên. Tài liệu kiểm tra (audit) không được coi sự vắng mặt của service này là lỗi ở P1.

## 15.2 Quy tắc sở hữu giữa các service

1. **Dispatch/Assignment thuộc `booking-service`.** Khi Driver chấp nhận Offer, `booking-service` hoàn tất Assignment rồi gọi `trip-service` tạo Trip qua Internal REST.
2. **Fare thuộc `trip-service`.** `trip-service` tính và khóa Fare khi tạo Trip; `payment-service` chỉ đọc `Trip.fare`, không tính Fare.
3. **Review thuộc `trip-service`.**
4. **`payment-service` chỉ tạo Payment sau khi Trip `COMPLETED`** và `amount = Trip.fare`; client không gửi `amount`.
5. **Một service không ghi vào dữ liệu của service khác**; chỉ gọi Internal REST hoặc phát event để chủ sở hữu tự đổi trạng thái.

```text
booking-service  (Booking, Dispatch, Offer, Assignment)
      │  Driver accept → Internal REST: tạo Trip
      ▼
trip-service     (Trip, Tracking, Fare)
      │  Trip COMPLETED, Trip.fare
      ▼
payment-service  (Payment)   ← đọc Trip.fare, không tính Fare
```

External systems:

```text
Payment Provider
      ↓ callback
payment-service

Map Provider
      ↕
booking-service / trip-service

Kafka
      ↕
domain services / notification-service / backoffice-service
```

---

# 16. Non-functional Requirements

| Mã | Yêu cầu |
|---|---|
| NFR-01 | Hệ thống sử dụng JWT và RBAC cho authenticated API. |
| NFR-02 | Internal service sử dụng REST cho synchronous call và Kafka cho event-driven communication. |
| NFR-03 | Kafka consumer có idempotency theo `eventId`. |
| NFR-04 | Kafka producer/consumer có retry policy phù hợp và không silently drop event. |
| NFR-05 | Notification Service có DLQ. |
| NFR-06 | Map Provider có timeout/circuit-breaker hoặc cơ chế bảo vệ tương đương. |
| NFR-07 | Map API key không xuất hiện ở client, response hoặc log không cần thiết. |
| NFR-08 | Dashboard/reporting không được làm ảnh hưởng đáng kể đến OLTP; có thể dùng aggregate/read model. |
| NFR-09 | Audit có correlation/request ID để trace xuyên Gateway → Service → Kafka. |
| NFR-10 | Employee và Board API bắt buộc JWT + RBAC + scope/ownership phù hợp. |
| NFR-11 | API phải có input validation và output sanitization cần thiết. |
| NFR-12 | System services có `/health` và `/ready`. |
| NFR-13 | Rate limit counter sử dụng Redis với TTL theo từng policy. |
| NFR-14 | Idempotency records có TTL mặc định 24 giờ. |
| NFR-15 | API thông thường trong môi trường demo hướng tới p95 ≤ 500 ms, ngoại trừ thao tác phụ thuộc external provider và report aggregate. Đây là mục tiêu kỹ thuật, không phải cam kết SLA production. |
| NFR-16 | Chỉ Gateway publish port ra host; internal service chỉ giao tiếp trong Docker network. |
| NFR-17 | Key rotation phải được hỗ trợ: key mới dùng cho ghi mới; dữ liệu cũ có thể đọc bằng key cũ trong giai đoạn chuyển đổi. |

# 16.0 Health/Ready Contract

`GET /health` trả `200` khi process đang chạy:

```json
{ "status": "UP", "service": "trip-service" }
```

`GET /ready` trả `200` khi service và dependency bắt buộc đã sẵn sàng; trả `503` nếu dependency chưa sẵn sàng:

```json
{
  "status": "READY",
  "service": "trip-service",
  "dependencies": { "database": "UP", "kafka": "UP" }
}
```

`GET /health/services` tại Gateway trả danh sách service, trạng thái và latency kiểm tra.

# 16.1 Cấu hình kiểm thử chuẩn

| Tham số | Giá trị mặc định |
|---|---|
| `NEARBY_RADIUS_M` | `1000` |
| `PAGE_LIMIT_DEFAULT` | `10` |
| `PAGE_LIMIT_MAX` | `50` |
| `OFFER_TTL_SEC` | `30` |
| `OFFER_MAX_ATTEMPTS` | `5` |
| `OTP_LENGTH` | `6` |
| `OTP_TTL_SEC` | `300` |
| `OTP_MAX_ATTEMPTS` | `5` |
| `OTP_LOCK_SEC` | `900` |
| `REGISTRATION_TOKEN_TTL_MIN` | `15` |
| `JWT_ALG` | `HS256` |
| `JWT_TTL_MIN` | `15` |
| `RATE_LIMIT_GENERAL` | `100 req/phút/IP` |
| `RATE_LIMIT_BOOKING` | `10 req/phút/user` |
| `RATE_LIMIT_LOGIN` | `10 req/phút/IP` |
| `IDEMPOTENCY_TTL_H` | `24` |
| `PAYMENT_PENDING_TIMEOUT_MIN` | `15` |
| `MOCK_CALLBACK_DELAY_MS` | `2000` |
| `RESERVATION_TTL_SEC` | `35` |
| `LOCATION_STALE_SEC` | `0` (tắt; production có thể đặt 60) |
| `ARRIVAL_CONFIRM_RADIUS_M` | `0` (tắt kiểm tra bán kính khi xác nhận đến điểm) |
| `INTERNAL_JWT_TTL_SEC` | `60` |

Các giá trị là mặc định cho môi trường test; có thể cấu hình qua environment nhưng không được làm thay đổi semantics của 30 tiêu chí.

# 16.2 Endpoint chuẩn qua Gateway

| PC | Endpoint |
|---|---|
| 6 | `GET /health`, `GET /ready`, `GET /health/services` |
| 9–10 | `POST /auth/register`, `POST /auth/login` |
| 11 | `GET /customers/{id}` |
| 12 | `GET /drivers/{id}` |
| 13 | `GET /drivers/nearby`, `PUT /drivers/me/location` |
| 14–15 | `GET /bookings`, `POST /bookings`, `POST /bookings/{id}/cancel` |
| 16 | `GET /offers`, `POST /offers/{id}/accept`, `POST /offers/{id}/reject` |
| 17–18 | `GET /trips/{id}`, `PATCH /trips/{id}/status`, `POST /trips/{id}/cancel` |
| 19 | `POST /payments`, `POST /payments/callback`, `GET /payments/{id}` |
| 20 | `POST /trips/{id}/reviews` |
| 21 | `POST /drivers/otp/request`, `POST /drivers/otp/verify`, `POST /drivers/register` |
| 22 | `GET /drivers?status=PENDING_APPROVAL`, `GET /drivers/{id}/application`, `POST /drivers/{id}/approve`, `POST /drivers/{id}/reject` |
| 23 | `PUT /drivers/me/availability` |
| bổ sung | `GET /trips/{id}/location`, `GET /notifications`, `PATCH /notifications/{id}/read` |

### 16.2.1 Quy tắc endpoint quan trọng

- `GET /drivers/nearby`: hỗ trợ `lat`, `lng`, `radius`, `status`, `vehicleType`, `page`, `limit`; `radius` mặc định `1000m`; `status` nhận `ONLINE`/`OFFLINE`/`BUSY`, **mặc định `ONLINE`**; `limit` tối đa `50`. Mỗi phần tử trả `id`, `fullName`, `status`, `vehicleType`, `lat`, `lng`, `distanceM`, sắp xếp theo `distanceM` tăng dần; response theo FR-S16. Chỉ Driver đã được duyệt mới xuất hiện.
- `PUT /drivers/me/location`: body `lat`, `lng`; ngoài miền hợp lệ trả `400`; vị trí gần nhất được dùng khi kiểm tra điều kiện `ONLINE` và khi tìm Driver.
- `GET /bookings`: chỉ trả Booking thuộc Customer đang đăng nhập nếu actor là Customer.
- `POST /bookings`: bắt buộc `Idempotency-Key`.
- `POST /payments`: body `tripId`, `method` (`ONLINE`), `paymentMethodId` (tùy chọn); bắt buộc `Idempotency-Key`; chỉ chấp nhận Trip `COMPLETED` thuộc Customer đang đăng nhập; trả `201` với Payment `PENDING` và `providerTransactionId`.
- `GET /trips/{id}/location`: Customer của Trip (hoặc Driver được gán, Employee có quyền) xem vị trí gần nhất của Driver trong Trip `ASSIGNED`/`ARRIVED`/`IN_PROGRESS`.
- `PATCH /trips/{id}/status`: chỉ Driver được phân công mới được gọi.
- `POST /trips/{id}/cancel`: body `reason` bắt buộc; chỉ cho `ASSIGNED`/`ARRIVED`; `IN_PROGRESS` trả `409`.
- `POST /bookings/{id}/cancel`: body `reason`; chỉ cho Booking `SEARCHING`; Booking đã `ASSIGNED` trả `409` và Customer hủy qua `POST /trips/{id}/cancel`.
- `POST /auth/login`: body `password` và `email` **hoặc** `phone` (xem 6.9.2).
- `POST /payments/callback`: xác thực HMAC; callback sai chữ ký trả `401`.

# 16.3 Ma trận quyền tối thiểu

| Route | Customer | Driver | Employee | Admin | Board |
|---|:-:|:-:|:-:|:-:|:-:|
| `GET /customers/{id}` | own | ✗ | ✓ | ✓ | ✗ |
| `GET /drivers/{id}` | own-in-trip | own | ✓ | ✓ | ✗ |
| `POST /bookings` | ✓ | ✗ | ✗ | ✗ | ✗ |
| `POST /offers/{id}/accept` | ✗ | own | ✗ | ✗ | ✗ |
| `PATCH /trips/{id}/status` | ✗ | own | ✗ | ✗ | ✗ |
| `GET /drivers` | ✗ | ✗ | ✗ | ✓ | ✗ |
| `GET /drivers/{id}/application` | ✗ | ✗ | ✗ | ✓ | ✗ |
| `POST /drivers/{id}/approve` | ✗ | ✗ | ✗ | ✓ | ✗ |
| `POST /drivers/{id}/reject` | ✗ | ✗ | ✗ | ✓ | ✗ |
| `GET /reports/*` | ✗ | ✗ | ✗ | ✗ | ✓ |

Employee phải được kiểm tra thêm bằng permission cụ thể; `OPERATIONS_STAFF` không mặc nhiên có quyền Finance/Admin.

# 16.4 Key Management

- Giá trị mã hóa lưu theo dạng `enc:v1:<keyId>:<iv>:<tag>:<ciphertext>` (AES-256-GCM, mỗi lần mã hóa một IV ngẫu nhiên 12 byte).
- Các cột bắt buộc mã hóa: `phone`, `nationalId`, `licenseNumber`, token phương thức thanh toán. Các cột tra cứu dùng `*_hash` = HMAC-SHA256 với `PHONE_HASH_PEPPER`/`HASH_PEPPER` riêng, không dùng cùng khóa với mã hóa.
- Encryption key và HMAC key phải được cấp từ Docker secret/secret manager/environment secure, không nằm trong repository/image.
- Khi rotate key, key mới dùng cho dữ liệu ghi mới; key cũ vẫn được đọc trong giai đoạn chuyển đổi; có job re-encrypt dữ liệu cũ.
- Bằng chứng PC24: truy vấn DB không thấy plaintext ở các cột nhạy cảm; password ở dạng bcrypt; PII encrypted có keyId.

# 16.5 Test seed tối thiểu

Để test 30 tiêu chí, môi trường test phải có tối thiểu (seed chạy khi `SEED_ON_START=true`, ID cố định để các service khớp nhau, mật khẩu seed lấy từ `SEED_PASSWORD` trong `.env`):

- 1 Customer active (email + phone).
- Quanh điểm tham chiếu `10.7769, 106.7009` (Bến Thành), 1 Driver được duyệt `OFFLINE` và các Driver sau:

| Driver | Trạng thái | Khoảng cách | Ghi chú |
|---|---|---|---|
| D1 | `OFFLINE` | ~300 m | đã duyệt |
| D2 | `ONLINE` | ~200 m | `SEDAN` |
| D3 | `ONLINE` | ~450 m | `BIKE` |
| D4 | `ONLINE` | ~800 m | `SEDAN` |
| D5 | `BUSY` | ~600 m | |
| D6 | `ONLINE` | ~2500 m | ngoài bán kính 1 km |
| D7 | `PENDING_APPROVAL` | — | dùng cho PC22 |

- 1 Admin account.
- Ít nhất 1 Employee cho mỗi role (`OPERATIONS_STAFF`, `USER_STAFF`, `FINANCE_STAFF`, `SUPERVISOR`).
- 1 Board account.
- Ít nhất 5 Booking của một Customer (các trạng thái khác nhau) để kiểm tra paging.
- Fare table: `BIKE` base 10 000 + 4 000/km; `SEDAN` 20 000 + 9 000/km; `SUV` 30 000 + 12 000/km (VND).
- Payment Provider và Map Provider có mock/sandbox cho môi trường test.

# 17. Requirement Traceability theo tiêu chí kiểm tra

| PC# | Nội dung kiểm tra | UC/FR chính |
|---:|---|---|
| 1 | Project structure / API / Postman / docs | FR-S14 |
| 2 | Không commit secret / file rác | FR-S05 |
| 3 | Gateway routing, auth, RBAC, rate limit | UC16, FR-S02–FR-S03 |
| 4 | Internal REST | FR-S06, FR-S17 |
| 5 | Docker Compose | UC17, FR-S04 |
| 6 | Health/Ready | UC18, FR-S01, FR-S18 |
| 7 | Message broker | UC19, FR-S06, FR-K01–FR-K04 |
| 8 | Gateway security / không bypass internal service | UC16, FR-S02–FR-S03, FR-S15, FR-S17 |
| 9 | Customer registration | UC01, FR-C01 |
| 10 | Login/JWT | UC02, FR-C02 |
| 11 | Customer profile | UC03, FR-C03 |
| 12 | Driver profile | UC04, FR-D04 |
| 13 | Driver nearby / location | UC05, FR-C04, FR-D06, FR-S16 |
| 14 | Customer Booking list | UC06, FR-C05, FR-S16 |
| 15 | Booking / matching | UC07, FR-C06–FR-C07 |
| 16 | Offer / accept | UC08, FR-D07–FR-D08 |
| 17 | Trip lifecycle | UC09, FR-C08, FR-D09 |
| 18 | Trip cancellation | UC10, FR-C09, FR-D10 |
| 19 | Payment / callback | UC11, FR-C10, FR-P01–FR-P05 |
| 20 | Review | UC12, FR-C11 |
| 21 | Driver OTP / onboarding | UC13, FR-D01–FR-D03 |
| 22 | Driver approval | UC14, FR-A01–FR-A03 |
| 23 | Driver availability | UC15, FR-D05 |
| 24 | Bảo vệ dữ liệu nhạy cảm khi lưu trữ | UC20, FR-S07 |
| 25 | Chống SQL/NoSQL Injection | UC20, FR-S08 |
| 26 | Chống XSS/input injection | UC20, FR-S09 |
| 27 | JWT tampering/invalid token | UC20, FR-S10 |
| 28 | Unauthorized resource access | UC20, FR-S11 |
| 29 | Rate limit | UC16, UC20, FR-S03, FR-S12 |
| 30 | Replay/idempotency | UC20, FR-S13, FR-S17, FR-P04 |

**Lưu ý:** PC1, PC2 và PC4 là các tiêu chí kiểm tra nền tảng/tổ chức hoặc communication pattern nên trace trực tiếp tới FR là đủ, không cần tạo UC riêng. Employee, Board, Map Provider và các nghiệp vụ quản trị/hỗ trợ khác cũng không tạo UC chỉ để có mã; chúng vẫn được ràng buộc bởi FR/BR/workflow và kiến trúc tương ứng.

# 18. Quy tắc tổng quát về quyền và dữ liệu

1. Mọi API authenticated đều phải xác thực JWT trước khi xử lý nghiệp vụ.
2. Authorization phải được kiểm tra tại service sở hữu resource, không chỉ ở Gateway.
3. Customer chỉ truy cập dữ liệu thuộc mình trừ quyền đặc biệt được định nghĩa.
4. Driver chỉ truy cập dữ liệu Driver/Trip/Offer thuộc phạm vi của mình.
5. Employee chỉ thực hiện nghiệp vụ theo role và permission.
6. Board chỉ truy cập aggregate/report ở chế độ read-only.
7. Administrator quản lý RBAC nhưng không được bỏ qua business state machine khi thao tác vào domain resource.
8. Mọi thay đổi trạng thái quan trọng phải qua state transition hợp lệ.
9. Dữ liệu nhạy cảm phải được bảo vệ khi lưu trữ và secret phải được quản lý ngoài source code.
10. Payment success chỉ được xác định bởi server sau khi xác thực kết quả từ Payment Provider.
11. Kafka event phải có idempotency và khả năng retry/recovery.
12. External Provider không được trở thành source of truth cho ownership hoặc business state của CAB System.
13. Thao tác nhạy cảm phải truy vết được bằng Audit Log và request/correlation ID.

# 19. Lịch sử thay đổi

## v1.3.1 (01/10/2026)

Đồng bộ tài liệu với ranh giới vật lý 7 service. **Không** thay đổi FR, UC, BR, NFR hay phiếu chấm.

| Nội dung | Thay đổi |
|---|---|
| Kiến trúc (15) | Thêm 15.1 (bảng 7 service kèm Bounded Context) và 15.2 (quy tắc sở hữu: Dispatch/Assignment ở `booking-service`, Fare và Review ở `trip-service`, `payment-service` không tính Fare). |
| Deployment (14) | Bỏ `backoffice-service` khỏi bảng Compose tối thiểu; ghi rõ là P2, ngoài ranh giới 7 service. |
| Kafka (12.1) | Đánh dấu **(P2)** các consumer/producer thuộc `backoffice-service`. |
| Workflow (6.5, 6.7, 12.3) | Dùng đúng tên `notification-service`, `payment-service` trong sơ đồ. |

## v1.3 (01/10/2026)

| Nội dung | Thay đổi |
|---|---|
| Kiến trúc | Chốt kiến trúc 7 service (identity, customer, driver, booking, trip, payment, notification) để khớp sơ đồ kiến trúc; Review thuộc `trip-service`. `backoffice-service` thuộc giai đoạn P2. |
| Deployment | Mỗi service một database riêng (6 PostgreSQL + 1 MongoDB); bổ sung `mocks/`, cột "publish port" và phạm vi P1/P2 (14.2). |
| Phạm vi | Làm rõ **không** có hoa hồng, payout cho Driver, hold và refund (5.2, BR-F05). |
| Thanh toán | Làm rõ vòng đời Payment (6.7), hợp đồng Provider và callback (FR-P03–FR-P05), timeout `PENDING`, ràng buộc một Payment hiệu lực cho mỗi Trip (BR-F06, BR-F07). |
| Account | Login bằng `email` hoặc `phone`; Driver đăng ký chỉ cần `phone`, có `password` (6.9.2, 6.9.4). |
| Dispatch | Bổ sung quy tắc Offer, accept idempotent, recovery và hủy Offer khi Driver offline (7.4 mục 8–11). |
| Kafka | Bổ sung `identity.events`, `driver.location`, consumer của từng service, thêm `eventVersion`/`aggregateType`/`aggregateId`/`requestId` vào envelope (12). |
| Non-functional | FR-S16 (paging), FR-S17 (Idempotency-Key/service credential), FR-S18 (health); key mã hóa có `keyId` và tách pepper (16.4); cấu hình mới (16.1). |
| API | `GET /trips/{id}/location`, `GET/PATCH /notifications`; làm rõ `nearby`, `payments`, `cancel`, `login` (16.2). |
| Seed | Seed cụ thể: Driver D1–D7 theo khoảng cách/trạng thái, bảng giá mặc định (16.5). |
