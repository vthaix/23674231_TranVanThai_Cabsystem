# KỊCH BẢN BÁO CÁO CÁC TIÊU CHÍ ĐÃ PASS

## PC1 – Source Code Architecture

**Thông báo giảng viên:**

“Em chuyển sang tiêu chí PC1 – Source Code Architecture.”

**CLI:**

```bash
find services -maxdepth 2 -type f \( -name "package.json" -o -name "index.js" \) | sort
```

**Giải thích ngắn:**

“Project hiện có 7 microservice gồm identity, customer, driver, booking, trip, payment và notification. Mỗi service đều có package.json và entry point index.js, source code không để rỗng.”

**Kết luận:**

“PC1 đạt.”

---

## PC5 – Docker Compose / Containers

**Thông báo:**

“Em chuyển sang tiêu chí PC5 – Docker Compose và Containers.”

**CLI:**

```bash
docker compose ps
```

**Giải thích:**

“Các container của hệ thống đã được Docker Compose khởi động. Các service, database, Kafka và Redis đều đang chạy; các dependency health check cũng ở trạng thái healthy.”

**Kết luận:**

“PC5 đạt.”

---

## PC6 – Health Check

**Thông báo:**

“Em chuyển sang tiêu chí PC6 – Health Check.”

**CLI:**

```bash
curl -i http://localhost:8000/health
curl -i http://localhost:8000/ready
curl -i http://localhost:8000/health/services
```

**Giải thích:**

“Gateway cung cấp health check và readiness check. Endpoint health services kiểm tra trực tiếp trạng thái của 7 microservice phía sau Gateway.”

**Khi thấy HTTP 200:**

“Các endpoint trả về HTTP 200, các service backend đều ở trạng thái up.”

**Kết luận:**

“PC6 đạt.”

---

## PC7 – Kafka / Asynchronous Communication

**Thông báo:**

“Em chuyển sang tiêu chí PC7 – Kafka.”

**CLI:**

```bash
docker compose exec kafka kafka-topics.sh \
  --bootstrap-server kafka:9092 \
  --list
```

**Giải thích:**

“Kafka đang được sử dụng cho giao tiếp bất đồng bộ giữa các service. Topic booking.events đã được tạo.”

**Tiếp tục kiểm tra consumer:**

```bash
docker compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server kafka:9092 \
  --describe \
  --group notification-service
```

**Giải thích:**

“Notification-service sử dụng consumer group notification-service để nhận event từ Kafka.”

**Có thể chạy test event:**

```bash
curl -i -X POST \
  http://localhost:8000/api/v1/_health/booking-service
```

> Lưu ý: command trên chỉ dùng cho health proxy, không phải Kafka test.

**Để trình diễn Kafka test hiện tại, anh dùng trực tiếp booking-service:**

```bash
docker compose exec booking-service sh
```

Sau đó gọi endpoint test nội bộ mà anh đã triển khai.

**Giải thích kết quả:**

“Booking-service publish event booking.test lên topic booking.events, sau đó notification-service consume event này. Consumer group có offset và lag bằng 0, chứng minh event đã được xử lý.”

**Kết luận:**

“PC7 đạt.”

---

## PC8 – Gateway-only Access

**Thông báo:**

“Em chuyển sang tiêu chí PC8 – Gateway-only Access.”

**CLI:**

```bash
docker compose ps
```

**Giải thích:**

“Trong Docker Compose, chỉ Gateway publish port ra host. Các microservice backend chỉ expose port nội bộ trong Docker network.”

**Kiểm tra trực tiếp từ host:**

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3001/health
curl -i http://localhost:3002/health
curl -i http://localhost:3003/health
curl -i http://localhost:3004/health
curl -i http://localhost:3005/health
curl -i http://localhost:3006/health
```

**Giải thích:**

“Các port 3000 đến 3006 không publish ra host nên client bên ngoài không truy cập trực tiếp được vào microservice.”

**Sau đó kiểm tra Gateway:**

```bash
curl -i http://localhost:8000/health
```

**Giải thích:**

“Gateway là entry point được publish ra ngoài, còn các service backend chỉ giao tiếp trong mạng nội bộ Docker.”

**Kết luận:**

“PC8 đạt.”
