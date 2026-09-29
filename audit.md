# AUDIT vòng 2 — Kiểm tra lại `02_srs_simplified.md` + `03_microservice_design_simplified.md` sau khi đã sửa theo `05_audit_phieucham_design.md`

> Phạm vi: chỉ 2 file thiết kế, không đụng code. Mục tiêu: xác nhận 8 gap của lần audit trước (file `05`) đã được vá đúng chưa, và soát lại toàn bộ 2 file 1 lần nữa để tìm vấn đề còn sót — bằng cách đọc lại từng dòng và chạy kiểm tra tự động (không chỉ đọc mắt).
> Kết luận ngắn: **8/8 gap cũ đã được vá đúng nội dung**, nhưng thao tác sửa làm phát sinh **1 lỗi định dạng markdown thật** (bảng bị vỡ), và có thêm **3 điểm nên làm rõ** để người code không phải đoán.

---

## 1. Xác nhận 8 gap cũ đã sửa chưa

| Gap (từ file `05`) | Yêu cầu sửa | Đã sửa ở đâu | Kết quả |
|---|---|---|:-:|
| A — đăng ký không tạo được profile | Thêm `POST /internal/accounts`, `POST /internal/customers`, viết rõ 2 luồng orchestration | `02` FR-10, FR-15; `03` mục 5.1, 6.1, 6.2 | ✅ Đúng |
| B — không ai tạo Trip khi offer accept | Xóa dòng IPC sai hướng, thêm `POST /internal/trips`, viết luồng 7 bước | `03` mục 5.1 (dòng 152), mục 6.3 (luồng 7 bước) | ✅ Đúng |
| C — `bookings` thiếu `trip_id` | Thêm cột | `03` mục 6.3, dòng `bookings` schema | ✅ Đúng |
| D — SQL accept thiếu `driver_id` | Thêm điều kiện | `03` mục 6.3, câu SQL đã có `AND driver_id = :callerId` | ✅ Đúng |
| E — thiếu API lấy driver snapshot mới | Thêm `GET /internal/drivers/:id` | `03` mục 5.1 (dòng 150), mục 6.2 | ✅ Đúng |
| F — `bookings` thiếu idempotency | Ghi rõ Redis cho booking, DB cho payment | `02` FR-46; `03` mục 6.3 | ✅ Đúng |
| G — chưa phân định ownership-check gateway vs service | Thêm nguyên tắc | `02` BR-13; `03` mục 4.3 | ✅ Đúng |
| H — `phone_hash` dò ngược được | Đổi sang HMAC + pepper | `02` NFR-01; `03` mục 6.1 | ✅ Đúng |

Không có gap nào bị sửa nửa vời hay sửa 1 chỗ quên chỗ kia — đã đối chiếu chéo cả 2 file cho từng gap.

---

## 2. Vấn đề MỚI phát hiện ở vòng audit này

### 2.1. Lỗi thật — bảng IPC bị vỡ do thao tác chèn văn bản (mức: phải sửa)

Chạy kiểm tra tự động (quét dòng bảng markdown bị tách khỏi bảng bởi 1 đoạn văn xen giữa) trên cả 2 file, phát hiện đúng 1 chỗ lỗi, nằm ở `03_microservice_design_simplified.md`:

```text
154 | payment-service | trip-service | GET /internal/trips/:id | ... |
155 (dòng trống)
156 **Lưu ý về hướng gọi**: ... tránh phụ thuộc ngược chiều và một lời gọi round-trip thừa.
157 | gateway | tất cả | GET /health, GET /ready | Health aggregation |
```

Dòng 157 (`gateway | tất cả | ...`) vốn là dòng cuối của bảng IPC gốc, nhưng khi mình chèn đoạn "Lưu ý về hướng gọi" vào ngay trước nó, dòng này bị **tách rời khỏi bảng** bởi 1 đoạn văn xuôi ở giữa — markdown coi đây là bảng đã kết thúc ở dòng 154, và dòng 157 trở thành rác không thuộc bảng nào, sẽ hiển thị sai (tùy renderer, có thể ra bảng 1 dòng riêng hoặc hiện nguyên ký tự `|`). Đây là lỗi mình gây ra khi chỉnh sửa ở bước trước, không phải lỗi có sẵn.

**Cách sửa**: chuyển dòng `gateway | tất cả | ...` lên trước đoạn "Lưu ý về hướng gọi", để nó nằm liền kề các dòng bảng khác:

```text
| `payment-service` | `trip-service` | `GET /internal/trips/:id` | Lấy `fare` thật, không tin số tiền client gửi |
| gateway | tất cả | `GET /health`, `GET /ready` | Health aggregation |

**Lưu ý về hướng gọi**: ...
```

### 2.2. Chưa nói rõ ai hash password trong luồng đăng ký Driver (mức: nên làm rõ)

Mục 6.2, luồng đăng ký Driver bước 4:
```text
4. user-service gọi NỘI BỘ identity-service: POST /internal/accounts (role=DRIVER, phone, passwordHash)
```
Nhưng bước 2 (client gửi) chỉ có field `password` (plaintext) — không nói rõ **user-service** là nơi tự chạy `bcrypt.hash(password)` trước khi gọi bước 4, hay nó chuyển tiếp `password` thô sang đâu đó khác để hash. Vì `POST /internal/accounts` (mục 6.1) khai báo input là `passwordHash` (đã hash), người code cần biết rõ trách nhiệm hash nằm ở user-service. Nếu không ghi rõ, có khả năng lập trình viên (hoặc AI code) hiểu lầm thành gửi `password` thô qua nội bộ rồi để identity-service hash — vẫn hoạt động về mặt bảo mật (miễn nội bộ network không lộ), nhưng sai với đúng field `passwordHash` đã khai báo, gây lỗi khi implement.

**Đề xuất câu chữ thêm vào bước 4**: *"user-service tự `bcrypt.hash(password, 10)` trước khi gọi, vì `POST /internal/accounts` chỉ nhận `passwordHash` đã hash sẵn, không nhận plaintext."*

### 2.3. `registrationToken` chưa khai báo rõ claim bên trong (mức: nên làm rõ)

`02_srs_simplified.md` mục 4.4 và `03` mục 6.2 đều nhắc tới `registrationToken` là JWT ký bằng `JWT_SECRET` dùng chung, nhưng không chỗ nào liệt kê **claim cụ thể** bên trong token này. Nếu không khai báo, mỗi service có thể tự đặt tên field khác nhau (`phone` vs `phoneNumber`, `purpose` vs `type`...), gây lỗi khi user-service tự verify token do identity-service phát hành.

**Đề xuất thêm 1 dòng vào mục 6.1 (chỗ mô tả `POST /auth/driver/otp/verify`)**:
```text
registrationToken = JWT { phone, purpose: "driver_registration", exp: now + 15p }, ký HS256 bằng JWT_SECRET
```

### 2.4. Truy vấn phân trang chưa có bước đếm `total` (mức: nhỏ, không bắt buộc phải sửa)

Câu SQL Haversine ở mục 6.2 chỉ có `LIMIT :limit OFFSET :offset`, chưa kèm câu đếm tổng số dòng thỏa điều kiện để điền `pagination.total`/`totalPages` (yêu cầu chung ở NFR-10). Đây là chi tiết cài đặt (cần thêm 1 câu `SELECT COUNT(*) ...` cùng điều kiện `WHERE`/`HAVING`), không ảnh hưởng đến tính đúng của thiết kế, nên có thể để lập trình viên tự suy ra khi code — không bắt buộc sửa tài liệu, nêu ra để không quên khi implement.

---

## 3. Rà lại các điểm dễ vỡ khác (đã kiểm tra, không có vấn đề)

Đã kiểm tra thêm các nghi vấn sau từ kinh nghiệm audit vòng 1, xác nhận **không** phát sinh vấn đề mới:

| Điểm kiểm tra | Kết quả |
|---|:-:|
| Số endpoint public ở mục 8 (`03`) có còn khớp 31 sau khi thêm internal API không (thêm internal API không được tính trùng vào endpoint public) | ✅ Vẫn đúng 31, đã đếm lại từng mục 6.1–6.6 |
| Enum `vehicle_type` có đồng nhất giữa `02` (BR-02) và `03` (bảng `drivers`, `bookings`) không | ✅ Cả 2 đều `BIKE, SEDAN, SUV` |
| Enum trạng thái Trip/Booking có đồng nhất chính tả (`CANCELED` 1 chữ L) giữa `02` và `03` không | ✅ Đồng nhất |
| File `04_audit.md` có bị tham chiếu treo (link tới mục không tồn tại) sau khi sửa không | ✅ Mục 4.3 của `03` trỏ đúng `04_audit.md` mục 2.2, mục đó vẫn tồn tại |
| Có bảng markdown nào khác bị vỡ giống mục 2.1 không (quét toàn bộ 2 file bằng script) | ✅ Không còn chỗ nào khác |

---

## 4. Việc cần làm

| # | Việc | Bắt buộc? |
|---|---|:-:|
| 1 | Di chuyển dòng `gateway \| tất cả \| ...` lên trước đoạn "Lưu ý về hướng gọi" trong bảng IPC (`03` mục 5.1) | Bắt buộc — bảng đang vỡ |
| 2 | Thêm 1 câu vào bước 4 của luồng đăng ký Driver (`03` mục 6.2): user-service tự hash password trước khi gọi `POST /internal/accounts` | Nên làm |
| 3 | Thêm khai báo claim của `registrationToken` vào mục 6.1 | Nên làm |
| 4 | Ghi chú cần thêm câu `COUNT(*)` cho pagination bên cạnh câu Haversine | Tùy chọn, để lúc code |

Sau khi sửa mục 1 (bắt buộc), 2 file thiết kế đã sẵn sàng để lập trình theo, không còn lỗ hổng kiến trúc nào ảnh hưởng tới việc chạy được 30 tiêu chí.
