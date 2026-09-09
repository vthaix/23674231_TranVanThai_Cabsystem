# CAB System - Node.js API

Backend JavaScript/Express được sinh theo SRS FR01-FR55.

## Công nghệ

- Node.js
- Express.js
- JWT
- bcryptjs
- UUID

## Chạy project

```bash
npm install
cp .env.example .env
npm run dev
```

API:

```text
http://localhost:8000/api/v1
```

Health check:

```text
GET http://localhost:8000/health
```

## Cấu trúc

```text
src/
├── data/
│   └── store.js
├── middleware/
│   └── auth.js
├── services/
│   ├── dispatch.service.js
│   ├── notification.service.js
│   └── trip.service.js
├── routes/
│   ├── auth.routes.js
│   ├── booking.routes.js
│   ├── dispatch.routes.js
│   ├── trip.routes.js
│   ├── tracking.routes.js
│   ├── payment.routes.js
│   ├── notification.routes.js
│   ├── operations.routes.js
│   ├── history.routes.js
│   ├── rating.routes.js
│   └── account.routes.js
└── server.js
```

## FR mapping

- BR01 -> booking.routes.js
- BR02 -> dispatch.routes.js
- BR03 -> trip.routes.js
- BR04 -> tracking.routes.js
- BR05 -> payment.routes.js
- BR06 -> notification.routes.js
- BR07 -> operations.routes.js
- BR08 -> history.routes.js
- BR09 -> rating.routes.js
- BR010 -> auth.routes.js + account.routes.js

## Lưu ý

Đây là bản backend MVP chạy được để triển khai API specification. Data hiện lưu trong memory (`store.js`), chưa dùng database.

Các business rule chính từ SRS đã được đưa vào code:
- Customer phải đăng nhập mới đặt xe.
- Booking phải có pickup, destination và vehicleType.
- Chỉ driver AVAILABLE mới được nhận chuyến.
- Vehicle phải phù hợp loại xe.
- Ưu tiên driver gần pickup.
- Trip phải chuyển trạng thái theo thứ tự hợp lệ.
- Chỉ trip COMPLETED mới được thanh toán.
- Mỗi trip chỉ có một payment SUCCESS.
- Chỉ trip COMPLETED mới được rating.
