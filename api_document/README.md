# CAB System API Test Pack (YAML)

Bộ YAML dùng để test API hệ thống CAB System, chuyển đổi 1:1 từ `CAB_System_TestCases_Final_v4.xlsx` (203 test case, 38 UC), đối chiếu yêu cầu nghiệp vụ với `srs.md`.

**v2.0 (bản này):** đã bỏ UC28 (Đánh dấu Notification đã đọc), UC29 (Xử lý Incident), UC38 (Dashboard) theo quyết định giảm phạm vi. FR108/FR109 (tỷ lệ hoàn thành/hủy), trước đây chỉ nằm gộp trong UC38, đã được chuyển sang test riêng trong UC39 để không mất coverage. `BR13` (Incident) giờ không còn test case nào (file `13_BR13_incident.yaml` vẫn giữ, chỉ rỗng, kèm ghi chú). Xem `00_MANIFEST.yaml` → `change_log` để biết đầy đủ lịch sử thay đổi.

## 1. Source of Truth

| Nguồn | Vai trò |
|---|---|
| `srs.md` | Sự thật cho **yêu cầu nghiệp vụ/kỹ thuật** (UC/FR/BR/BRULE/NFR) |
| `CAB_System_TestCases_Final_v4.xlsx` | Sự thật cho **danh sách Test Case** |

## 2. Cấu trúc 17 file (1 file = 1 BR, kể cả BR không còn test)

| File | BR | Số Test Case |
|---|---|---|
| `01_BR01_account.yaml` | BR01 – Account | 17 |
| `02_BR02_profile.yaml` | BR02 – Profile | 9 |
| `03_BR03_vehicle.yaml` | BR03 – Vehicle | 15 |
| `04_BR04_booking.yaml` | BR04 – Booking | 15 |
| `05_BR05_driver_matching.yaml` | BR05 – Driver Matching | 14 |
| `06_BR06_assignment.yaml` | BR06 – Assignment | 9 |
| `07_BR07_trip.yaml` | BR07 – Trip | 21 |
| `08_BR08_tracking.yaml` | BR08 – Tracking | 4 |
| `09_BR09_fare.yaml` | BR09 – Fare | 2 |
| `10_BR10_payment.yaml` | BR10 – Payment | 13 |
| `11_BR11_notification.yaml` | BR11 – Notification | 5 |
| `12_BR12_rating.yaml` | BR12 – Rating | 9 |
| `13_BR13_incident.yaml` | BR13 – Incident | **0 (UC29 đã bị bỏ)** |
| `14_BR14_operations.yaml` | BR14 – Operations | 27 |
| `15_BR15_authorization.yaml` | BR15 – Authorization | 20 |
| `16_BR16_audit.yaml` | BR16 – Audit | 7 |
| `17_BR17_reporting.yaml` | BR17 – Reporting | 16 |
| **Tổng** | | **203** |

`00_MANIFEST.yaml` liệt kê toàn bộ 17 file kèm kết quả validation và change log.

## 3-8. (không đổi so với bản trước — xem `00_MANIFEST.yaml`)

Cấu hình `${BASE_URL}`, token, ý nghĩa `IMPLEMENTATION_MAPPING_REQUIRED`, cách map route thật, cách kiểm tra duplicate/missing ID: giữ nguyên logic như bản v1.0 — không đổi vì chỉ cắt bớt phạm vi, không đổi cách sinh YAML.

## 9. Kết quả Validation (đã tự kiểm tra khi sinh pack v2.0)

```
Total YAML files:        17 (+ 00_MANIFEST.yaml)
Total Test Cases:        203
Duplicate IDs:            0
Missing IDs (Excel→YAML): 0
Extra IDs (YAML→Excel):   0

UC coverage:      38/38 (con lai sau khi bo UC28/29/38)
BR coverage:      16/17 co test (BR13 = 0, chu dinh)
FR coverage:      103/112 (thieu FR74, FR81-87, FR95 - deu thuoc UC28/UC29 da bo)
NFR coverage:     11/11 (khong doi)

VALIDATION PASSED
```
