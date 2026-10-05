const { pool } = require("./postgres");

const TEST_CUSTOMER_ID = "00000000-0000-0000-0000-000000000001";
const PC14_CUSTOMER_ID = "10000000-0000-4000-8000-000000000001"; // customer1@example.com
const DRIVER_ID_1 = "00000000-0000-0000-0000-000000000011";
const DRIVER_ID_2 = "00000000-0000-0000-0000-000000000012";

// Five finished booking attempts near (10.7, 106.7), owned by a real seeded Customer.
// Terminal states keep the demo data from creating live dispatch offers.
const PC14_BOOKINGS = [
  { id: "00000000-0000-0000-0000-000000000141", pickupLat: 10.700000, pickupLng: 106.700000, destinationLat: 10.710000, destinationLng: 106.710000, status: "CANCELED" },
  { id: "00000000-0000-0000-0000-000000000142", pickupLat: 10.701000, pickupLng: 106.700500, destinationLat: 10.711000, destinationLng: 106.711000, status: "CANCELED" },
  { id: "00000000-0000-0000-0000-000000000143", pickupLat: 10.699000, pickupLng: 106.699500, destinationLat: 10.709000, destinationLng: 106.709000, status: "NO_DRIVER_FOUND" },
  { id: "00000000-0000-0000-0000-000000000144", pickupLat: 10.702000, pickupLng: 106.701000, destinationLat: 10.712000, destinationLng: 106.712000, status: "CANCELED" },
  { id: "00000000-0000-0000-0000-000000000145", pickupLat: 10.697000, pickupLng: 106.698000, destinationLat: 10.707000, destinationLng: 106.708000, status: "NO_DRIVER_FOUND" },
].map((booking, index) => {
  const createdAt = new Date(Date.now() - (index + 1) * 86400000).toISOString();
  return {
    ...booking,
    customerId: PC14_CUSTOMER_ID,
    vehicleType: "BIKE",
    pickupAddress: `Điểm đón PC14 ${index + 1}`,
    destinationAddress: `Điểm đến PC14 ${index + 1}`,
    cancelReason: booking.status === "CANCELED" ? "CUSTOMER_REQUEST" : null,
    canceledAt: booking.status === "CANCELED"
      ? new Date(Date.parse(createdAt) + 600000).toISOString() : null,
    createdAt
  };
});

const SEED_BOOKINGS = [
  {
    id: "00000000-0000-0000-0000-000000000101",
    customerId: TEST_CUSTOMER_ID,
    vehicleType: "BIKE",
    pickupAddress: "123 Lê Lợi, Bến Nghé, Quận 1, TP.HCM",
    pickupLat: 10.776889,
    pickupLng: 106.700806,
    destinationAddress: "Landmark 81, 720A Điện Biên Phủ, Bình Thạnh, TP.HCM",
    destinationLat: 10.795000,
    destinationLng: 106.721944,
    status: "COMPLETED",
    currentDriverId: DRIVER_ID_1,
    tripId: "00000000-0000-0000-0000-000000000201",
    completedAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 48 * 3600000 - 1800000).toISOString()
  },
  {
    id: "00000000-0000-0000-0000-000000000102",
    customerId: TEST_CUSTOMER_ID,
    vehicleType: "SEDAN",
    pickupAddress: "Sân bay Tân Sơn Nhất, Trường Sơn, Tân Bình, TP.HCM",
    pickupLat: 10.818463,
    pickupLng: 106.658825,
    destinationAddress: "Chợ Bến Thành, Lê Lợi, Quận 1, TP.HCM",
    destinationLat: 10.772535,
    destinationLng: 106.698047,
    status: "COMPLETED",
    currentDriverId: DRIVER_ID_2,
    tripId: "00000000-0000-0000-0000-000000000202",
    completedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 24 * 3600000 - 3600000).toISOString()
  },
  {
    id: "00000000-0000-0000-0000-000000000103",
    customerId: TEST_CUSTOMER_ID,
    vehicleType: "BIKE",
    pickupAddress: "Đại học Bách Khoa, 268 Lý Thường Kiệt, Quận 10, TP.HCM",
    pickupLat: 10.772111,
    pickupLng: 106.657889,
    destinationAddress: "Hồ Con Rùa, Phường 6, Quận 3, TP.HCM",
    destinationLat: 10.782778,
    destinationLng: 106.695833,
    status: "CANCELED",
    cancelReason: "CUSTOMER_REQUEST",
    canceledAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 12 * 3600000 - 600000).toISOString()
  },
  {
    id: "00000000-0000-0000-0000-000000000104",
    customerId: TEST_CUSTOMER_ID,
    vehicleType: "SUV",
    pickupAddress: "Bitexco Financial Tower, Hải Triều, Bến Nghé, Quận 1, TP.HCM",
    pickupLat: 10.771667,
    pickupLng: 106.704444,
    destinationAddress: "Khu đô thị Sala, Mai Chí Thọ, Quận 2, TP.HCM",
    destinationLat: 10.768056,
    destinationLng: 106.721389,
    status: "COMPLETED",
    currentDriverId: DRIVER_ID_2,
    tripId: "00000000-0000-0000-0000-000000000204",
    completedAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 3600000 - 2400000).toISOString()
  },
  {
    id: "00000000-0000-0000-0000-000000000105",
    customerId: TEST_CUSTOMER_ID,
    vehicleType: "BIKE",
    pickupAddress: "Nhà thờ Đức Bà, Công xã Paris, Bến Nghé, Quận 1, TP.HCM",
    pickupLat: 10.779784,
    pickupLng: 106.699018,
    destinationAddress: "Bảo tàng Chứng tích Chiến tranh, Võ Văn Tần, Quận 3, TP.HCM",
    destinationLat: 10.779444,
    destinationLng: 106.692222,
    status: "COMPLETED",
    currentDriverId: DRIVER_ID_1,
    tripId: "00000000-0000-0000-0000-000000000205",
    completedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 3600000 - 1200000).toISOString()
  },
  {
    id: "00000000-0000-0000-0000-000000000106",
    customerId: TEST_CUSTOMER_ID,
    vehicleType: "BIKE",
    pickupAddress: "Phố đi bộ Nguyễn Huệ, Quận 1, TP.HCM",
    pickupLat: 10.774444,
    pickupLng: 106.703611,
    destinationAddress: "Thảo Cầm Viên, Nguyễn Bỉnh Khiêm, Quận 1, TP.HCM",
    destinationLat: 10.787500,
    destinationLng: 106.705278,
    status: "SEARCHING",
    createdAt: new Date().toISOString()
  },
  ...PC14_BOOKINGS
];

async function seed(bookings = SEED_BOOKINGS) {
  const client = await pool.connect();
  try {
    for (const b of bookings) {
      await client.query(`
        INSERT INTO bookings (
          id, customer_id, vehicle_type, pickup_address, pickup_lat, pickup_lng,
          destination_address, destination_lat, destination_lng, status,
          current_driver_id, trip_id, cancel_reason, completed_at, canceled_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16
        ) ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          current_driver_id = EXCLUDED.current_driver_id,
          trip_id = EXCLUDED.trip_id
      `, [
        b.id, b.customerId, b.vehicleType, b.pickupAddress, b.pickupLat, b.pickupLng,
        b.destinationAddress, b.destinationLat, b.destinationLng, b.status,
        b.currentDriverId || null, b.tripId || null, b.cancelReason || null,
        b.completedAt || null, b.canceledAt || null, b.createdAt
      ]);
    }
    console.log(`[booking-service] Seeded ${bookings.length} sample bookings`);
  } catch (err) {
    console.error("[booking-service] Seed failed:", err.message);
  } finally {
    client.release();
  }
}

module.exports = { seed, SEED_BOOKINGS, TEST_CUSTOMER_ID, PC14_BOOKINGS, PC14_CUSTOMER_ID };
