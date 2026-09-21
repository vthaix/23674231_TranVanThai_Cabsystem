# CAB System API Test Pack (YAML)

Bộ YAML dùng để test API hệ thống CAB System, chuyển đổi 1:1 từ `CAB_System_TestCases_Final_v2.xlsx` (195 test case), đối chiếu yêu cầu nghiệp vụ với `srs.md`.

## 1. Source of Truth

| Nguồn | Vai trò |
|---|---|
| `srs.md` | Sự thật cho **yêu cầu nghiệp vụ/kỹ thuật** (UC/FR/BR/BRULE/NFR) |
| `CAB_System_TestCases_Final_v2.xlsx` | Sự thật cho **danh sách Test Case** (ID, Scenario, Preconditions, Steps, Test Data, Expected Result, Priority) |

Không có requirement, business rule, hay test case nào trong pack này được tạo ra ngoài 2 nguồn trên.

## 2. Cấu trúc 17 file (1 file = 1 BR)

| File | BR | Số Test Case |
|---|---|---|
| `01_BR01_account.yaml` | BR01 – Account | 14 |
| `02_BR02_profile.yaml` | BR02 – Profile | 9 |
| `03_BR03_vehicle.yaml` | BR03 – Vehicle | 11 |
| `04_BR04_booking.yaml` | BR04 – Booking | 13 |
| `05_BR05_driver_matching.yaml` | BR05 – Driver Matching | 13 |
| `06_BR06_assignment.yaml` | BR06 – Assignment | 9 |
| `07_BR07_trip.yaml` | BR07 – Trip | 21 |
| `08_BR08_tracking.yaml` | BR08 – Tracking | 4 |
| `09_BR09_fare.yaml` | BR09 – Fare | 2 |
| `10_BR10_payment.yaml` | BR10 – Payment | 12 |
| `11_BR11_notification.yaml` | BR11 – Notification | 6 |
| `12_BR12_rating.yaml` | BR12 – Rating | 8 |
| `13_BR13_incident.yaml` | BR13 – Incident | 6 |
| `14_BR14_operations.yaml` | BR14 – Operations | 23 |
| `15_BR15_authorization.yaml` | BR15 – Authorization | 20 |
| `16_BR16_audit.yaml` | BR16 – Audit | 6 |
| `17_BR17_reporting.yaml` | BR17 – Reporting | 18 |
| **Tổng** | | **195** |

`00_MANIFEST.yaml` liệt kê toàn bộ 17 file kèm kết quả validation.

## 3. Cấu hình `${BASE_URL}`

Mỗi file có `base_url: "${BASE_URL}"`. Trước khi chạy, set biến môi trường trỏ tới server đang chạy `cab_backend_nodejs` (hoặc Swagger/mock server tương ứng):

```bash
export BASE_URL="http://localhost:3000"
```

## 4. Cấu hình token

Mỗi file khai báo trong `variables`:

```yaml
variables:
  token: "${TOKEN}"
  admin_token: "${ADMIN_TOKEN}"
  driver_token: "${DRIVER_TOKEN}"
  customer_token: "${CUSTOMER_TOKEN}"
  operations_token: "${OPERATIONS_TOKEN}"
  management_token: "${MANAGEMENT_TOKEN}"   # chỉ có trong file 17 (Reporting), vì chỉ actor Management dùng
```

Set các biến môi trường tương ứng (JWT lấy được từ `POST /login` với tài khoản từng role) trước khi chạy. Test nào Excel/SRS không nêu rõ role cụ thể thì dùng `${TOKEN}` chung — **không tự suy diễn role** theo đúng yêu cầu.

## 5. Ý nghĩa `IMPLEMENTATION_MAPPING_REQUIRED`

`srs.md` mô tả hành vi nghiệp vụ (FR/BRULE) chứ **không định nghĩa HTTP method/URL cụ thể nào**. Do đó **100% test case trong pack này đều mang `mapping_status: IMPLEMENTATION_MAPPING_REQUIRED`** — nghĩa là `api.method`/`api.path` là **đề xuất cần bạn xác nhận/chỉnh lại** theo đúng route thật trước khi chạy, không phải điều SRS quy định.

## 6. Cách map logical API path sang route thực tế

Tôi đã đối chiếu `api.path` với route Express thật trong `cab_backend_nodejs/src/routes/`:

- **26/41 UC có route thật khớp** — `api.path` lấy đúng theo route trong code (ví dụ UC01 → `POST /register`, UC18 → `PATCH /trips/{tripId}/status`).
- **15/41 UC KHÔNG có route thật** trong backend hiện tại (ví dụ UC07-10 Vehicle CRUD, UC29 Incident, UC35-41 Role/Permission/AuditLog/Report) — các test này có thêm field:
  ```yaml
  api:
    note: "NO_MATCHING_BACKEND_ROUTE: <lý do>"
  ```
  Đây là các FR đã có trong `srs.md` (112 FR) nhưng **backend MVP hiện tại chưa implement**. Trước khi chạy các test này trên Swagger, bạn cần tự bổ sung route đó vào backend/OpenAPI spec, hoặc mock lại.

Trước khi chạy trên Swagger: mở từng file YAML, đối chiếu `api.path` với danh sách endpoint thật trong Swagger UI của bạn, sửa `path`/`method` nếu route thật khác, rồi đổi `mapping_status` thành `SRS_DEFINED` **chỉ khi** SRS thực sự quy định route đó (thực tế hiếm khi xảy ra vì SRS này không đặc tả REST API).

## 7. Cách kiểm tra Duplicate Test Case ID

```bash
grep -h "  id: " CAB_System_API_YAML_TestPack/*.yaml | sort | uniq -d
```
Kết quả rỗng = không có duplicate (đã tự kiểm tra khi sinh pack, xem mục 9).

## 8. Cách kiểm tra Missing Test Case

So khớp cột "Test Case ID" trong `CAB_System_TestCases_Final_v2.xlsx` với toàn bộ `id:` trong 17 file YAML (đã làm tự động khi sinh pack — xem `00_MANIFEST.yaml` → `validation`).

## 9. Cách chạy API test sau khi mapping endpoint

Pack này là **specification YAML thuần** (không phải Tavern-runnable trực tiếp, theo đúng cấu trúc tuỳ chỉnh đã yêu cầu). Để chạy:

1. Xác nhận/sửa `api.path`, `api.method` theo route thật trên Swagger.
2. Thay `${BASE_URL}`, `${TOKEN}`, `${*_TOKEN}` bằng giá trị thật (biến môi trường hoặc file `.env`).
3. Với mỗi `test`, gọi `api.method` + `api.path` (đã thay `{param}` bằng ID thật lấy được từ bước trước đó trong luồng, ví dụ `{tripId}`), gắn `headers`, `body` (tham khảo `test_data` để điền payload vì SRS/Excel không cho JSON schema cụ thể).
4. Đối chiếu response với từng dòng trong `assertions` (giữ nguyên tiếng Việt, đúng ý nghĩa gốc từ Excel).
5. Nếu muốn chạy tự động, có thể viết 1 adapter nhỏ (Python/Node) đọc 17 file YAML này và convert sang Tavern/Postman — cấu trúc phẳng, dễ chuyển đổi.

## 10. Giới hạn do SRS chưa định nghĩa HTTP route/method/status code

- **Không có status code nào được ghi cứng** (200/201/400/401/403/404/409/422/500) trừ khi Excel/SRS nêu rõ bằng số — `assertions` chỉ diễn đạt lại đúng ý Expected Result gốc (ví dụ "Hệ thống reject" → *"He thong reject"*, không tự suy ra "HTTP 409").
- **`body` luôn để `{}`** — SRS/Excel không cho JSON schema cụ thể của request; dùng `test_data` (lấy nguyên văn từ cột Test Data) làm cơ sở tự điền payload khi test thật.
- **NFR08/NFR09** (`TC_NFR08_RESPONSE`, `TC_NFR09_QUERY`) không có ngưỡng số cụ thể (SRS chỉ ghi "phù hợp môi trường MVP" / "hạn chế query không cần thiết") — `assertions` giữ nguyên dạng định tính, **không tự đặt** `max_response_time_ms` hay số lượng query.
- **Assertions giữ nguyên tiếng Việt** (tách theo dấu `;` từ cột Expected Result gốc) để tránh rủi ro dịch sai lệch ý nghĩa nghiệp vụ.
- **15/41 UC chưa có route thật** trong `cab_backend_nodejs` — xem mục 6.

## 11. Kết quả Validation (đã tự kiểm tra khi sinh pack)

```
Total YAML files:        17 (+ 00_MANIFEST.yaml)
Total Test Cases:        195
Total unique Test Case IDs: 195
Duplicate IDs:            0
Missing IDs (Excel→YAML): 0
Extra IDs (YAML→Excel):   0
UC coverage:              41/41
BR coverage:              17/17
FR coverage:               112/112
BRULE coverage:            30/30
NFR coverage:              11/11

VALIDATION PASSED
```
