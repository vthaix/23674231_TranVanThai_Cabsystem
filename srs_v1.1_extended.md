# SOFTWARE REQUIREMENTS SPECIFICATION
# CAB SYSTEM — SRS mở rộng

> Phiên bản: 1.1 — mở rộng từ SRS rút gọn bám `phieucham.md`.
>
> Mục tiêu của bản này là **giữ nguyên toàn bộ luồng 30 tiêu chí chấm hiện tại**, đồng thời bổ sung lại các nghiệp vụ vận hành/quản trị/báo cáo và các external system cần thiết cho một CAB System hoàn chỉnh.
>
> Các FR/UC không gắn `PC#` là yêu cầu mở rộng của hệ thống, không thay đổi tiêu chí chấm.

---

## 1. Mục tiêu

CAB System là hệ thống đặt xe gồm API Gateway, các microservice nghiệp vụ và các hệ thống bên ngoài.

Luồng lõi vẫn là:

```text
Customer đăng ký / đăng nhập
        ↓
Customer đặt xe
        ↓
Hệ thống tìm Driver phù hợp
        ↓
Offer → Driver nhận chuyến
        ↓
Trip: ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED / CANCELED
        ↓
Payment → Review
```

Luồng mở rộng:

```text
Employee vận hành
    ├── quản lý Customer / Driver / Account
    ├── theo dõi Booking / Offer / Trip
    ├── hỗ trợ phân công / hủy / xử lý sự cố
    ├── tra cứu Payment
    └── xem Audit

Board of Directors
    ├── Dashboard
    ├── KPI vận hành
    ├── Doanh thu
    ├── Chuyến đi
    ├── Tỷ lệ hủy / hoàn thành
    └── Hiệu quả Driver

Map Provider
    ├── Geocoding
    ├── Route distance
    └── ETA

Notification Provider (Kafka)
    ├── Publish event
    ├── Subscribe topic
    └── Fan-out notification tới Customer / Driver / Employee
```

---

# 2. Stakeholders

| Stakeholder | Vai trò | Mối quan tâm |
|---|---|---|
| **Customer** | Đặt xe, theo dõi chuyến, thanh toán, đánh giá | Đặt xe nhanh, đúng tài xế, trạng thái minh bạch |
| **Driver** | Nhận và thực hiện chuyến | Nhận offer đúng, cập nhật trạng thái/vị trí, xem lịch sử |
| **Employee / Operations Staff** | Nhân viên vận hành hệ thống | Quản lý user, driver, booking, trip, payment, sự cố |
| **Administrator** | Quản trị tài khoản, role, permission | Bảo mật và phân quyền |
| **Board of Directors** | Ban giám đốc | Dashboard, KPI, doanh thu, hiệu quả vận hành |
| **Payment Provider** | Cổng thanh toán bên ngoài | Nhận request và callback thanh toán |
| **Notification Provider (Kafka)** | Hệ thống messaging bên ngoài/được triển khai như event backbone | Pub/Sub notification, bảo đảm event delivery |
| **Map Provider** | Dịch vụ bản đồ bên ngoài | Geocoding, khoảng cách tuyến đường, ETA |

---

# 3. Actors

## 3.1 Customer

- Đăng ký, đăng nhập.
- Xem hồ sơ.
- Tìm Driver quanh vị trí.
- Tạo Booking.
- Xem Booking.
- Theo dõi Trip.
- Hủy Trip trong phạm vi cho phép.
- Thanh toán.
- Đánh giá.
- Xem Notification.

## 3.2 Driver

- Đăng ký qua OTP.
- Xem hồ sơ.
- Bật/tắt Online.
- Cập nhật vị trí.
- Xem và nhận Offer.
- Thực hiện Trip.
- Hủy Trip trong phạm vi cho phép.
- Xem Notification.

## 3.3 Employee / Operations Staff

Employee là nhóm actor nghiệp vụ nội bộ. Có thể phân thành các role:

- `OPERATIONS_STAFF`: vận hành Booking/Trip/Driver.
- `USER_STAFF`: quản lý Customer/Driver/Account.
- `FINANCE_STAFF`: tra cứu Payment.
- `SUPERVISOR`: có thêm quyền phân công/reassign và xử lý ngoại lệ.

Quyền chính:

- Tìm kiếm và xem Customer / Driver.
- Xem và cập nhật trạng thái Account theo permission.
- Theo dõi Booking.
- Theo dõi Offer.
- Theo dõi Trip đang hoạt động.
- Hỗ trợ hủy hoặc reassign theo Rule.
- Tra cứu Payment.
- Ghi nhận / xử lý Incident.
- Xem Audit Log trong phạm vi được cấp quyền.

## 3.4 Administrator

- Quản lý Account.
- Khóa/mở khóa Account.
- Quản lý Role/Permission.
- Gán Role.
- Kiểm soát quyền truy cập.

## 3.5 Board of Directors

- Xem Dashboard điều hành.
- Xem KPI theo ngày/tháng/quý.
- Xem số Booking/Trip.
- Xem doanh thu.
- Xem tỷ lệ hoàn thành/hủy.
- Xem hiệu quả Driver.
- Lọc dữ liệu theo thời gian và khu vực.

> Board là **read-only** đối với dữ liệu nghiệp vụ; không được trực tiếp thay đổi Booking/Trip/Payment.

## 3.6 Payment Provider

Hệ thống thanh toán bên ngoài gọi callback tới CAB System.

## 3.7 Notification Provider — Kafka

Kafka là hệ thống event streaming cho Notification.

Notification Service publish/consume các topic nghiệp vụ; Customer/Driver/Employee không gọi Kafka trực tiếp.

## 3.8 Map Provider

Hệ thống bên ngoài cung cấp:

- Geocoding / reverse geocoding.
- Route distance.
- ETA.
- Route summary.

---

# 4. Business Goals

| Mã | Business Goal |
|---|---|
| BG01 | Cho phép Customer đăng ký, đăng nhập và quản lý tài khoản |
| BG02 | Cho phép Customer tạo Booking |
| BG03 | Tự động tìm và phân công Driver phù hợp |
| BG04 | Quản lý toàn bộ vòng đời Trip |
| BG05 | Hỗ trợ thanh toán và đánh giá |
| BG06 | Gửi Notification theo event |
| BG07 | Cho phép Employee quản lý vận hành Customer, Driver, Booking và Trip |
| BG08 | Cho phép Employee tra cứu Payment và xử lý sự cố |
| BG09 | Cho phép Administrator quản lý RBAC |
| BG10 | Cung cấp Dashboard/KPI cho Board of Directors |
| BG11 | Tích hợp Map Provider để chuẩn hóa vị trí, khoảng cách và ETA |
| BG12 | Sử dụng Kafka cho Pub/Sub Notification và event-driven integration |
| BG13 | Ghi nhận Audit đối với các thao tác quản trị/vận hành nhạy cảm |

---

# 5. Scope

## 5.1 In Scope — Core

- Account, Authentication, RBAC.
- Customer / Driver profile.
- Driver onboarding và approval.
- Driver availability.
- Driver location.
- Booking / Offer / Trip.
- Payment online.
- Review.
- Notification.
- Map integration.
- Employee Operation.
- Dashboard / Reporting.
- Audit.
- Kafka Pub/Sub Notification.

## 5.2 Out of Scope

- Quản lý lương Driver.
- Kế toán doanh nghiệp đầy đủ.
- Quản lý kho/nhiên liệu.
- Bảo dưỡng Vehicle chi tiết.
- Dynamic pricing phức tạp.
- Loyalty / Membership / Subscription.
- Machine Learning dự đoán nhu cầu.
- GPS history chi tiết của toàn bộ hành trình nếu không phục vụ vận hành.

---

# 6. Business Workflow

## 6.1 Customer đặt xe

1. Customer tạo Booking.
2. Booking Service lưu trạng thái `SEARCHING`.
3. Hệ thống tìm Driver `ONLINE`, `APPROVED`, đúng `vehicleType`.
4. Hệ thống có thể gọi Map Provider để lấy distance/ETA.
5. Chọn Driver phù hợp.
6. Tạo Offer.
7. Driver accept.
8. Trip được tạo `ASSIGNED`.
9. Notification event được publish lên Kafka.
10. Customer nhận thông tin Driver.

## 6.2 Thực hiện Trip

`ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED`

hoặc:

`ASSIGNED / ARRIVED → CANCELED`

Driver cập nhật vị trí hiện tại. Map Provider có thể cung cấp ETA/distance cho màn hình theo dõi.

## 6.3 Employee vận hành

```text
Employee login
     ↓
Xem Dashboard vận hành
     ↓
Tìm Customer / Driver / Booking / Trip
     ↓
Theo dõi trạng thái
     ↓
Hỗ trợ xử lý:
   ├── hủy theo quyền
   ├── reassign Driver
   ├── xử lý Incident
   └── tra cứu Payment
     ↓
Ghi Audit Log
```

## 6.4 Board xem báo cáo

```text
Board login
   ↓
Dashboard
   ├── Booking
   ├── Trip
   ├── Completion Rate
   ├── Cancellation Rate
   ├── Revenue
   └── Driver Performance
```

## 6.5 Notification qua Kafka

```text
Domain Service
      ↓
Kafka Topic
      ↓
Notification Service
      ↓
notifications DB
      ↓
Customer / Driver / Employee
```

Các event mẫu:

- `booking.created`
- `booking.no_driver_found`
- `offer.created`
- `trip.assigned`
- `trip.canceled`
- `trip.completed`
- `payment.completed`
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
Ride / People-Fleet Service
      ↓
Map Provider
      ↓
routeDistance / eta / geocodedAddress
```

---

# 7. State Machine

| Đối tượng | Trạng thái chính |
|---|---|
| Driver | `PENDING_APPROVAL`, `REJECTED`, `OFFLINE`, `ONLINE`, `BUSY` |
| Booking | `SEARCHING`, `ASSIGNED`, `NO_DRIVER_FOUND`, `COMPLETED`, `CANCELED` |
| Offer | `PENDING`, `ACCEPTED` |
| Trip | `ASSIGNED`, `ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELED` |
| Payment | `PENDING`, `COMPLETED`, `FAILED` |
| Incident | `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED` |

---

# 8. Functional Requirements

## 8.1 Core FR hiện hữu

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-01 | Monorepo có gateway/services/db/postman/docs | 1 |
| FR-02 | Không commit `.env`, secret, node_modules | 2 |
| FR-03 | Gateway routing, JWT, RBAC, rate limit, sanitize | 3, 8 |
| FR-04 | REST nội bộ; asynchronous event qua messaging | 4, 7 |
| FR-05 | Docker Compose chạy toàn bộ hệ thống | 5 |
| FR-06 | Health/ready/health-services | 6 |
| FR-10 | Customer registration | 9 |
| FR-11 | Login và JWT | 10 |
| FR-13 | Customer xem hồ sơ | 11 |
| FR-14 | Driver xem hồ sơ | 12 |
| FR-19 | Driver cập nhật vị trí | 13 |
| FR-20 | Tìm Driver quanh tọa độ | 13 |
| FR-21 | Tạo Booking | 15 |
| FR-22 | Driver matching | 15 |
| FR-25 | Driver xem Offer | 16 |
| FR-26 | Driver nhận Offer | 16 |
| FR-30 | Trip state transition | 17 |
| FR-31 | Trip location | 17 |
| FR-33 | Hủy Trip | 18 |
| FR-34 | Tạo Payment | 19 |
| FR-35 | Payment callback | 19 |
| FR-36 | Review | 20 |
| FR-37 | Notification listing | 15,16,18,22 |

## 8.2 Employee / Operations

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-50 | Employee có thể tìm kiếm Customer theo id/name/phone/email, theo permission | — |
| FR-51 | Employee có thể tìm kiếm Driver theo id/name/status/vehicleType/khu vực | — |
| FR-52 | Employee xem chi tiết Booking, filter theo status/time/customer/driver | — |
| FR-53 | Employee theo dõi Trip đang hoạt động, gồm trạng thái, Driver và vị trí hiện tại | — |
| FR-54 | Employee được hủy Booking/Trip theo quyền và state transition hợp lệ; bắt buộc reason | — |
| FR-55 | Supervisor được reassign Driver cho Booking/Trip khi Booking/Trip còn ở trạng thái được phép; thao tác tạo Audit Log | — |
| FR-56 | Employee tra cứu Payment theo trip/customer/status/provider transaction id | — |
| FR-57 | Employee tạo, xem, cập nhật và đóng Incident | — |
| FR-58 | Employee xem lịch sử thao tác liên quan Booking/Trip/Driver trong phạm vi permission | — |
| FR-59 | Administrator quản lý Account status và RBAC | — |

## 8.3 Board of Directors / Reporting

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-60 | Board xem Dashboard tổng quan Booking, Trip, Driver, Payment | — |
| FR-61 | Board xem tổng số Trip, Trip completed/canceled và completion/cancellation rate | — |
| FR-62 | Board xem doanh thu theo ngày/tháng/quý | — |
| FR-63 | Board xem hiệu quả Driver theo số chuyến, completion rate và cancellation rate | — |
| FR-64 | Board lọc báo cáo theo khoảng thời gian và khu vực | — |
| FR-65 | Board chỉ có quyền đọc; không được mutate Booking/Trip/Payment | — |

## 8.4 Map Provider

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-66 | Hệ thống gọi Map Provider để chuẩn hóa địa chỉ/geocoding khi cần | — |
| FR-67 | Hệ thống lấy route distance và ETA từ Map Provider cho Trip/ước lượng | — |
| FR-68 | Map Provider timeout/error không làm lộ lỗi nội bộ; service trả lỗi chuẩn hóa và dùng fallback được định nghĩa | — |
| FR-69 | Không gửi secret/API key của Map Provider ra client | — |

## 8.5 Notification Provider — Kafka

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-70 | Notification Service publish/consume event qua Kafka | — |
| FR-71 | Notification Service subscribe các topic nghiệp vụ và tạo notification tương ứng recipient | — |
| FR-72 | Consumer Kafka phải idempotent; event trùng không tạo duplicate notification | — |
| FR-73 | Notification có `eventId`, `type`, `recipientId`, `createdAt`, `payload` | — |
| FR-74 | Hệ thống lưu notification vào DB để Customer/Driver/Employee có thể xem lại | — |
| FR-75 | Kafka outage không làm mất transaction nghiệp vụ chính; event phải có cơ chế retry/DLQ phù hợp | — |

## 8.6 Audit

| FR | Yêu cầu | PC# |
|---|---|:-:|
| FR-80 | Các thao tác quản trị/vận hành nhạy cảm tạo Audit Log | — |
| FR-81 | Audit Log chứa actorId, actorRole, action, resourceType, resourceId, timestamp, requestId và metadata tối thiểu | — |
| FR-82 | Audit Log append-only đối với Employee/Board; chỉ Administrator có quyền quản trị cấu hình lưu trữ | — |

---

# 9. Use Cases

| UC | Tên | Actor | FR chính | PC# |
|---|---|---|---|:-:|
| UC01 | Đăng ký Customer | Customer | FR-10 | 9 |
| UC02 | Đăng nhập | Customer, Driver, Admin, Employee, Board | FR-11 | 10 |
| UC03 | Xem hồ sơ Customer | Customer, Employee, Admin | FR-13, FR-50 | 11 |
| UC04 | Xem hồ sơ Driver | Driver, Employee, Admin | FR-14, FR-51 | 12 |
| UC05 | Tìm Driver quanh vị trí | Customer, Employee | FR-20 | 13 |
| UC06 | Xem danh sách Booking của Customer | Customer | FR-24 | 14 |
| UC07 | Đặt xe | Customer | FR-21–24 | 15 |
| UC08 | Xem và nhận Offer | Driver | FR-25, FR-26 | 16 |
| UC09 | Cập nhật trạng thái và vị trí Trip | Driver | FR-30–32 | 17 |
| UC10 | Hủy Trip | Customer, Driver, Employee | FR-33, FR-54 | 18 |
| UC11 | Thanh toán online | Customer | FR-34 | 19 |
| UC12 | Callback thanh toán | Payment Provider | FR-35 | 19 |
| UC13 | Đánh giá Trip | Customer | FR-36 | 20 |
| UC14 | OTP Driver | Driver | FR-15 | 21 |
| UC15 | Gửi hồ sơ Driver | Driver | FR-15 | 21 |
| UC16 | Xem hồ sơ Driver chờ duyệt | Admin | FR-16 | 22 |
| UC17 | Duyệt / từ chối Driver | Admin | FR-17 | 22 |
| UC18 | Bật/tắt nhận chuyến, cập nhật vị trí | Driver | FR-18, FR-19 | 23 |
| UC19 | Xem Notification | Customer, Driver, Employee | FR-37, FR-74 | — |
| UC20 | Health Check | Bất kỳ | FR-06 | 6 |
| UC21 | Kiểm tra Security | Người chấm | FR-40–47 | 24–30 |
| UC22 | Quản lý Customer | Employee | FR-50, FR-59 | — |
| UC23 | Quản lý Driver / Vehicle | Employee | FR-51 | — |
| UC24 | Quản lý Booking | Employee | FR-52, FR-54 | — |
| UC25 | Giám sát Trip đang hoạt động | Employee | FR-53 | — |
| UC26 | Reassign Driver | Supervisor | FR-55 | — |
| UC27 | Tra cứu Payment | Employee | FR-56 | — |
| UC28 | Xử lý Incident | Employee / Supervisor | FR-57, FR-80 | — |
| UC29 | Xem Audit Log | Employee, Administrator | FR-58, FR-80–82 | — |
| UC30 | Xem Dashboard điều hành | Board | FR-60 | — |
| UC31 | Xem KPI vận hành | Board | FR-61, FR-63 | — |
| UC32 | Xem báo cáo doanh thu | Board | FR-62 | — |
| UC33 | Lọc báo cáo theo thời gian/khu vực | Board | FR-64 | — |
| UC34 | Geocoding / Reverse Geocoding | Map Provider | FR-66 | — |
| UC35 | Tính Route Distance / ETA | Map Provider | FR-67 | — |
| UC36 | Publish Notification Event | Domain Service, Kafka | FR-70, FR-73 | — |
| UC37 | Consume Kafka và tạo Notification | Notification Service, Kafka | FR-71–75 | — |

---

# 10. Business Rules

| Mã | Quy tắc |
|---|---|
| BR-01 | Chỉ Customer đã xác thực mới đặt Booking |
| BR-02 | Booking bắt buộc có pickup, destination và vehicleType hợp lệ |
| BR-03 | Chỉ Driver `APPROVED` và `ONLINE` đúng loại xe mới được nhận Offer |
| BR-04 | Driver matching ưu tiên Driver hợp lệ gần nhất theo metric đã cấu hình |
| BR-05 | Một Booking chỉ có một Offer `ACCEPTED` |
| BR-06 | Trip state transition phải hợp lệ, không được tự ý nhảy trạng thái |
| BR-07 | Chỉ Trip `COMPLETED` mới được thanh toán và đánh giá |
| BR-08 | Một Trip chỉ có tối đa một Payment thành công và một Review |
| BR-09 | Số tiền Payment do server xác định, không tin `amount` từ client |
| BR-10 | Hủy Trip phải có reason |
| BR-11 | Người dùng chỉ đọc resource thuộc mình, trừ role có quyền quản trị |
| BR-12 | OTP 6 số, TTL 5 phút, giới hạn số lần nhập sai |
| BR-13 | Service sở hữu resource chịu trách nhiệm kiểm tra ownership đối với resource ID |
| **BR-14** | Employee chỉ thực hiện thao tác theo RBAC permission; `OPERATIONS_STAFF` không được sửa RBAC |
| **BR-15** | USER_STAFF được quản lý Customer/Driver/Account trong phạm vi được cấp; thao tác lock/unlock phải tạo Audit |
| **BR-16** | Employee không được bypass state machine của Booking/Trip; thao tác hủy/reassign phải thỏa điều kiện state |
| **BR-17** | Reassign chỉ thực hiện khi Trip/Booking chưa ở trạng thái terminal; phải ghi actor, lý do và thời điểm |
| **BR-18** | Board of Directors chỉ có quyền đọc các aggregate/report; không được mutate dữ liệu nghiệp vụ |
| **BR-19** | Map Provider không được xem là source of truth cho quyền sở hữu Booking/Trip; dữ liệu nghiệp vụ vẫn do CAB System quyết định |
| **BR-20** | API key/secret của Map Provider chỉ nằm ở server-side secret/config |
| **BR-21** | Khi Map Provider không khả dụng, hệ thống chỉ dùng fallback đã định nghĩa; không tự động coi lỗi map là lỗi thanh toán |
| **BR-22** | Mỗi Kafka event có `eventId` duy nhất; consumer phải idempotent theo `eventId` |
| **BR-23** | Notification event dùng Pub/Sub; publisher không cần biết subscriber cụ thể |
| **BR-24** | Kafka delivery có thể at-least-once; duplicate event phải được xử lý idempotently |
| **BR-25** | Event thất bại nhiều lần phải vào retry/DLQ, không block transaction chính vô hạn |
| **BR-26** | Thao tác quản trị/vận hành nhạy cảm phải có Audit Log |
| **BR-27** | Audit Log phải ghi actorId, role, action, resource và timestamp |
| **BR-28** | Board không được xem dữ liệu cá nhân vượt quá mức cần thiết cho báo cáo; dữ liệu nhạy cảm phải được mask/aggregate |

---

# 11. Non-functional Requirements bổ sung

| NFR | Nội dung |
|---|---|
| NFR-20 | Kafka consumer có idempotency theo `eventId` |
| NFR-21 | Kafka producer dùng `acks`/retry phù hợp môi trường triển khai; không silently drop event |
| NFR-22 | Notification Service có retry và DLQ |
| NFR-23 | Map Provider timeout/circuit breaker để tránh làm nghẽn service nghiệp vụ |
| NFR-24 | API key Map Provider không xuất hiện trong response/log |
| NFR-25 | Dashboard/report query không được làm ảnh hưởng đáng kể tới OLTP; có thể dùng read model/aggregate query của backoffice-service |
| NFR-26 | Audit Log có `X-Request-Id` để trace xuyên Gateway → Service → Kafka |
| NFR-27 | Employee và Board API đều phải kiểm tra JWT + RBAC + ownership/scope phù hợp |

---

# 12. Data Model bổ sung

Ngoài các bảng hiện hữu:

- `accounts`
- `customers`
- `drivers`
- `bookings`
- `offers`
- `trips`
- `reviews`
- `payments`
- `notifications`

bổ sung:

### `incidents`

| Field | Mô tả |
|---|---|
| `id` | Incident ID |
| `type` | Loại sự cố |
| `severity` | Mức độ |
| `status` | OPEN / IN_PROGRESS / RESOLVED / CLOSED |
| `booking_id` | Booking liên quan |
| `trip_id` | Trip liên quan |
| `reported_by` | Actor tạo incident |
| `assigned_to` | Employee xử lý |
| `description` | Mô tả |
| `resolution` | Kết quả xử lý |
| `created_at` | Thời điểm tạo |
| `resolved_at` | Thời điểm xử lý xong |

### `audit_logs`

| Field | Mô tả |
|---|---|
| `id` | Audit ID |
| `actor_id` | Employee/Admin |
| `actor_role` | Role tại thời điểm thao tác |
| `action` | Hành động |
| `resource_type` | Customer/Driver/Booking/Trip/Payment/... |
| `resource_id` | ID resource |
| `request_id` | Trace ID |
| `metadata` | JSON metadata tối thiểu |
| `created_at` | Timestamp |

### Notification event envelope

```json
{
  "eventId": "evt_01J...",
  "eventType": "trip.assigned",
  "occurredAt": "2026-09-30T10:00:00Z",
  "producer": "ride-service",
  "recipientIds": ["user_123"],
  "data": {
    "tripId": "trip_123",
    "driverId": "driver_456"
  }
}
```

---

# 13. Kafka Topics

| Topic | Producer | Consumer |
|---|---|---|
| `booking.events` | booking-service | notification-service, backoffice-service |
| `trip.events` | ride-service | notification-service, backoffice-service |
| `driver.events` | people-fleet-service | notification-service, backoffice-service |
| `payment.events` | billing-feedback-service | notification-service, backoffice-service |
| `incident.events` | backoffice-service | notification-service |
| `notification.commands` | domain services | notification-service |
| `notification.dlq` | notification-service | operator/admin |

---

# 14. Microservice Ownership

| Service | Trách nhiệm |
|---|---|
| `identity-service` | Account, authentication, RBAC |
| `people-fleet-service` | Customer profile, Driver profile, Fleet/Vehicle, driver location |
| `ride-service` | Booking, Dispatch, Offer, Trip, Fare/route coordination |
| `billing-feedback-service` | Payment, Review |
| `notification-service` | Notification DB + Kafka consumer/producer |
| `backoffice-service` | Operations, Incident, Reporting, Dashboard, Audit |

External systems:

```text
Payment Provider  → callback → billing-feedback-service
Map Provider      ← request ← ride / people-fleet / gateway-backed APIs
Kafka             ↔ notification-service + domain event producers
```

---

# 15. Phạm vi đối với `phieucham.md`

- **Không sửa 30 tiêu chí chấm hiện tại.**
- Các UC/FR mới từ `FR-50` trở đi là phần mở rộng của sản phẩm.
- PC#13 vẫn là `Tìm Driver quanh vị trí`, không biến thành quyền riêng của Board/Employee.
- PC#7 tiếp tục kiểm tra message broker; phần Notification mở rộng dùng Kafka Pub/Sub.
- Các tiêu chí 9–30 hiện tại vẫn giữ nguyên flow Customer/Driver/Admin/Payment.

Như vậy SRS có hai lớp:

```text
CORE — phục vụ 30 tiêu chí chấm
        ↓
EXTENDED — vận hành thực tế
        ├── Employee Operations
        ├── Board Reporting
        ├── Map Provider
        ├── Kafka Notification
        └── Incident + Audit
```
