const { pool } = require("./postgres");

const TEST_CUSTOMER_ID = "00000000-0000-0000-0000-000000000001";
const DRIVER_ID_1 = "00000000-0000-0000-0000-000000000011";
const DRIVER_ID_2 = "00000000-0000-0000-0000-000000000012";

const FARE_RULES = [
  { vehicleType: "BIKE", baseFare: 12000, perKm: 4000 },
  { vehicleType: "SEDAN", baseFare: 20000, perKm: 10000 },
  { vehicleType: "SUV", baseFare: 25000, perKm: 12000 },
];

const SEED_TRIPS = [
  {
    id: "00000000-0000-0000-0000-000000000201",
    bookingId: "00000000-0000-0000-0000-000000000101",
    customerId: TEST_CUSTOMER_ID,
    driverId: DRIVER_ID_1,
    vehicleType: "BIKE",
    pickupAddress: "123 Lê Lợi, Bến Nghé, Quận 1, TP.HCM",
    pickupLat: 10.776889,
    pickupLng: 106.700806,
    destinationAddress: "Landmark 81, 720A Điện Biên Phủ, Bình Thạnh, TP.HCM",
    destinationLat: 10.795000,
    destinationLng: 106.721944,
    distanceKm: 4.5,
    baseFare: 12000,
    perKmFare: 4000,
    fare: 30000,
    status: "COMPLETED",
    paymentStatus: "PAID",
    driverSnapshot: {
      fullName: "Nguyễn Văn Tài (Online Bike)",
      ratingAvg: 4.8,
      vehicle: { vehicleType: "BIKE", plateNumber: "59A-111.11", brand: "Honda", model: "Wave Alpha", color: "Đỏ" }
    }
  },
  {
    id: "00000000-0000-0000-0000-000000000202",
    bookingId: "00000000-0000-0000-0000-000000000102",
    customerId: TEST_CUSTOMER_ID,
    driverId: DRIVER_ID_2,
    vehicleType: "SEDAN",
    pickupAddress: "Sân bay Tân Sơn Nhất, Trường Sơn, Tân Bình, TP.HCM",
    pickupLat: 10.818463,
    pickupLng: 106.658825,
    destinationAddress: "Chợ Bến Thành, Lê Lợi, Quận 1, TP.HCM",
    destinationLat: 10.772535,
    destinationLng: 106.698047,
    distanceKm: 8.0,
    baseFare: 20000,
    perKmFare: 10000,
    fare: 100000,
    status: "COMPLETED",
    paymentStatus: "PAID",
    driverSnapshot: {
      fullName: "Trần Văn Bình (Online Sedan)",
      ratingAvg: 4.9,
      vehicle: { vehicleType: "SEDAN", plateNumber: "51F-222.22", brand: "Toyota", model: "Vios", color: "Trắng" }
    }
  },
  {
    id: "00000000-0000-0000-0000-000000000204",
    bookingId: "00000000-0000-0000-0000-000000000104",
    customerId: TEST_CUSTOMER_ID,
    driverId: DRIVER_ID_2,
    vehicleType: "SUV",
    pickupAddress: "Bitexco Financial Tower, Hải Triều, Bến Nghé, Quận 1, TP.HCM",
    pickupLat: 10.771667,
    pickupLng: 106.704444,
    destinationAddress: "Khu đô thị Sala, Mai Chí Thọ, Quận 2, TP.HCM",
    destinationLat: 10.768056,
    destinationLng: 106.721389,
    distanceKm: 3.2,
    baseFare: 25000,
    perKmFare: 12000,
    fare: 63000,
    status: "COMPLETED",
    paymentStatus: "PAID",
    driverSnapshot: {
      fullName: "Trần Văn Bình (Online Sedan)",
      ratingAvg: 4.9,
      vehicle: { vehicleType: "SUV", plateNumber: "51G-333.33", brand: "Hyundai", model: "SantaFe", color: "Đen" }
    }
  },
  {
    id: "00000000-0000-0000-0000-000000000205",
    // This trip is COMPLETED and UNPAID, ready for testing Payment (PC19) and Review (PC20)!
    id: "00000000-0000-0000-0000-000000000205",
    bookingId: "00000000-0000-0000-0000-000000000105",
    customerId: TEST_CUSTOMER_ID,
    driverId: DRIVER_ID_1,
    vehicleType: "BIKE",
    pickupAddress: "Nhà thờ Đức Bà, Công xã Paris, Bến Nghé, Quận 1, TP.HCM",
    pickupLat: 10.779784,
    pickupLng: 106.699018,
    destinationAddress: "Bảo tàng Chứng tích Chiến tranh, Võ Văn Tần, Quận 3, TP.HCM",
    destinationLat: 10.779444,
    destinationLng: 106.692222,
    distanceKm: 2.0,
    baseFare: 12000,
    perKmFare: 4000,
    fare: 20000,
    status: "COMPLETED",
    paymentStatus: "UNPAID",
    driverSnapshot: {
      fullName: "Nguyễn Văn Tài (Online Bike)",
      ratingAvg: 4.8,
      vehicle: { vehicleType: "BIKE", plateNumber: "59A-111.11", brand: "Honda", model: "Wave Alpha", color: "Đỏ" }
    }
  }
];

async function seed() {
  const client = await pool.connect();
  try {
    // 1. Seed Fare Rules
    for (const rule of FARE_RULES) {
      await client.query(`
        INSERT INTO fare_rules (vehicle_type, base_fare, per_km, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT DO NOTHING
      `, [rule.vehicleType, rule.baseFare, rule.perKm]);
    }

    // 2. Seed Trips
    for (const t of SEED_TRIPS) {
      await client.query(`
        INSERT INTO trips (
          id, booking_id, customer_id, driver_id, vehicle_type,
          pickup_address, pickup_lat, pickup_lng, destination_address, destination_lat, destination_lng,
          distance_km, base_fare, per_km_fare, fare, status, payment_status, driver_snapshot
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          payment_status = EXCLUDED.payment_status
      `, [
        t.id, t.bookingId, t.customerId, t.driverId, t.vehicleType,
        t.pickupAddress, t.pickupLat, t.pickupLng, t.destinationAddress, t.destinationLat, t.destinationLng,
        t.distanceKm, t.baseFare, t.perKmFare, t.fare, t.status, t.paymentStatus,
        JSON.stringify(t.driverSnapshot)
      ]);
    }

    console.log("[trip-service] Seeded fare rules and sample trips");
  } catch (err) {
    console.error("[trip-service] Seed failed:", err.message);
  } finally {
    client.release();
  }
}

module.exports = { seed, FARE_RULES, SEED_TRIPS };
