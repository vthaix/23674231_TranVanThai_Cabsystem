# SOFTWARE REQUIREMENTS SPECIFICATION

# CAB SYSTEM

**Hệ thống:** CAB System – Hệ thống quản lý và đặt xe

---

# 1. Tổng quan

## 1.1. Mục đích tài liệu

Tài liệu này đặc tả các yêu cầu nghiệp vụ, yêu cầu chức năng, yêu cầu phi chức năng, quy tắc nghiệp vụ, mô hình dữ liệu, quy trình nghiệp vụ và tiêu chí chấp nhận của CAB System.

CAB System hỗ trợ toàn bộ quy trình:

```text
Đăng ký / Đăng nhập
        ↓
Quản lý hồ sơ
        ↓
Khách hàng tạo yêu cầu đặt xe
        ↓
Hệ thống tìm tài xế phù hợp
        ↓
Gửi yêu cầu cho tài xế
        ↓
Tài xế nhận / từ chối / không phản hồi
        ↓
Phân công thành công
        ↓
Thực hiện chuyến
        ↓
Cập nhật trạng thái + vị trí
        ↓
Hoàn thành / Hủy
        ↓
Tính cước
        ↓
Thanh toán
        ↓
Đánh giá
        ↓
Lịch sử / Báo cáo / Vận hành
```

Tài liệu này được sử dụng làm source of truth cho:

* Thiết kế database.
* Thiết kế API.
* Thiết kế frontend.
* Thiết kế backend/service.
* Phân quyền.
* Validation.
* State transition.
* Xử lý ngoại lệ.
* Kiểm thử.
* Vibe coding bằng AI.

---

# 2. Business Context

## 2.1. Business Problem

Công ty ABC cần một hệ thống quản lý dịch vụ đặt xe nhằm giải quyết các vấn đề:

1. Việc phân công tài xế còn thủ công.
2. Khó tìm tài xế phù hợp với loại xe và vị trí của khách hàng.
3. Khi tài xế từ chối hoặc không phản hồi, việc tìm tài xế khác chưa được tự động hóa.
4. Khách hàng khó theo dõi trạng thái chuyến xe.
5. Thông tin chuyến xe và thanh toán chưa được quản lý tập trung.
6. Nhân viên vận hành khó theo dõi tài xế, phương tiện và chuyến đang hoạt động.
7. Khó xử lý và theo dõi sự cố vận hành.
8. Khó tổng hợp báo cáo về chuyến xe, doanh thu và hiệu quả tài xế.
9. Hệ thống cần có khả năng mở rộng thêm phương thức thanh toán và thông báo.

## 2.2. Vấn đề cốt lõi

CAB System cần tự động hóa quy trình:

```text
Customer Request
      ↓
Driver Matching
      ↓
Driver Assignment
      ↓
Trip Execution
      ↓
Payment
      ↓
Rating
```

đồng thời cung cấp khả năng quản lý vận hành, phân quyền và báo cáo.

---

# 3. Stakeholders

| Stakeholder           | Vai trò                                                      |
| --------------------- | ------------------------------------------------------------ |
| Customer              | Đặt xe, theo dõi chuyến, thanh toán, xem lịch sử và đánh giá |
| Driver                | Nhận chuyến, thực hiện chuyến, cập nhật trạng thái và vị trí |
| Operations Staff      | Quản lý và giám sát hoạt động vận hành                       |
| Administrator         | Quản lý tài khoản, role, permission và audit                 |
| Management User       | Xem dashboard và báo cáo                                     |
| Payment Provider      | Xử lý thanh toán trực tuyến                                  |
| Notification Provider | Gửi thông báo                                                |

---

# 4. Actors

## 4.1. Customer

Có quyền:

* Đăng ký.
* Đăng nhập.
* Đăng xuất.
* Quản lý hồ sơ.
* Đặt xe.
* Xem trạng thái booking.
* Hủy booking/chuyến trong phạm vi cho phép.
* Theo dõi tài xế.
* Xem lịch sử chuyến.
* Thanh toán.
* Đánh giá tài xế.
* Xem thông báo.

## 4.2. Driver

Có quyền:

* Đăng ký / đăng nhập.
* Quản lý hồ sơ.
* Quản lý phương tiện.
* Chuyển trạng thái sẵn sàng.
* Nhận yêu cầu chuyến.
* Từ chối yêu cầu chuyến.
* Cập nhật trạng thái chuyến.
* Cập nhật vị trí.
* Hủy chuyến trong phạm vi cho phép.
* Xem lịch sử chuyến của mình.

## 4.3. Operations Staff

Có quyền:

* Xem Customer.
* Xem Driver.
* Quản lý Vehicle.
* Theo dõi Trip.
* Theo dõi trạng thái Driver.
* Tra cứu Payment.
* Xử lý Incident.
* Hỗ trợ vận hành.

## 4.4. Administrator

Có quyền:

* Quản lý tài khoản.
* Khóa / mở khóa tài khoản.
* Quản lý Role.
* Quản lý Permission.
* Gán Role.
* Kiểm soát quyền truy cập.
* Xem AuditLog.

## 4.5. Management User

Có quyền:

* Xem dashboard.
* Xem số lượng chuyến.
* Xem doanh thu.
* Xem tỷ lệ hoàn thành.
* Xem tỷ lệ hủy.
* Xem hiệu quả Driver.
* Lọc báo cáo theo thời gian.
* Xem dữ liệu chi tiết tạo nên báo cáo.

## 4.6. Payment Provider

Hệ thống bên ngoài xử lý giao dịch thanh toán trực tuyến.

## 4.7. Notification Provider

Hệ thống bên ngoài hỗ trợ gửi notification.

---

# 5. Business Goals

| Mã   | Business Goal                                             |
| ---- | --------------------------------------------------------- |
| BG01 | Cho phép Customer đăng ký, đăng nhập và quản lý tài khoản |
| BG02 | Cho phép Customer tạo yêu cầu đặt xe                      |
| BG03 | Tự động tìm và phân công Driver phù hợp                   |
| BG04 | Cho phép Driver nhận hoặc từ chối chuyến                  |
| BG05 | Quản lý toàn bộ vòng đời Trip                             |
| BG06 | Cho phép Customer theo dõi Trip                           |
| BG07 | Hỗ trợ tính cước và thanh toán                            |
| BG08 | Lưu trữ lịch sử Trip và Payment                           |
| BG09 | Cho phép Customer đánh giá Driver                         |
| BG10 | Hỗ trợ Notification                                       |
| BG11 | Hỗ trợ Operations Staff xử lý vận hành                    |
| BG12 | Hỗ trợ Administrator quản lý Role và Permission           |
| BG13 | Hỗ trợ Management User xem báo cáo                        |

---

# 6. Scope

## 6.1. In Scope

### Account

* Đăng ký.
* Đăng nhập.
* Đăng xuất.
* Quản lý hồ sơ.
* Quản lý trạng thái tài khoản.
* RBAC.

### Booking

* Tạo Booking.
* Xem Booking.
* Hủy Booking.
* Xác định điểm đón.
* Xác định điểm đến.
* Chọn loại xe.

### Driver Matching

* Tìm Driver.
* Lọc Driver theo trạng thái.
* Lọc Driver theo loại xe.
* Tính khoảng cách.
* Ưu tiên Driver phù hợp.
* Gửi yêu cầu.
* Xử lý accept.
* Xử lý reject.
* Xử lý timeout.
* Retry.

### Trip

* Tạo Trip.
* Cập nhật trạng thái.
* Cập nhật vị trí.
* Hủy Trip.
* Hoàn thành Trip.

### Payment

* Tính cước.
* Thanh toán tiền mặt.
* Thanh toán online.
* Ghi nhận Payment.
* Xử lý Payment thất bại.

### Rating

* Tạo Rating.
* Xem Rating.

### Notification

* Tạo Notification.
* Gửi Notification.
* Xem Notification.
* Đánh dấu đã đọc.

### Incident

* Tạo Incident.
* Theo dõi Incident.
* Xử lý Incident.
* Đóng Incident.

### Operation

* Quản lý Customer.
* Quản lý Driver.
* Quản lý Vehicle.
* Theo dõi Trip.
* Tra cứu Payment.

### Reporting

* Số lượng Trip.
* Doanh thu.
* Tỷ lệ hoàn thành.
* Tỷ lệ hủy.
* Hiệu quả Driver.

---

# 7. Out of Scope

Các chức năng sau không thuộc MVP:

* Quản lý lương Driver.
* Quản lý kế toán doanh nghiệp.
* Quản lý bảo dưỡng Vehicle chi tiết.
* Quản lý kho.
* Quản lý nhiên liệu.
* Điều phối nhiều điểm phức tạp.
* Dynamic pricing phức tạp.
* Loyalty / Membership.
* Voucher phức tạp.
* Subscription.
* Tích hợp bản đồ chuyên sâu.
* Machine Learning để dự đoán nhu cầu.
* Theo dõi lịch sử GPS chi tiết của toàn bộ hành trình.
* Thanh toán bằng cách lưu trực tiếp thông tin thẻ.

---

# 8. Business Process

## 8.1. Account Process

```text
User
 ↓
Register
 ↓
Validate
 ↓
Create Account
 ↓
Assign Role
 ↓
Login
 ↓
Authentication
 ↓
Authorization
```

---

# 9. Booking Process

```text
Customer
 ↓
Nhập pickup
 ↓
Nhập destination
 ↓
Chọn vehicle type
 ↓
Validate
 ↓
Create Booking
 ↓
Booking = SEARCHING
 ↓
Driver Matching
```

### Dữ liệu phát sinh

| Bước           | CRUD      | Entity                 |
| -------------- | --------- | ---------------------- |
| Nhập form      | Không lưu | Frontend state         |
| Validate       | READ      | VehicleType / hệ thống |
| Tạo Booking    | CREATE    | Booking                |
| Đặt trạng thái | UPDATE    | Booking                |

---

# 10. Driver Matching Process

```text
Booking = SEARCHING
        ↓
Tìm Driver AVAILABLE
        ↓
Lọc Vehicle Type
        ↓
Kiểm tra Location
        ↓
Tính khoảng cách
        ↓
Chọn Driver phù hợp
        ↓
CREATE BookingAssignment
        ↓
Gửi request
        ↓
Chờ phản hồi
        ↓
 ┌───────────────┬──────────────┬─────────────┐
 ACCEPT          REJECT         TIMEOUT
 ↓               ↓              ↓
Assign Trip      Retry          Retry
```

---

# 11. BookingAssignment

`BookingAssignment` dùng để lưu lịch sử mỗi lần hệ thống gửi một Booking đến Driver.

## Fields

| Field        | Ý nghĩa                                          |
| ------------ | ------------------------------------------------ |
| assignmentId | ID                                               |
| bookingId    | Booking                                          |
| driverId     | Driver                                           |
| status       | SENT / ACCEPTED / REJECTED / TIMEOUT / CANCELLED |
| sentAt       | Thời điểm gửi                                    |
| respondedAt  | Thời điểm phản hồi                               |
| rejectReason | Lý do từ chối nếu có                             |

## Mục đích

Cho phép hệ thống biết:

```text
Booking B001
 ├── Driver A → REJECTED
 ├── Driver B → TIMEOUT
 └── Driver C → ACCEPTED
```

Không sử dụng `Trip.driverId` để lưu lịch sử phân công.

---

# 12. Trip Process

Sau khi Driver nhận Booking:

```text
Booking = ASSIGNED
        ↓
Create Trip
        ↓
Trip = ASSIGNED
        ↓
Driver đến điểm đón
        ↓
ARRIVED
        ↓
Đã đón khách
        ↓
PICKED_UP
        ↓
Đang di chuyển
        ↓
IN_PROGRESS
        ↓
Hoàn thành
        ↓
COMPLETED
```

---

# 13. Trip State Machine

Trạng thái chuẩn:

```text
ASSIGNED
   ↓
ARRIVED
   ↓
PICKED_UP
   ↓
IN_PROGRESS
   ↓
COMPLETED
```

Có thể chuyển sang:

```text
CANCELLED
```

khi điều kiện nghiệp vụ cho phép.

Không cho phép:

```text
COMPLETED → IN_PROGRESS
COMPLETED → ASSIGNED
CANCELLED → IN_PROGRESS
```

---

# 14. Driver State Machine

```text
OFFLINE
   ↓
AVAILABLE
   ↓
BUSY
   ↓
AVAILABLE
```

Trong đó:

* `OFFLINE`: Driver không hoạt động.
* `AVAILABLE`: Driver có thể nhận chuyến.
* `BUSY`: Driver đang thực hiện Trip.

Driver chỉ được chuyển sang `AVAILABLE` nếu:

* Đã đăng nhập.
* Tài khoản đang hoạt động.
* Không có Trip đang thực hiện.
* Vehicle hợp lệ.

---

# 15. Payment Process

```text
Trip = COMPLETED
       ↓
Calculate Fare
       ↓
Select Payment Method
       ↓
 ┌──────────────┬───────────────┐
 CASH           ONLINE
 ↓              ↓
Record Payment  Payment Provider
                ↓
          SUCCESS / FAILED
```

---

# 16. Rating Process

```text
Trip = COMPLETED
       ↓
Customer
       ↓
Create Rating
       ↓
Validate
       ↓
Save Rating
```

Mỗi Trip chỉ có tối đa một Rating của Customer.

---

# 17. Notification Process

Notification được tạo khi xảy ra các sự kiện quan trọng:

```text
Booking Created
Driver Assigned
Driver Arrived
Trip Completed
Payment Success
Payment Failed
Booking Cancelled
```

Notification có thể được lưu để Customer/Driver xem lại.

---

# 18. Incident Process

```text
Incident detected
       ↓
Create Incident
       ↓
Assign / receive by Operations Staff
       ↓
Investigating
       ↓
Resolving
       ↓
Resolved
```

Incident có thể liên kết với Trip nhưng không bắt buộc phải có Trip.

---

# 19. Reporting Process

Báo cáo được tạo động từ dữ liệu:

```text
Trip
Payment
Driver
Rating
BookingAssignment
```

Không bắt buộc tạo bảng `ManagementReport`.

Ví dụ:

```text
totalTrips
completedTrips
cancelledTrips
revenue
completionRate
cancellationRate
driverMetrics
```

---

# 20. Business Requirements

| Mã   | Tên                 | Mô tả                                   |
| ---- | ------------------- | --------------------------------------- |
| BR01 | Quản lý tài khoản   | Quản lý Account và authentication       |
| BR02 | Quản lý hồ sơ       | Quản lý thông tin Customer/Driver       |
| BR03 | Quản lý phương tiện | Driver quản lý Vehicle                  |
| BR04 | Quản lý Booking     | Customer tạo và quản lý yêu cầu         |
| BR05 | Phân công Driver    | Hệ thống tự động tìm Driver             |
| BR06 | Quản lý Assignment  | Lưu lịch sử gửi yêu cầu đến Driver      |
| BR07 | Quản lý Trip        | Quản lý vòng đời chuyến                 |
| BR08 | Theo dõi Trip       | Theo dõi trạng thái và thông tin Driver |
| BR09 | Tính cước           | Tính fare                               |
| BR10 | Thanh toán          | Quản lý Payment                         |
| BR11 | Notification        | Gửi và lưu thông báo                    |
| BR12 | Rating              | Customer đánh giá Driver                |
| BR13 | Incident            | Xử lý sự cố                             |
| BR14 | Operations          | Nhân viên vận hành quản lý hệ thống     |
| BR15 | Authorization       | Role và Permission                      |
| BR16 | Audit               | Ghi nhận thao tác nhạy cảm              |
| BR17 | Reporting           | Báo cáo quản trị                        |

---

# 21. Functional Requirements

## BR01 – Account

| Mã   | Requirement                          |
| ---- | ------------------------------------ |
| FR01 | Đăng ký tài khoản                    |
| FR02 | Đăng nhập                            |
| FR03 | Đăng xuất                            |
| FR04 | Kiểm tra trạng thái tài khoản        |
| FR05 | Hash password                        |
| FR06 | Cấp authentication session/token     |
| FR07 | Từ chối truy cập nếu account bị khóa |

---

## BR02 – Profile

| Mã   | Requirement              |
| ---- | ------------------------ |
| FR08 | Xem hồ sơ                |
| FR09 | Cập nhật hồ sơ           |
| FR10 | Đổi mật khẩu             |
| FR11 | Validate thông tin hồ sơ |

---

## BR03 – Vehicle

| Mã   | Requirement                      |
| ---- | -------------------------------- |
| FR12 | Xem Vehicle                      |
| FR13 | Thêm Vehicle                     |
| FR14 | Cập nhật Vehicle                 |
| FR15 | Vô hiệu hóa Vehicle              |
| FR16 | Kiểm tra Vehicle phù hợp loại xe |

---

## BR04 – Booking

| Mã   | Requirement                 |
| ---- | --------------------------- |
| FR17 | Nhập điểm đón               |
| FR18 | Nhập điểm đến               |
| FR19 | Chọn loại xe                |
| FR20 | Validate Booking            |
| FR21 | Tạo Booking                 |
| FR22 | Xem Booking                 |
| FR23 | Hủy Booking                 |
| FR24 | Cập nhật trạng thái Booking |

---

## BR05 – Driver Matching

| Mã   | Requirement                     |
| ---- | ------------------------------- |
| FR25 | Tìm Driver AVAILABLE            |
| FR26 | Lọc Driver theo Vehicle         |
| FR27 | Lọc Driver theo khoảng cách     |
| FR28 | Ưu tiên Driver phù hợp          |
| FR29 | Gửi request đến Driver          |
| FR30 | Chờ phản hồi                    |
| FR31 | Xử lý ACCEPT                    |
| FR32 | Xử lý REJECT                    |
| FR33 | Xử lý TIMEOUT                   |
| FR34 | Retry Driver                    |
| FR35 | Thông báo không tìm được Driver |

---

## BR06 – Assignment

| Mã   | Requirement                                                     |
| ---- | --------------------------------------------------------------- |
| FR36 | Tạo BookingAssignment                                           |
| FR37 | Cập nhật trạng thái Assignment                                  |
| FR38 | Lưu thời gian gửi                                               |
| FR39 | Lưu thời gian phản hồi                                          |
| FR40 | Lưu lý do từ chối                                               |
| FR41 | Không gửi lại cùng Driver nếu đã bị loại trong Booking hiện tại |

---

## BR07 – Trip

| Mã   | Requirement               |
| ---- | ------------------------- |
| FR42 | Tạo Trip                  |
| FR43 | Nhận Trip                 |
| FR44 | Từ chối Trip              |
| FR45 | Cập nhật ARRIVED          |
| FR46 | Cập nhật PICKED_UP        |
| FR47 | Cập nhật IN_PROGRESS      |
| FR48 | Cập nhật COMPLETED        |
| FR49 | Hủy Trip                  |
| FR50 | Kiểm tra state transition |
| FR51 | Lưu thời gian trạng thái  |

---

## BR08 – Tracking

| Mã   | Requirement                        |
| ---- | ---------------------------------- |
| FR52 | Cập nhật latitude                  |
| FR53 | Cập nhật longitude                 |
| FR54 | Lưu thời gian cập nhật location    |
| FR55 | Customer xem vị trí Driver         |
| FR56 | Operations Staff xem vị trí Driver |

Hệ thống MVP chỉ lưu vị trí hiện tại của Driver.

Không lưu lịch sử GPS chi tiết.

---

## BR09 – Fare

| Mã   | Requirement                                  |
| ---- | -------------------------------------------- |
| FR57 | Tính cước                                    |
| FR58 | Lưu fare                                     |
| FR59 | Hiển thị fare                                |
| FR60 | Không tính Payment trước khi Trip hoàn thành |

---

## BR10 – Payment

| Mã   | Requirement                                  |
| ---- | -------------------------------------------- |
| FR61 | Chọn phương thức Payment                     |
| FR62 | Thanh toán tiền mặt                          |
| FR63 | Khởi tạo online Payment                      |
| FR64 | Nhận kết quả Payment Provider                |
| FR65 | Ghi nhận Payment success                     |
| FR66 | Ghi nhận Payment failed                      |
| FR67 | Không tạo nhiều Payment success cho một Trip |
| FR68 | Lưu provider transaction ID                  |
| FR69 | Không lưu thông tin thẻ nhạy cảm             |

---

## BR11 – Notification

| Mã   | Requirement                  |
| ---- | ---------------------------- |
| FR70 | Tạo Notification             |
| FR71 | Gửi Notification             |
| FR72 | Lưu Notification             |
| FR73 | Xem Notification             |
| FR74 | Đánh dấu Notification đã đọc |

---

## BR12 – Rating

| Mã   | Requirement                               |
| ---- | ----------------------------------------- |
| FR75 | Tạo Rating                                |
| FR76 | Validate score                            |
| FR77 | Lưu comment                               |
| FR78 | Không cho Rating nếu Trip chưa hoàn thành |
| FR79 | Không tạo Rating trùng                    |
| FR80 | Xem Rating                                |

---

## BR13 – Incident

| Mã   | Requirement              |
| ---- | ------------------------ |
| FR81 | Tạo Incident             |
| FR82 | Xem Incident             |
| FR83 | Cập nhật Incident        |
| FR84 | Cập nhật trạng thái      |
| FR85 | Ghi nhận resolution      |
| FR86 | Đóng Incident            |
| FR87 | Ghi nhận thời gian xử lý |

---

## BR14 – Operations

| Mã   | Requirement        |
| ---- | ------------------ |
| FR88 | Xem Customer       |
| FR89 | Xem Driver         |
| FR90 | Quản lý Vehicle    |
| FR91 | Xem danh sách Trip |
| FR92 | Xem chi tiết Trip  |
| FR93 | Theo dõi Driver    |
| FR94 | Tra cứu Payment    |
| FR95 | Xử lý Incident     |

---

## BR15 – Authorization

| Mã    | Requirement              |
| ----- | ------------------------ |
| FR96  | Quản lý Role             |
| FR97  | Quản lý Permission       |
| FR98  | Gán Role                 |
| FR99  | Kiểm tra Permission      |
| FR100 | Chặn truy cập trái quyền |

---

## BR16 – Audit

| Mã    | Requirement                           |
| ----- | ------------------------------------- |
| FR101 | Ghi nhận Login                        |
| FR102 | Ghi nhận thay đổi Role                |
| FR103 | Ghi nhận thay đổi Permission          |
| FR104 | Ghi nhận khóa/mở khóa Account         |
| FR105 | Ghi nhận thao tác quản trị quan trọng |

---

## BR17 – Reporting

| Mã    | Requirement              |
| ----- | ------------------------ |
| FR106 | Báo cáo số lượng Trip    |
| FR107 | Báo cáo doanh thu        |
| FR108 | Báo cáo tỷ lệ hoàn thành |
| FR109 | Báo cáo tỷ lệ hủy        |
| FR110 | Báo cáo hiệu quả Driver  |
| FR111 | Lọc theo thời gian       |
| FR112 | Xem dữ liệu chi tiết     |

---

# 22. Data Persistence Matrix

| Nghiệp vụ                |                 Có lưu? | Entity                      |
| ------------------------ | ----------------------: | --------------------------- |
| Nhập điểm đón            |  Không trước khi submit | Frontend state              |
| Tạo Booking              |                      Có | Booking                     |
| Tìm Driver               | Không tạo dữ liệu chính | Driver / Vehicle            |
| Gửi Driver request       |                      Có | BookingAssignment           |
| Driver Reject            |                      Có | BookingAssignment           |
| Driver Timeout           |                      Có | BookingAssignment           |
| Driver Accept            |                      Có | BookingAssignment + Booking |
| Tạo Trip                 |                      Có | Trip                        |
| Cập nhật trạng thái Trip |                      Có | Trip                        |
| Cập nhật vị trí          |                      Có | Driver                      |
| Tính cước                |                      Có | Trip.fare                   |
| Thanh toán               |                      Có | Payment                     |
| Notification             |                      Có | Notification                |
| Rating                   |                      Có | Rating                      |
| Incident                 |                      Có | Incident                    |
| Báo cáo                  |          Không bắt buộc | Query/aggregation           |
| Audit                    |                      Có | AuditLog                    |

---

# 23. Domain Model

## 23.1. Customer

```text
Customer
---------
customerId PK
fullName
phone
email
passwordHash
status
createdAt
updatedAt
```

## 23.2. Driver

```text
Driver
------
driverId PK
fullName
phone
email
passwordHash
status
currentLatitude
currentLongitude
locationUpdatedAt
createdAt
updatedAt
```

## 23.3. Vehicle

```text
Vehicle
-------
vehicleId PK
driverId FK
vehicleType
licensePlate
model
status
createdAt
updatedAt
```

## 23.4. Booking

```text
Booking
-------
bookingId PK
customerId FK
pickupLocation
destination
vehicleType
status
createdAt
updatedAt
cancelledAt
cancellationReason
```

## 23.5. BookingAssignment

```text
BookingAssignment
-----------------
assignmentId PK
bookingId FK
driverId FK
status
sentAt
respondedAt
rejectReason
```

## 23.6. Trip

```text
Trip
----
tripId PK
bookingId FK
customerId FK
driverId FK
vehicleId FK
pickupLocation
destination
status
fare
assignedAt
arrivedAt
pickedUpAt
startedAt
completedAt
cancelledAt
cancellationReason
cancelledBy
createdAt
updatedAt
```

## 23.7. Payment

```text
Payment
-------
paymentId PK
tripId FK
method
amount
status
providerTransactionId
paidAt
createdAt
updatedAt
```

## 23.8. Rating

```text
Rating
------
ratingId PK
tripId FK
customerId FK
driverId FK
score
comment
createdAt
updatedAt
```

## 23.9. Notification

```text
Notification
------------
notificationId PK
recipientType
recipientId
tripId FK nullable
type
title
message
isRead
createdAt
readAt
```

## 23.10. Incident

```text
Incident
--------
incidentId PK
tripId FK nullable
reportedBy
type
description
status
resolution
handledBy FK
createdAt
resolvedAt
```

## 23.11. Role

```text
Role
----
roleId PK
name
description
```

## 23.12. Permission

```text
Permission
----------
permissionId PK
code
name
description
```

## 23.13. UserRole

```text
UserRole
--------
userId
userType
roleId
```

Nếu implementation dùng một bảng User chung thì `userType` không cần thiết.

## 23.14. AuditLog

```text
AuditLog
--------
logId PK
actorId
actorType
action
targetType
targetId
timestamp
details
```

---

# 24. Entity Relationships

```text
Customer 1 ─────── N Booking

Booking 1 ─────── N BookingAssignment

Driver 1 ───────── N BookingAssignment

Booking 1 ─────── 0..1 Trip

Driver 1 ───────── N Trip

Vehicle 1 ──────── N Trip

Driver 1 ───────── N Vehicle

Trip 1 ─────────── 0..1 Payment

Trip 1 ─────────── 0..1 Rating

Driver 1 ───────── N Rating

Trip 1 ─────────── N Notification

Trip 0..1 ──────── N Incident

OperationsStaff 1 ─ N Incident

Role 1 ─────────── N Permission
```

---

# 25. Use Case List

## Authentication

```text
UC01 Đăng ký
UC02 Đăng nhập
UC03 Đăng xuất
```

## Profile

```text
UC04 Xem hồ sơ
UC05 Cập nhật hồ sơ
UC06 Đổi mật khẩu
```

## Vehicle

```text
UC07 Xem phương tiện
UC08 Thêm phương tiện
UC09 Cập nhật phương tiện
UC10 Vô hiệu hóa phương tiện
```

## Booking

```text
UC11 Tạo Booking
UC12 Xem Booking
UC13 Hủy Booking
```

## Driver Assignment

```text
UC14 Tìm và phân công Driver
UC15 Nhận chuyến
UC16 Từ chối chuyến
```

## Trip

```text
UC17 Tạo Trip
UC18 Cập nhật trạng thái Trip
UC19 Cập nhật vị trí
UC20 Hủy Trip
UC21 Hoàn thành Trip
```

## Payment

```text
UC22 Tính cước
UC23 Thanh toán
UC24 Tra cứu Payment
```

## Rating

```text
UC25 Đánh giá Driver
UC26 Xem Rating
```

## Notification

```text
UC27 Xem Notification
UC28 Đánh dấu Notification đã đọc
```

## Incident

```text
UC29 Xử lý Incident
```

## Operations

```text
UC30 Quản lý Customer
UC31 Quản lý Driver
UC32 Quản lý Vehicle
UC33 Theo dõi Trip
```

## Administration

```text
UC34 Quản lý Account
UC35 Quản lý Role
UC36 Quản lý Permission
UC37 Xem AuditLog
```

## Reporting

```text
UC38 Xem Dashboard
UC39 Xem báo cáo Trip
UC40 Xem báo cáo doanh thu
UC41 Xem báo cáo Driver
```

---

# 26. Chi tiết Use Case

# UC01 – Đăng ký

**Actor:** Customer / Driver

**Precondition:**

* Người dùng chưa có Account.

**Main Flow:**

1. Người dùng mở chức năng đăng ký.
2. Nhập thông tin.
3. Hệ thống validate.
4. Kiểm tra email/phone chưa tồn tại.
5. Hash password.
6. Tạo Account.
7. Gán Role.
8. Thông báo đăng ký thành công.

**Data:**

```text
CREATE Customer hoặc Driver
```

**Exception:**

* Email trùng.
* Phone trùng.
* Password không hợp lệ.
* Dữ liệu bắt buộc thiếu.

---

# UC02 – Đăng nhập

**Actor:** Customer / Driver / Operations Staff / Administrator / Management User

**Main Flow:**

1. Nhập email/phone.
2. Nhập password.
3. Hệ thống tìm Account.
4. Kiểm tra status.
5. Verify password.
6. Tạo session/token.
7. Load Role.
8. Redirect đến chức năng tương ứng.

**Data:**

```text
READ Account
CREATE Session/Token
CREATE AuditLog nếu chính sách yêu cầu
```

---

# UC03 – Đăng xuất

1. Người dùng chọn Logout.
2. Hệ thống invalidate session/token.
3. Kết thúc phiên.

---

# UC04 – Xem hồ sơ

1. Người dùng mở Profile.
2. Hệ thống xác định user.
3. Query dữ liệu.
4. Hiển thị.

**CRUD:** READ.

---

# UC05 – Cập nhật hồ sơ

1. User mở Profile.
2. Sửa thông tin.
3. Validate.
4. UPDATE Account/Profile.
5. Trả kết quả.

---

# UC06 – Đổi mật khẩu

1. Nhập password hiện tại.
2. Nhập password mới.
3. Verify password hiện tại.
4. Hash password mới.
5. UPDATE passwordHash.
6. Có thể invalidate các session cũ.

---

# UC07 – Xem Vehicle

Driver chỉ xem Vehicle thuộc quyền quản lý.

---

# UC08 – Thêm Vehicle

1. Driver nhập thông tin.
2. Validate.
3. Kiểm tra licensePlate.
4. CREATE Vehicle.
5. Trả kết quả.

---

# UC09 – Cập nhật Vehicle

1. Chọn Vehicle.
2. Kiểm tra quyền sở hữu.
3. Update.
4. Validate.
5. Lưu.

---

# UC10 – Vô hiệu hóa Vehicle

Vehicle chuyển:

```text
ACTIVE → INACTIVE
```

Không xóa vật lý nếu Vehicle đã từng được sử dụng trong Trip.

---

# UC11 – Tạo Booking

**Actor:** Customer

**Precondition:**

* Customer đã đăng nhập.
* Account ACTIVE.

**Main Flow:**

1. Customer nhập pickup.
2. Nhập destination.
3. Chọn vehicleType.
4. Hệ thống validate.
5. CREATE Booking.
6. Booking.status = SEARCHING.
7. Kích hoạt Driver Matching.
8. Gửi Notification xác nhận.

**Data:**

```text
CREATE Booking
CREATE Notification
```

**Exception:**

* Thiếu pickup.
* Thiếu destination.
* Vehicle type không hợp lệ.
* Customer bị khóa.

---

# UC12 – Xem Booking

Customer chỉ được xem Booking của chính mình.

Operations Staff có thể xem theo permission.

---

# UC13 – Hủy Booking

1. Xác định Booking.
2. Kiểm tra quyền.
3. Kiểm tra status.
4. Kiểm tra chính sách hủy.
5. UPDATE status = CANCELLED.
6. Lưu cancellationReason.
7. Gửi Notification.

---

# UC14 – Tìm và phân công Driver

**Actor:** System

**Main Flow:**

1. Nhận Booking SEARCHING.
2. Lấy pickup.
3. Tìm Driver AVAILABLE.
4. Kiểm tra Vehicle.
5. Kiểm tra loại xe.
6. Kiểm tra location.
7. Tính khoảng cách.
8. Sắp xếp Driver phù hợp.
9. Tạo BookingAssignment.
10. Gửi request.
11. Chờ phản hồi.
12. ACCEPT → tiếp tục phân công.
13. REJECT/TIMEOUT → Assignment thất bại.
14. Retry Driver tiếp theo.
15. Hết Driver → Booking = NO_DRIVER_FOUND.

---

# UC15 – Nhận chuyến

**Actor:** Driver

1. Driver xem request.
2. Chọn Accept.
3. Hệ thống kiểm tra Assignment.
4. Kiểm tra Booking còn SEARCHING.
5. Kiểm tra Driver còn AVAILABLE.
6. Lock Assignment/Booking.
7. Assignment = ACCEPTED.
8. Booking = ASSIGNED.
9. CREATE Trip.
10. Driver = BUSY.
11. Gửi Notification.
12. Kết thúc.

### Race condition

Nếu Driver A và Driver B cùng Accept:

```text
Chỉ một Driver được ACCEPT.
```

Driver xử lý sau nhận:

```text
409 Conflict / Booking unavailable
```

---

# UC16 – Từ chối chuyến

1. Driver mở Assignment.
2. Chọn Reject.
3. Nhập rejectReason nếu cần.
4. Assignment = REJECTED.
5. Lưu respondedAt.
6. Loại Driver khỏi vòng tìm kiếm hiện tại.
7. Retry Driver khác.

---

# UC17 – Tạo Trip

Trip được tạo khi Assignment được ACCEPTED.

```text
CREATE Trip
bookingId
customerId
driverId
vehicleId
status = ASSIGNED
```

---

# UC18 – Cập nhật trạng thái Trip

Allowed transitions:

```text
ASSIGNED → ARRIVED
ARRIVED → PICKED_UP
PICKED_UP → IN_PROGRESS
IN_PROGRESS → COMPLETED
```

Ngoài ra:

```text
ASSIGNED → CANCELLED
ARRIVED → CANCELLED
PICKED_UP → CANCELLED
IN_PROGRESS → CANCELLED
```

nếu chính sách cho phép.

Mọi transition không hợp lệ phải bị từ chối.

---

# UC19 – Cập nhật vị trí

1. Driver gửi latitude/longitude.
2. Validate range.
3. Update Driver.currentLatitude.
4. Update Driver.currentLongitude.
5. Update locationUpdatedAt.

Không lưu lịch sử GPS trong MVP.

---

# UC20 – Hủy Trip

1. Actor yêu cầu hủy.
2. Kiểm tra quyền.
3. Kiểm tra trạng thái.
4. Kiểm tra policy.
5. UPDATE Trip.status = CANCELLED.
6. Lưu cancelledAt.
7. Lưu cancelledBy.
8. Lưu cancellationReason.
9. Driver → AVAILABLE nếu phù hợp.
10. Gửi Notification.

---

# UC21 – Hoàn thành Trip

1. Driver chọn Complete.
2. Kiểm tra Trip = IN_PROGRESS.
3. UPDATE Trip.status = COMPLETED.
4. completedAt = now.
5. Driver = AVAILABLE.
6. Kích hoạt Fare Calculation.
7. Gửi Notification.

---

# UC22 – Tính cước

**Input:**

```text
Trip
pickup
destination
vehicleType
```

**Output:**

```text
fare
```

Fare được lưu vào:

```text
Trip.fare
```

---

# UC23 – Thanh toán

## Cash

```text
Trip COMPLETED
 ↓
CREATE Payment
 ↓
method = CASH
 ↓
status = SUCCESS/PENDING theo nghiệp vụ
```

## Online

```text
Trip COMPLETED
 ↓
CREATE Payment
 ↓
Gửi Payment Provider
 ↓
SUCCESS / FAILED
 ↓
UPDATE Payment
```

Không lưu card number/CVV.

---

# UC24 – Tra cứu Payment

Operations Staff có permission được xem Payment.

Customer chỉ xem Payment thuộc Trip của mình.

---

# UC25 – Đánh giá Driver

Precondition:

```text
Trip.status = COMPLETED
Payment có thể đã được xử lý
```

Flow:

1. Customer mở Trip.
2. Chọn Rating.
3. Chọn score.
4. Nhập comment.
5. Validate.
6. Kiểm tra chưa có Rating.
7. CREATE Rating.

---

# UC26 – Xem Rating

Driver có thể xem Rating nhận được.

Operations Staff có permission có thể xem.

---

# UC27 – Xem Notification

1. Query Notification theo recipient.
2. Sort createdAt DESC.
3. Hiển thị.

---

# UC28 – Đánh dấu Notification đã đọc

```text
isRead = true
readAt = now
```

---

# UC29 – Xử lý Incident

1. Staff mở Incident.
2. Kiểm tra permission.
3. Xem Trip liên quan.
4. Cập nhật type/description.
5. Cập nhật status.
6. Ghi resolution.
7. UPDATE resolvedAt.
8. Lưu AuditLog.

---

# UC30 – Quản lý Customer

Operations Staff có thể:

```text
View
Search
Filter
View Detail
```

Administrator có thể thực hiện thêm thao tác quản trị theo permission.

---

# UC31 – Quản lý Driver

Operations Staff có thể:

```text
View
Search
Filter
View Detail
View Status
```

---

# UC32 – Quản lý Vehicle

Operations Staff có thể:

```text
View
Search
Filter
View Detail
Update Status
```

---

# UC33 – Theo dõi Trip

Operations Staff có thể xem:

```text
Trip ID
Customer
Driver
Vehicle
Pickup
Destination
Status
Fare
Created At
```

---

# UC34 – Quản lý Account

Administrator có thể:

```text
View
Search
Lock
Unlock
Disable
Enable
Assign Role
```

Mọi thao tác nhạy cảm phải ghi AuditLog.

---

# UC35 – Quản lý Role

Administrator có thể:

```text
Create
Read
Update
Assign
```

Không cho xóa Role hệ thống đang được sử dụng nếu gây mất tính toàn vẹn quyền.

---

# UC36 – Quản lý Permission

Administrator có thể:

```text
View
Create
Update
Assign to Role
```

---

# UC37 – Xem AuditLog

Administrator xem:

```text
actor
action
target
timestamp
details
```

AuditLog không cho chỉnh sửa thông qua UI thông thường.

---

# UC38 – Dashboard

Management User xem:

```text
Total Trips
Completed Trips
Cancelled Trips
Revenue
Completion Rate
Cancellation Rate
Driver Metrics
```

---

# UC39 – Báo cáo Trip

Cho phép:

```text
Filter From Date
Filter To Date
Filter Status
```

---

# UC40 – Báo cáo doanh thu

Chỉ tính:

```text
Payment.status = SUCCESS
```

---

# UC41 – Báo cáo Driver

Các chỉ số:

```text
Assigned Trips
Accepted Trips
Completed Trips
Cancelled Trips
Acceptance Rate
Average Rating
```

Nếu không đủ dữ liệu, hiển thị `N/A` hoặc trạng thái chưa đủ dữ liệu.

---

# 27. Business Rules

| Mã      | Rule                                                                  |
| ------- | --------------------------------------------------------------------- |
| BRULE01 | Customer phải đăng nhập mới được tạo Booking                          |
| BRULE02 | Booking phải có pickup, destination và vehicleType                    |
| BRULE03 | Chỉ Driver AVAILABLE mới được matching                                |
| BRULE04 | Driver phải có Vehicle phù hợp                                        |
| BRULE05 | Driver gần pickup được ưu tiên                                        |
| BRULE06 | Driver BUSY không được nhận Booking mới                               |
| BRULE07 | Driver chỉ được thực hiện một Trip tại một thời điểm                  |
| BRULE08 | Driver REJECT phải được loại khỏi Assignment hiện tại                 |
| BRULE09 | Driver TIMEOUT phải được loại khỏi Assignment hiện tại                |
| BRULE10 | Một Booking có thể có nhiều Assignment                                |
| BRULE11 | Một Booking chỉ được tạo tối đa một Trip đang active                  |
| BRULE12 | Một Booking chỉ được một Driver ACCEPT thành công                     |
| BRULE13 | Trip phải tuân thủ state transition                                   |
| BRULE14 | Trip COMPLETED không được quay lại trạng thái trước                   |
| BRULE15 | Trip CANCELLED không được tiếp tục                                    |
| BRULE16 | Chỉ Trip COMPLETED mới được tính cước                                 |
| BRULE17 | Một Trip chỉ có tối đa một Payment SUCCESS                            |
| BRULE18 | Không lưu thông tin thẻ nhạy cảm                                      |
| BRULE19 | Chỉ Trip COMPLETED mới được Rating                                    |
| BRULE20 | Một Trip chỉ có tối đa một Rating                                     |
| BRULE21 | Customer chỉ xem dữ liệu của mình                                     |
| BRULE22 | Driver chỉ quản lý Vehicle thuộc mình                                 |
| BRULE23 | Permission được kiểm tra ở backend                                    |
| BRULE24 | Không tin tưởng permission từ frontend                                |
| BRULE25 | Admin thao tác nhạy cảm phải được AuditLog                            |
| BRULE26 | Revenue chỉ tính Payment SUCCESS                                      |
| BRULE27 | Report phải xác định time range                                       |
| BRULE28 | Driver phải AVAILABLE mới chuyển sang nhận Trip                       |
| BRULE29 | Khi Trip kết thúc hoặc bị hủy hợp lệ, Driver có thể trở lại AVAILABLE |
| BRULE30 | Notification failure không được rollback transaction nghiệp vụ chính  |

---

# 28. Exception Rules

## Booking

* Thiếu pickup → reject.
* Thiếu destination → reject.
* Vehicle type invalid → reject.
* Customer inactive → reject.

## Assignment

* Không có Driver → NO_DRIVER_FOUND.
* Driver reject → retry.
* Driver timeout → retry.
* Driver đã nhận Trip khác → reject Assignment.
* Booking đã được Driver khác nhận → reject accept.

## Trip

* State transition invalid → reject.
* Driver không sở hữu Trip → reject.
* Trip không tồn tại → 404.
* Trip đã completed → không update.

## Payment

* Trip chưa completed → reject.
* Payment đã success → không tạo success thứ hai.
* Provider timeout → Payment PENDING/FAILED tùy policy.
* Provider failure → FAILED.

## Rating

* Trip chưa completed → reject.
* Trip không thuộc Customer → reject.
* Đã Rating → reject.

---

# 29. Transaction Boundaries

Các nghiệp vụ sau phải được xử lý trong transaction database khi có nhiều thay đổi liên quan.

## Accept Driver

```text
BEGIN TRANSACTION

Lock Booking
Lock Driver

Check Booking = SEARCHING
Check Driver = AVAILABLE

Assignment = ACCEPTED
Booking = ASSIGNED
Create Trip
Driver = BUSY

COMMIT
```

Nếu lỗi:

```text
ROLLBACK
```

---

# 30. Data Integrity

Các constraint quan trọng:

```text
Customer.phone UNIQUE
Customer.email UNIQUE

Driver.phone UNIQUE
Driver.email UNIQUE

Vehicle.licensePlate UNIQUE

Payment.tripId UNIQUE WHERE status = SUCCESS

Rating.tripId UNIQUE

BookingAssignment.bookingId FK
BookingAssignment.driverId FK

Trip.bookingId FK
Trip.driverId FK
Trip.vehicleId FK
```

---

# 31. Security Requirements

## NFR01 – Authentication

Các chức năng yêu cầu Account phải xác thực.

## NFR02 – Authorization

Backend phải kiểm tra Role/Permission.

## NFR03 – Password Security

Password phải được hash bằng thuật toán phù hợp.

Không lưu plaintext password.

## NFR04 – Payment Security

Không lưu:

```text
Card Number
CVV
PIN
```

## NFR05 – Data Isolation

Customer không được đọc dữ liệu Customer khác.

Driver không được đọc dữ liệu Driver khác nếu không có permission.

## NFR06 – Audit

Thao tác quản trị quan trọng phải được ghi AuditLog.

## NFR07 – Input Validation

Dữ liệu phải được validate ở backend.

---

# 32. Performance Requirements

## NFR08

API thông thường nên phản hồi trong khoảng thời gian phù hợp với môi trường MVP.

## NFR09

Driver matching phải hạn chế query không cần thiết.

## NFR10

Danh sách lớn phải hỗ trợ pagination.

## NFR11

Report có thể dùng aggregation query thay vì load toàn bộ record vào application.

---

# 33. Availability

Nếu Notification Provider lỗi:

```text
Trip vẫn được cập nhật.
```

Nếu Payment Provider lỗi:

```text
Trip không bị rollback.
Payment được đánh dấu phù hợp.
```

Nếu Driver Matching lỗi:

```text
Booking được giữ ở trạng thái phù hợp
và Operations Staff có thể kiểm tra.
```

---

# 34. Logging

Application phải log:

* Authentication failure.
* Authorization failure.
* Booking matching failure.
* Assignment failure.
* Payment provider error.
* Notification provider error.
* Unexpected exception.

Không log:

* Password.
* Card number.
* CVV.
* Token nhạy cảm.

---

# 35. API-Oriented Requirements

Backend nên tổ chức API theo resource.

```text
/auth
/customers
/drivers
/vehicles
/bookings
/booking-assignments
/trips
/payments
/ratings
/notifications
/incidents
/roles
/permissions
/audit-logs
/reports
```

---

# 36. Suggested API

## Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/logout
```

## Profile

```text
GET /me
PUT /me
PUT /me/password
```

## Booking

```text
POST /bookings
GET /bookings
GET /bookings/{id}
POST /bookings/{id}/cancel
```

## Driver Assignment

```text
POST /bookings/{id}/match
POST /assignments/{id}/accept
POST /assignments/{id}/reject
```

## Trip

```text
GET /trips
GET /trips/{id}
PATCH /trips/{id}/status
PATCH /trips/{id}/location
POST /trips/{id}/cancel
POST /trips/{id}/complete
```

## Payment

```text
POST /trips/{id}/payment
GET /payments/{id}
```

## Rating

```text
POST /trips/{id}/rating
GET /drivers/{id}/ratings
```

## Notification

```text
GET /notifications
PATCH /notifications/{id}/read
```

## Incident

```text
POST /incidents
GET /incidents
GET /incidents/{id}
PATCH /incidents/{id}
```

## Report

```text
GET /reports/trips
GET /reports/revenue
GET /reports/drivers
GET /reports/dashboard
```

---

# 37. UI Modules

## Customer

```text
Login
Register
Home
Book Ride
Booking Detail
Trip Tracking
Trip History
Payment
Rating
Notifications
Profile
```

## Driver

```text
Login
Dashboard
Availability
Trip Requests
Current Trip
Trip History
Vehicle
Profile
Notifications
```

## Operations

```text
Dashboard
Customers
Drivers
Vehicles
Trips
Payments
Incidents
```

## Administrator

```text
Users
Roles
Permissions
Audit Logs
```

## Management

```text
Dashboard
Trip Reports
Revenue Reports
Driver Reports
```

---

# 38. Acceptance Criteria

## AC01 – Register

| Given            | When     | Then             |
| ---------------- | -------- | ---------------- |
| Dữ liệu hợp lệ   | Register | Account được tạo |
| Email tồn tại    | Register | Reject           |
| Phone tồn tại    | Register | Reject           |
| Password invalid | Register | Reject           |

## AC02 – Login

| Given                          | When  | Then       |
| ------------------------------ | ----- | ---------- |
| Account active + password đúng | Login | Thành công |
| Password sai                   | Login | Reject     |
| Account disabled               | Login | Reject     |

## AC03 – Booking

| Given                | When           | Then             |
| -------------------- | -------------- | ---------------- |
| Customer active      | Create Booking | Booking được tạo |
| Thiếu pickup         | Create         | Reject           |
| Thiếu destination    | Create         | Reject           |
| Vehicle type invalid | Create         | Reject           |

## AC04 – Assignment

| Given            | When     | Then                |
| ---------------- | -------- | ------------------- |
| Driver available | Matching | Assignment được tạo |
| Driver accept    | Accept   | Booking ASSIGNED    |
| Driver reject    | Reject   | Retry               |
| Driver timeout   | Timeout  | Retry               |
| Không còn Driver | Matching | NO_DRIVER_FOUND     |

## AC05 – Concurrent Accept

| Given                  | When               | Then                      |
| ---------------------- | ------------------ | ------------------------- |
| Hai Driver cùng Accept | Concurrent request | Chỉ một Driver thành công |

## AC06 – Trip

| Given       | When        | Then       |
| ----------- | ----------- | ---------- |
| ASSIGNED    | ARRIVED     | Thành công |
| ARRIVED     | PICKED_UP   | Thành công |
| PICKED_UP   | IN_PROGRESS | Thành công |
| IN_PROGRESS | COMPLETED   | Thành công |
| COMPLETED   | IN_PROGRESS | Reject     |

## AC07 – Payment

| Given                   | When        | Then             |
| ----------------------- | ----------- | ---------------- |
| Trip COMPLETED          | Payment     | Thành công       |
| Trip chưa COMPLETED     | Payment     | Reject           |
| Provider success        | Callback    | SUCCESS          |
| Provider failed         | Callback    | FAILED           |
| Payment SUCCESS tồn tại | Payment lại | Reject duplicate |

## AC08 – Rating

| Given               | When         | Then       |
| ------------------- | ------------ | ---------- |
| Trip COMPLETED      | Rating       | Thành công |
| Trip chưa completed | Rating       | Reject     |
| Đã Rating           | Rating lần 2 | Reject     |

## AC09 – Authorization

| Given                      | When    | Then     |
| -------------------------- | ------- | -------- |
| User có permission         | Request | Cho phép |
| User không có permission   | Request | 403      |
| Customer xem Customer khác | Request | 403/404  |

## AC10 – Incident

| Given                     | When            | Then                |
| ------------------------- | --------------- | ------------------- |
| Staff có permission       | Create Incident | Thành công          |
| Staff không có permission | Create          | 403                 |
| Incident resolved         | Update          | resolvedAt được lưu |

---

# 39. Reporting Definitions

## Total Trips

```text
COUNT(Trip)
```

trong khoảng thời gian được chọn.

## Completed Trips

```text
COUNT(Trip WHERE status = COMPLETED)
```

## Cancelled Trips

```text
COUNT(Trip WHERE status = CANCELLED)
```

## Revenue

```text
SUM(Payment.amount)
WHERE Payment.status = SUCCESS
```

## Completion Rate

```text
completedTrips / totalTrips * 100
```

## Cancellation Rate

```text
cancelledTrips / totalTrips * 100
```

## Driver Metrics

Bao gồm:

```text
assignedTrips
acceptedTrips
completedTrips
cancelledTrips
acceptanceRate
averageRating
```

---

# 40. State Definitions

## Booking Status

```text
SEARCHING
ASSIGNED
CANCELLED
NO_DRIVER_FOUND
```

## Assignment Status

```text
SENT
ACCEPTED
REJECTED
TIMEOUT
CANCELLED
```

## Trip Status

```text
ASSIGNED
ARRIVED
PICKED_UP
IN_PROGRESS
COMPLETED
CANCELLED
```

## Driver Status

```text
OFFLINE
AVAILABLE
BUSY
```

## Vehicle Status

```text
ACTIVE
INACTIVE
```

## Payment Status

```text
PENDING
SUCCESS
FAILED
CANCELLED
```

## Incident Status

```text
OPEN
INVESTIGATING
RESOLVING
RESOLVED
CLOSED
```

---

# 41. Source of Truth cho từng dữ liệu

| Dữ liệu                   | Source of Truth            |
| ------------------------- | -------------------------- |
| Customer profile          | Customer                   |
| Driver profile            | Driver                     |
| Driver current location   | Driver                     |
| Vehicle                   | Vehicle                    |
| Customer request          | Booking                    |
| Driver assignment history | BookingAssignment          |
| Actual ride               | Trip                       |
| Fare                      | Trip                       |
| Payment transaction       | Payment                    |
| Rating                    | Rating                     |
| Notification              | Notification               |
| Operational incident      | Incident                   |
| Authorization             | Role + Permission          |
| Admin activity            | AuditLog                   |
| Management metrics        | Aggregation từ domain data |

---

# 42. Nguyên tắc quan trọng cho Implementation

## Rule 1

Không dùng Booking để lưu lịch sử phân công Driver.

```text
Booking
   ↓
BookingAssignment
```

## Rule 2

Không dùng Trip để lưu request chưa được Driver nhận.

```text
Booking = request
Trip = actual ride
```

## Rule 3

Không tạo ManagementReport table trong MVP nếu báo cáo chỉ là dữ liệu aggregate.

## Rule 4

Không xóa vật lý các entity lịch sử quan trọng.

Ưu tiên:

```text
status = INACTIVE
```

## Rule 5

Backend là nơi quyết định quyền.

Frontend chỉ dùng permission để hiển thị UI.

## Rule 6

Mọi state transition phải được validate ở backend.

## Rule 7

Notification là side effect.

Nếu Notification lỗi, không rollback nghiệp vụ chính.

## Rule 8

Payment Provider là external dependency.

Không để lỗi Payment Provider làm mất Trip.

## Rule 9

Assignment phải có transaction/locking khi Driver Accept.

## Rule 10

Mọi API phải kiểm tra ownership hoặc permission.

---

# 43. Vibe Coding Architecture

Hệ thống nên được chia thành các module:

```text
Authentication
Profile
Vehicle
Booking
Driver Matching
Assignment
Trip
Payment
Rating
Notification
Incident
Operations
Administration
Reporting
```

Mỗi module nên có:

```text
Controller
Service
Repository / Data Access
Model / Entity
Validation
Policy / Authorization
Tests
```

Không nên để toàn bộ business logic trong Controller.

---

# 44. Recommended Service Layer

```text
AuthService
ProfileService
VehicleService

BookingService
DriverMatchingService
AssignmentService

TripService
FareService

PaymentService
RatingService

NotificationService
IncidentService

ReportService
AuditService
```

---

# 45. Core Business Flow cho AI Coding

AI phải hiểu flow sau là flow quan trọng nhất:

```text
1. Customer tạo Booking
        ↓
2. Booking = SEARCHING
        ↓
3. DriverMatchingService tìm Driver
        ↓
4. Tạo BookingAssignment
        ↓
5. Gửi request
        ↓
6. Driver ACCEPT / REJECT / TIMEOUT
        ↓
7. Nếu REJECT/TIMEOUT → Assignment tiếp theo
        ↓
8. Nếu ACCEPT
        ↓
9. Transaction:
       Assignment = ACCEPTED
       Booking = ASSIGNED
       Trip = CREATED
       Driver = BUSY
        ↓
10. Driver cập nhật:
       ARRIVED
       PICKED_UP
       IN_PROGRESS
       COMPLETED
        ↓
11. Trip COMPLETED
        ↓
12. FareService tính fare
        ↓
13. PaymentService xử lý payment
        ↓
14. Customer Rating
        ↓
15. Reporting lấy dữ liệu tổng hợp
```

---

# 46. MVP Priority

## P0 – Bắt buộc

```text
Authentication
Customer
Driver
Vehicle
Booking
BookingAssignment
Trip
Fare
Payment
Rating
```

## P1 – Quan trọng

```text
Notification
Operations
Incident
RBAC
AuditLog
```

## P2 – Báo cáo

```text
Dashboard
Trip Report
Revenue Report
Driver Report
```

---

# 47. Không được tự ý mở rộng khi Coding

AI không được tự ý thêm:

```text
Coupon
Voucher
Wallet
Subscription
Loyalty
Chat
Referral
Surge Pricing
Advanced GPS History
Driver Salary
Accounting
```

nếu không có yêu cầu mới.

---

# 48. Definition of Done

Một feature chỉ được xem là hoàn thành khi:

* [ ] Database schema tồn tại.
* [ ] Migration hoàn chỉnh.
* [ ] Model/Entity hoàn chỉnh.
* [ ] Validation hoàn chỉnh.
* [ ] Authorization hoàn chỉnh.
* [ ] Service xử lý business logic.
* [ ] API hoàn chỉnh.
* [ ] Error handling.
* [ ] State transition được kiểm tra.
* [ ] Transaction được sử dụng khi cần.
* [ ] Notification side effect được xử lý.
* [ ] AuditLog được ghi nếu cần.
* [ ] Test case chính tồn tại.
* [ ] Không phá vỡ feature hiện tại.

---

# 49. Final Domain Architecture

```text
                         ┌───────────────┐
                         │    Account    │
                         └───────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    ↓            ↓            ↓
                Customer       Driver       Admin
                                 │
                                 ↓
                              Vehicle

Customer
   │
   │ creates
   ↓
Booking
   │
   │ 1:N
   ↓
BookingAssignment
   │
   ├──── Driver A → REJECTED
   ├──── Driver B → TIMEOUT
   └──── Driver C → ACCEPTED
                         │
                         ↓
                        Trip
                         │
          ┌──────────────┼──────────────┐
          ↓              ↓              ↓
       Payment         Rating        Incident
          │
          ↓
      Transaction

Trip
 │
 └──── Notification

Driver
 │
 └──── currentLocation

Trip + Payment + Driver + Rating
                │
                ↓
           Reporting

Admin
 │
 ├──── Role
 ├──── Permission
 └──── AuditLog
```

---

# 50. Final Business Flow

```text
┌─────────────────────┐
│      CUSTOMER       │
└──────────┬──────────┘
           │
           ↓
     Create Booking
           │
           ↓
     SEARCHING
           │
           ↓
┌─────────────────────┐
│ DRIVER MATCHING     │
└──────────┬──────────┘
           │
           ↓
 BookingAssignment
           │
      ┌────┴────┐
      ↓         ↓
   ACCEPT     REJECT/TIMEOUT
      │         │
      │         └────→ Retry
      ↓
   ASSIGNED
      │
      ↓
     TRIP
      │
      ↓
   ARRIVED
      │
      ↓
  PICKED_UP
      │
      ↓
 IN_PROGRESS
      │
      ↓
  COMPLETED
      │
      ├──────────────→ Calculate Fare
      │                       │
      │                       ↓
      │                    Payment
      │                       │
      │                       ↓
      │                    Rating
      │
      └──────────────→ Notification

          ┌───────────────────────┐
          │ OPERATIONS / ADMIN    │
          └───────────┬───────────┘
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
       Incident     Audit      Operations

          ┌───────────────────────┐
          │     MANAGEMENT        │
          └───────────┬───────────┘
                      ↓
                  Reporting
```

---

# 51. Tóm tắt Database cuối cùng

MVP sử dụng các entity chính:

```text
1. Customer
2. Driver
3. Vehicle
4. Booking
5. BookingAssignment
6. Trip
7. Payment
8. Rating
9. Notification
10. Incident
11. Role
12. Permission
13. UserRole
14. AuditLog
```

Không bắt buộc:

```text
ManagementReport
TripLocation
Fare
```

vì:

* `ManagementReport` là aggregation.
* `TripLocation` chưa cần cho MVP.
* `Fare` có thể lưu trực tiếp ở `Trip.fare`.

---

# 52. SRS Baseline

Từ thời điểm này, nếu có mâu thuẫn giữa code và tài liệu, ưu tiên kiểm tra theo thứ tự:

```text
1. Business Rules
2. Domain Model
3. State Machine
4. Functional Requirements
5. Use Cases
6. API
7. UI
```

Business logic không được tự ý thay đổi chỉ vì UI hoặc API thuận tiện hơn.

Nếu cần thay đổi nghiệp vụ, phải cập nhật SRS trước khi thay đổi implementation.
