# SOFTWARE REQUIREMENTS SPECIFICATION
# CAB SYSTEM

**Phiên bản:** 1.1

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

Employee có thể thực hiện nghiệp vụ theo permission được cấp.

## 3.4 Administrator

Administrator quản lý:

- Account.
- Role.
- Permission.
- Khóa/mở khóa account.
- Gán role.
- Kiểm soát truy cập.

## 3.5 Board of Directors

Board of Directors sử dụng hệ thống ở chế độ **read-only** để xem:

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
Find eligible Driver
  ↓
Distance / ETA
  ↓
Offer
  ↓
Driver Accept
  ↓
ASSIGNED
  ↓
Trip
  ↓
Payment
  ↓
Review
```

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
Notification Service
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

# 8. Use Cases theo Actor

## 8.1 Customer — Use Cases

| UC | Use Case | FR liên quan | PC# |
|---|---|---|:-:|
| UC01 | Đăng ký Customer | FR-C01 | 9 |
| UC02 | Đăng nhập | FR-C02 | 10 |
| UC03 | Xem hồ sơ Customer | FR-C03 | 11 |
| UC04 | Tìm Driver quanh vị trí | FR-C04 | 13 |
| UC05 | Xem Booking của mình | FR-C05 | 14 |
| UC06 | Đặt xe | FR-C06, FR-C07 | 15 |
| UC07 | Theo dõi Trip | FR-C08 | 17 |
| UC08 | Hủy Trip | FR-C09 | 18 |
| UC09 | Thanh toán online | FR-C10 | 19 |
| UC10 | Đánh giá Trip | FR-C11 | 20 |
| UC11 | Xem Notification | FR-C12 |  |

## 8.2 Driver — Use Cases

| UC | Use Case | FR liên quan | PC# |
|---|---|---|:-:|
| UC12 | Đăng ký và xác thực OTP | FR-D01, FR-D02 | 21 |
| UC13 | Gửi hồ sơ Driver | FR-D03 | 21 |
| UC14 | Xem hồ sơ Driver | FR-D04 | 12 |
| UC15 | Bật/tắt nhận chuyến | FR-D05 | 23 |
| UC16 | Cập nhật vị trí | FR-D06 | 13 |
| UC17 | Xem Offer | FR-D07 | 16 |
| UC18 | Nhận Offer | FR-D08 | 16 |
| UC19 | Cập nhật trạng thái Trip | FR-D09 | 17 |
| UC20 | Hủy Trip | FR-D10 | 18 |
| UC21 | Xem Notification | FR-D11 |  |

## 8.3 Administrator — Use Cases

| UC | Use Case | FR liên quan | PC# |
|---|---|---|:-:|
| UC22 | Xem hồ sơ Driver chờ duyệt | FR-A01 | 22 |
| UC23 | Duyệt Driver | FR-A02 | 22 |
| UC24 | Từ chối Driver | FR-A03 | 22 |
| UC25 | Quản lý Account | FR-A04, FR-A05 |  |
| UC26 | Quản lý Role/Permission | FR-A06 |  |

## 8.4 Employee — Use Cases

| UC | Use Case | FR liên quan |
|---|---|---|
| UC27 | Tìm kiếm Customer | FR-E01 |
| UC28 | Quản lý Customer | FR-E02 |
| UC29 | Tìm kiếm Driver | FR-E03 |
| UC30 | Quản lý Driver/Vehicle | FR-E04 |
| UC31 | Theo dõi Booking | FR-E05 |
| UC32 | Hỗ trợ Booking | FR-E06 |
| UC33 | Theo dõi Offer | FR-E07 |
| UC34 | Giám sát Trip đang hoạt động | FR-E08 |
| UC35 | Hủy Booking/Trip theo quyền | FR-E09 |
| UC36 | Reassign Driver | FR-E10 |
| UC37 | Tra cứu Payment | FR-E11 |
| UC38 | Tạo Incident | FR-E12 |
| UC39 | Xử lý Incident | FR-E13 |
| UC40 | Xem Audit Log | FR-E14 |
| UC41 | Xem Notification | FR-E15 |

## 8.5 Board of Directors — Use Cases

| UC | Use Case | FR liên quan |
|---|---|---|
| UC42 | Xem Dashboard | FR-B01 |
| UC43 | Xem Booking/Trip KPI | FR-B02 |
| UC44 | Xem doanh thu | FR-B03 |
| UC45 | Xem hiệu quả Driver | FR-B04 |
| UC46 | Lọc báo cáo theo thời gian/khu vực | FR-B05 |

## 8.6 Payment Provider — Use Cases

| UC | Use Case | FR liên quan | PC# |
|---|---|---|:-:|
| UC47 | Xử lý thanh toán | FR-P01 | 19 |
| UC48 | Gửi payment callback | FR-P02 | 19 |

## 8.7 Map Provider — Use Cases

| UC | Use Case | FR liên quan |
|---|---|---|
| UC49 | Geocoding | FR-M01 |
| UC50 | Reverse Geocoding | FR-M02 |
| UC51 | Route Distance | FR-M03 |
| UC52 | ETA | FR-M04 |

## 8.8 Kafka / Notification — Use Cases

| UC | Use Case | FR liên quan |
|---|---|---|
| UC53 | Publish Domain Event | FR-K01 |
| UC54 | Subscribe Domain Event | FR-K02 |
| UC55 | Tạo Notification từ Event | FR-K03 |
| UC56 | Retry / DLQ Event | FR-K04 |
| UC57 | Đọc lại Notification | FR-K05 |

## 8.9 Security / System — Use Cases

| UC | Use Case | FR liên quan | PC# |
|---|---|---|:-:|
| UC58 | Health Check / Readiness | FR-S01 | 6 |
| UC59 | Gateway Routing / Auth / RBAC | FR-S02, FR-S03 | 3, 8 |
| UC60 | Docker Compose Deployment | FR-S04 | 5 |
| UC61 | Security Validation | FR-S07–FR-S13 | 24–30 |

---

# 9. Functional Requirements theo Actor

## 9.1 Customer — FR

| Mã | Yêu cầu | PC# |
|---|---|:-:|
| FR-C01 | Customer đăng ký tài khoản bằng thông tin hợp lệ | 9 |
| FR-C02 | Customer đăng nhập và nhận JWT | 10 |
| FR-C03 | Customer lấy thông tin hồ sơ của chính mình bằng token | 11 |
| FR-C04 | Customer tìm Driver quanh tọa độ với radius, filter status và paging | 13 |
| FR-C05 | Customer liệt kê Booking của chính mình, hỗ trợ `page` và `limit`; response có thông tin pagination | 14 |
| FR-C06 | Customer tạo Booking với pickup, destination và vehicleType hợp lệ | 15 |
| FR-C07 | Hệ thống tìm Driver phù hợp và tạo Offer | 15 |
| FR-C08 | Customer theo dõi trạng thái Trip | 17 |
| FR-C09 | Customer hủy Trip khi state cho phép và cung cấp reason | 18 |
| FR-C10 | Customer tạo Payment và theo dõi kết quả | 19 |
| FR-C11 | Customer đánh giá Trip đã hoàn thành | 20 |
| FR-C12 | Customer xem danh sách Notification của mình |  |

## 9.2 Driver — FR

| Mã | Yêu cầu | PC# |
|---|---|:-:|
| FR-D01 | Driver yêu cầu OTP khi đăng ký | 21 |
| FR-D02 | Driver xác thực OTP trước khi gửi hồ sơ | 21 |
| FR-D03 | Driver gửi hồ sơ cá nhân và Vehicle | 21 |
| FR-D04 | Driver xem thông tin hồ sơ của mình | 12 |
| FR-D05 | Driver bật/tắt trạng thái nhận chuyến | 23 |
| FR-D06 | Driver cập nhật vị trí hiện tại | 13 |
| FR-D07 | Driver xem Offer được giao | 16 |
| FR-D08 | Driver accept Offer theo state machine | 16 |
| FR-D09 | Driver cập nhật trạng thái Trip | 17 |
| FR-D10 | Driver hủy Trip khi state cho phép | 18 |
| FR-D11 | Driver xem Notification của mình |  |

## 9.3 Administrator — FR

| Mã | Yêu cầu | PC# |
|---|---|:-:|
| FR-A01 | Administrator xem danh sách hồ sơ Driver chờ duyệt | 22 |
| FR-A02 | Administrator duyệt hồ sơ Driver | 22 |
| FR-A03 | Administrator từ chối hồ sơ Driver và ghi lý do | 22 |
| FR-A04 | Administrator khóa/mở khóa Account |  |
| FR-A05 | Administrator quản lý trạng thái Account |  |
| FR-A06 | Administrator gán/quản lý Role và Permission |  |

## 9.4 Employee — FR

| Mã | Yêu cầu |
|---|---|
| FR-E01 | Employee tìm Customer theo id/name/phone/email theo permission |
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
| FR-P02 | Payment Provider gửi callback có xác thực về hệ thống | 19 |

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
| FR-S01 | Các service có health/ready endpoint và gateway health-services | 6 |
| FR-S02 | Gateway thực hiện routing, JWT validation và RBAC | 3, 8 |
| FR-S03 | Gateway/service áp dụng rate limit và sanitize input | 3, 8 |
| FR-S04 | Toàn hệ thống chạy được bằng Docker Compose | 5 |
| FR-S05 | Không để lộ secret trong repository hoặc image | 2 |
| FR-S06 | Internal service sử dụng REST cho synchronous call; event dùng messaging | 4, 7 |
| FR-S07 | Dữ liệu nhạy cảm phải được bảo vệ khi lưu trữ: password dùng bcrypt; PII nhạy cảm như `phone`, `license_number` dùng AES-256-GCM; giá trị tra cứu như `phone_hash` sử dụng HMAC-SHA256 với secret key từ environment/secret | 24 |
| FR-S08 | Chống SQL/NoSQL Injection bằng parameterized query, schema validation và input validation; input độc hại không được làm thay đổi logic truy vấn | 25 |
| FR-S09 | Chống XSS/input injection; dữ liệu đầu vào phải được validate/encode/sanitize phù hợp trước khi lưu trữ hoặc trả về | 26 |
| FR-S10 | JWT phải được kiểm tra chữ ký, thuật toán, expiration và claims; JWT bị sửa hoặc không hợp lệ phải bị từ chối | 27 |
| FR-S11 | Unauthorized resource access phải bị từ chối bằng RBAC/ownership check tại Gateway và service sở hữu resource | 28 |
| FR-S12 | API phải áp dụng rate limit cho endpoint cần bảo vệ; khi vượt ngưỡng phải trả `429 Too Many Requests` mà hệ thống vẫn hoạt động | 29 |
| FR-S13 | Transaction/event nhạy cảm phải hỗ trợ idempotency; request/callback/event bị replay không được tạo giao dịch hoặc tác động nghiệp vụ lần hai | 30 |
| FR-S14 | Project có đầy đủ Postman/test/documentation phục vụ kiểm tra hệ thống | 1 |

---

# 10. Business Rules theo Actor

## 10.1 Customer — BR

| Mã | Quy tắc |
|---|---|
| BR-C01 | Chỉ Customer đã xác thực mới được tạo Booking |
| BR-C02 | Customer chỉ được đọc/sửa resource thuộc mình nếu không có quyền đặc biệt |
| BR-C03 | Booking phải có pickup, destination và vehicleType hợp lệ |
| BR-C04 | Customer chỉ được hủy Trip ở trạng thái được phép |
| BR-C05 | Chỉ Trip hợp lệ/hoàn thành mới được đánh giá |
| BR-C06 | Payment amount do server xác định, không tin amount từ client |

## 10.2 Driver — BR

| Mã | Quy tắc |
|---|---|
| BR-D01 | OTP gồm 6 chữ số, TTL 5 phút |
| BR-D02 | Giới hạn số lần nhập OTP sai theo policy |
| BR-D03 | Chỉ Driver đã APPROVED mới được ONLINE |
| BR-D04 | Chỉ Driver ONLINE, phù hợp vehicleType và không BUSY mới được nhận Offer |
| BR-D05 | Driver không được tự ý nhảy trạng thái Trip |
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
| BR-P01 | Callback phải được xác thực chữ ký/secret theo cơ chế đã cấu hình |
| BR-P02 | Payment callback phải idempotent |
| BR-P03 | Client không được tự xác nhận Payment success |

## 10.7 Map Provider — BR

| Mã | Quy tắc |
|---|---|
| BR-M01 | Map Provider không phải source of truth cho Booking/Trip ownership |
| BR-M02 | Không gửi API key/secret Map Provider cho client |
| BR-M03 | Khi Map Provider lỗi, service trả lỗi chuẩn hóa hoặc fallback đã định nghĩa |
| BR-M04 | Map timeout không được làm transaction nghiệp vụ treo vô hạn |

## 10.8 Kafka / Notification — BR

| Mã | Quy tắc |
|---|---|
| BR-K01 | Mỗi event có `eventId` duy nhất |
| BR-K02 | Consumer phải idempotent theo `eventId` |
| BR-K03 | Delivery có thể at-least-once; duplicate phải được xử lý an toàn |
| BR-K04 | Publisher không cần biết subscriber cụ thể |
| BR-K05 | Event lỗi lặp lại phải đi qua retry/DLQ |
| BR-K06 | Kafka outage không được làm mất transaction nghiệp vụ chính nếu transaction đã commit; event phải có cơ chế recovery phù hợp |

## 10.9 Security / System — BR

| Mã | Quy tắc |
|---|---|
| BR-S01 | Service sở hữu resource phải kiểm tra ownership/permission |
| BR-S02 | State transition phải được kiểm tra ở service sở hữu state |
| BR-S03 | JWT phải được kiểm tra signature, expiration và permission |
| BR-S04 | Secret không được ghi vào source code, response hoặc log không cần thiết |
| BR-S05 | Rate limiting áp dụng ở các endpoint cần bảo vệ |
| BR-S06 | Security-sensitive action phải có request/correlation id để trace |

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
| `booking.events` | ride-service | notification-service, backoffice-service |
| `trip.events` | ride-service | notification-service, backoffice-service |
| `driver.events` | people-fleet-service | notification-service, backoffice-service |
| `payment.events` | billing-feedback-service | notification-service, backoffice-service |
| `incident.events` | backoffice-service | notification-service |
| `notification.commands` | domain services | notification-service |
| `notification.dlq` | notification-service | operator/admin |

## 12.2 Event Envelope

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

## 12.3 Notification Flow

```text
Booking / Trip / Driver / Payment / Incident
                    ↓
              Domain Event
                    ↓
                   Kafka
                    ↓
          Notification Service
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

- `accounts`
- `roles`
- `permissions`
- `customers`
- `drivers`
- `vehicles`
- `driver_locations`
- `bookings`
- `offers`
- `trips`
- `payments`
- `reviews`
- `notifications`

## 13.2 Incident

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

## 13.3 Audit Logs

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

# 14. Microservice Ownership

| Service | Trách nhiệm |
|---|---|
| `identity-service` | Account, authentication, RBAC |
| `people-fleet-service` | Customer profile, Driver profile, Vehicle, driver location |
| `ride-service` | Booking, Dispatch, Offer, Trip, Fare, route coordination |
| `billing-feedback-service` | Payment, Review |
| `notification-service` | Notification DB, Kafka consumer/producer |
| `backoffice-service` | Operations, Incident, Reporting, Dashboard, Audit |

External systems:

```text
Payment Provider
      ↓ callback
billing-feedback-service

Map Provider
      ↕
ride-service / people-fleet-service

Kafka
      ↕
domain services / notification-service / backoffice-service
```

---

# 15. Non-functional Requirements

| Mã | Yêu cầu |
|---|---|
| NFR-01 | Hệ thống sử dụng JWT và RBAC cho authenticated API |
| NFR-02 | Internal service sử dụng REST cho synchronous call và Kafka cho event-driven communication |
| NFR-03 | Kafka consumer có idempotency theo `eventId` |
| NFR-04 | Kafka producer/consumer có retry policy phù hợp |
| NFR-05 | Notification Service có DLQ |
| NFR-06 | Map Provider có timeout/circuit-breaker hoặc cơ chế bảo vệ tương đương |
| NFR-07 | Map API key không xuất hiện ở client, response hoặc log không cần thiết |
| NFR-08 | Dashboard/reporting không được làm ảnh hưởng đáng kể đến OLTP; có thể dùng read model/aggregate query |
| NFR-09 | Audit có correlation/request ID để trace xuyên Gateway → Service → Kafka |
| NFR-10 | Employee và Board API bắt buộc JWT + RBAC + scope/ownership phù hợp |
| NFR-11 | API phải có input validation và output sanitization cần thiết |
| NFR-12 | System services có health/ready endpoint |

---

# 16. Requirement Traceability theo tiêu chí kiểm tra

| PC# | Nội dung kiểm tra | UC/FR chính |
|---:|---|---|
| 1 | Project structure / API / Postman / docs | UC61, FR-S14 |
| 2 | Không commit secret / file rác | FR-S05 |
| 3 | Gateway routing, auth, RBAC, rate limit | UC59, FR-S02, FR-S03 |
| 4 | Internal REST | FR-S06 |
| 5 | Docker Compose | UC60, FR-S04 |
| 6 | Health/Ready | UC58, FR-S01 |
| 7 | Message broker | FR-S06, FR-K01–FR-K04 |
| 8 | Gateway security | UC59, FR-S02–FR-S03 |
| 9 | Customer registration | UC01, FR-C01 |
| 10 | Login/JWT | UC02, FR-C02 |
| 11 | Customer profile | UC03, FR-C03 |
| 12 | Driver profile | UC14, FR-D04 |
| 13 | Driver nearby / location | UC04, UC16, FR-C04, FR-D06 |
| 14 | Customer Booking list | UC05, FR-C05 |
| 15 | Booking / matching | UC06, FR-C06–FR-C07 |
| 16 | Offer / accept | UC17–UC18, FR-D07–FR-D08 |
| 17 | Trip lifecycle | UC07, UC19, FR-C08, FR-D09 |
| 18 | Trip cancellation | UC08, UC20, FR-C09, FR-D10 |
| 19 | Payment / callback | UC09, UC47–UC48, FR-C10, FR-P01–FR-P02 |
| 20 | Review | UC10, FR-C11 |
| 21 | Driver OTP / onboarding | UC12–UC13, FR-D01–FR-D03 |
| 22 | Driver approval | UC22–UC24, FR-A01–FR-A03 |
| 23 | Driver availability | UC15, FR-D05 |
| 24 | Bảo vệ dữ liệu nhạy cảm khi lưu trữ | UC61, FR-S07 |
| 25 | Chống SQL/NoSQL Injection | UC61, FR-S08 |
| 26 | Chống XSS/input injection | UC61, FR-S09 |
| 27 | JWT tampering/invalid token | UC61, FR-S10 |
| 28 | Unauthorized resource access | UC61, FR-S11 |
| 29 | Rate limit | UC59, UC61, FR-S12 |
| 30 | Replay/idempotency | UC61, FR-S13 |

---

# 17. Quy tắc tổng quát về quyền và dữ liệu

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
