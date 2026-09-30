# CAB SYSTEM — MÔ TẢ 30 TIÊU CHÍ CHẤM THEO SRS v1.2

| STT | Tiêu chí | Mô tả/điều phải kiểm tra | Kết quả mong đợi | SRS |
|---:|---|---|---|---|
| 1 | Project structure / API / Postman / docs | Trình bày cấu trúc source, Gateway, microservice, Postman, test và documentation. | Source được tổ chức rõ ràng, có API/Test/Postman/Docs phục vụ kiểm tra. | UC61, FR-S14 |
| 2 | Không commit secret / file rác | Kiểm tra `.gitignore`, `.env`, secret, API key và file rác trong repository/image. | Secret không xuất hiện trong source/repository/image; cấu hình nhạy cảm dùng env/secret. | FR-S05, BR-S04 |
| 3 | Gateway routing, auth, RBAC, rate limit | Kiểm tra Gateway route request, verify JWT, RBAC và rate limit. | Request đi qua Gateway, sai token/quyền bị từ chối, endpoint cần bảo vệ có rate limit. | UC59, FR-S02–FR-S03 |
| 4 | Internal REST | Kiểm tra synchronous communication giữa các service. | Internal service dùng REST cho synchronous call; client không gọi trực tiếp internal service. | FR-S06 |
| 5 | Docker Compose | Khởi động toàn hệ thống bằng Docker Compose. | Các service/container cần thiết khởi động và giao tiếp được. | UC60, FR-S04 |
| 6 | Health/Ready | Gọi health/ready của Gateway và service. | Endpoint health/ready trả trạng thái hợp lệ. | UC58, FR-S01 |
| 7 | Message broker | Kiểm tra Kafka publish/subscribe và Notification Service consume event. | Event được publish/consume đúng; consumer có retry/idempotency/DLQ; notification được tạo từ event. | FR-S06, FR-K01–FR-K04 |
| 8 | Gateway security | Thử bypass Gateway/gọi trực tiếp internal service và kiểm tra security boundary. | Client không được bypass Gateway; routing/auth/RBAC được áp dụng đúng. | UC59, FR-S02–FR-S03 |
| 9 | Customer registration | Tạo Customer bằng dữ liệu hợp lệ. | Customer account/profile được tạo thành công. | UC01, FR-C01 |
| 10 | Login/JWT | Đăng nhập bằng account hợp lệ và sử dụng JWT cho API protected. | Login thành công trả JWT; JWT hợp lệ được chấp nhận. | UC02, FR-C02 |
| 11 | Customer profile | Dùng token lấy profile Customer. | Đúng ownership; Customer không xem resource của người khác nếu không có quyền. | UC03, FR-C03, BR-C02 |
| 12 | Driver profile | Dùng token lấy profile Driver. | Token/permission/ownership được kiểm tra; trả đúng hồ sơ Driver. | UC14, FR-D04, BR-S01 |
| 13 | Driver nearby / location | Tạo nhiều Driver với vị trí/trạng thái khác nhau; query quanh tọa độ, radius, status và paging. | Trả đúng Driver trong phạm vi; hỗ trợ radius/filter/paging; location của Driver được cập nhật hợp lệ. | UC04, UC16, FR-C04, FR-D06 |
| 14 | Customer Booking list | Customer lấy danh sách Booking của mình bằng token. | Chỉ Booking thuộc Customer; hỗ trợ `page` và `limit`, response có pagination. | UC05, FR-C05 |
| 15 | Booking / matching | Customer tạo Booking; hệ thống tìm Driver phù hợp và tạo Offer. | Booking hợp lệ, vào `SEARCHING`, tìm Driver phù hợp và tạo Offer. | UC06, FR-C06–FR-C07 |
| 16 | Offer / accept | Driver nhận Offer và accept. | Offer chuyển hợp lệ; Booking/Trip được gán Driver; notification được phát. | UC17–UC18, FR-D07–FR-D08 |
| 17 | Trip lifecycle | Driver cập nhật `ASSIGNED → ARRIVED → IN_PROGRESS → COMPLETED`, location được cập nhật. | State transition đúng; chỉ Driver được phân công mới thao tác được. | UC07, UC19, FR-C08, FR-D09 |
| 18 | Trip cancellation | Customer/Driver hủy khi state cho phép, bắt buộc có reason. | Trip/Booking chuyển `CANCELED`; reason hợp lệ; notification event được phát. | UC08, UC20, FR-C09, FR-D10 |
| 19 | Payment / callback | Tạo payment, xử lý tại Payment Provider, callback về hệ thống. | Server xác thực callback; Payment thành công chỉ ghi nhận một lần; callback replay không double charge. | UC09, UC47–UC48, FR-C10, FR-P01–FR-P02 |
| 20 | Review | Customer review Trip sau khi hoàn thành. | Review được lưu đúng Trip; chỉ Trip hợp lệ/COMPLETED mới được review. | UC10, FR-C11 |
| 21 | Driver OTP / onboarding | Request OTP → verify OTP → gửi hồ sơ cá nhân + Vehicle. | OTP đúng policy; hồ sơ vào `PENDING_APPROVAL`; Driver chưa được ONLINE trước approval. | UC12–UC13, FR-D01–FR-D03 |
| 22 | Driver approval | Administrator xem hồ sơ pending và approve/reject. | Driver chuyển trạng thái đúng; có Audit; notification kết quả được tạo. | UC22–UC24, FR-A01–FR-A03 |
| 23 | Driver availability | Driver bật/tắt `ONLINE/OFFLINE`. | Chỉ Driver đủ điều kiện mới được ONLINE; trạng thái dùng cho matching. | UC15, FR-D05 |
| 24 | Bảo vệ dữ liệu nhạy cảm khi lưu trữ | Kiểm tra password, phone, license number và dữ liệu định danh trực tiếp trong DB/config. | Password được hash bằng bcrypt; PII nhạy cảm được encryption at rest; khóa nằm ngoài source code; DB không lộ plaintext. | UC61, FR-S07 |
| 25 | SQL/NoSQL Injection | Gửi payload injection vào các field query/body. | Query không bị bypass; input độc hại bị từ chối/validate; không lộ dữ liệu trái phép. | UC61, FR-S08 |
| 26 | XSS / input injection | Gửi payload HTML/JS vào input. | Payload không được thực thi; dữ liệu được sanitize/encode phù hợp. | UC61, FR-S09 |
| 27 | JWT tampering / invalid token | Sửa payload/signature JWT, thử `alg=none` hoặc token hết hạn. | Request bị từ chối; trả `401`; không thể nâng quyền. | UC61, FR-S10 |
| 28 | Unauthorized resource access | Dùng token hợp lệ nhưng truy cập resource của user/role khác. | Bị từ chối, thường `403`; không trả dữ liệu trái quyền. | UC61, FR-S11 |
| 29 | Rate limit | Gửi request vượt ngưỡng ở endpoint nhạy cảm. | Vượt ngưỡng trả `429 Too Many Requests`; hệ thống vẫn hoạt động. | UC59, UC61, FR-S12 |
| 30 | Replay / idempotency | Gửi lại cùng request/payment callback/event. | Không tạo transaction lần hai; cùng request cho cùng kết quả; duplicate event không tạo duplicate effect. | UC61, FR-S13 |
