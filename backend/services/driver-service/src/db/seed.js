const { pool } = require("./postgres");
const { encrypt, hashPhone, hashNationalId } = require("../../../../shared/src/crypto/index");
const { getRedisClient } = require("./redis");

const SEED_DRIVERS = [
  {
    id: "00000000-0000-0000-0000-000000000011",
    fullName: "Nguyễn Văn Tài (Online Bike)",
    phone: "0901111111",
    nationalId: "001122334455",
    dateOfBirth: "1990-05-15",
    licenseNumber: "B2-99887766",
    licenseClass: "A1",
    licenseExpiryDate: "2030-12-31",
    status: "ONLINE",
    lat: 10.776900,
    lng: 106.700900, // ~15m from center
    ratingSum: 48,
    ratingCount: 10,
    ratingAvg: 4.80,
    vehicle: {
      vehicleType: "BIKE",
      plateNumber: "59A-111.11",
      brand: "Honda",
      model: "Wave Alpha",
      color: "Đỏ",
      manufactureYear: 2021,
      seatCount: 1,
    }
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    fullName: "Trần Văn Bình (Online Sedan)",
    phone: "0902222222",
    nationalId: "001122334456",
    dateOfBirth: "1988-08-20",
    licenseNumber: "B2-11223344",
    licenseClass: "B2",
    licenseExpiryDate: "2029-10-10",
    status: "ONLINE",
    lat: 10.778000,
    lng: 106.702000, // ~180m from center
    ratingSum: 49,
    ratingCount: 10,
    ratingAvg: 4.90,
    vehicle: {
      vehicleType: "SEDAN",
      plateNumber: "51F-222.22",
      brand: "Toyota",
      model: "Vios",
      color: "Trắng",
      manufactureYear: 2022,
      seatCount: 4,
    }
  },
  {
    id: "00000000-0000-0000-0000-000000000013",
    fullName: "Lê Hoàng Long (Busy SUV)",
    phone: "0903333333",
    nationalId: "001122334457",
    dateOfBirth: "1985-03-12",
    licenseNumber: "B2-33445566",
    licenseClass: "B2",
    licenseExpiryDate: "2028-04-15",
    status: "BUSY",
    lat: 10.779000,
    lng: 106.703000, // ~300m
    ratingSum: 45,
    ratingCount: 10,
    ratingAvg: 4.50,
    vehicle: {
      vehicleType: "SUV",
      plateNumber: "51G-333.33",
      brand: "Hyundai",
      model: "SantaFe",
      color: "Đen",
      manufactureYear: 2023,
      seatCount: 7,
    }
  },
  {
    id: "00000000-0000-0000-0000-000000000014",
    fullName: "Phạm Hữu Nghĩa (Offline Sedan)",
    phone: "0904444444",
    nationalId: "001122334458",
    dateOfBirth: "1992-11-05",
    licenseNumber: "B2-55667788",
    licenseClass: "B2",
    licenseExpiryDate: "2031-01-01",
    status: "OFFLINE",
    lat: 10.775000,
    lng: 106.699000, // ~300m
    ratingSum: 40,
    ratingCount: 10,
    ratingAvg: 4.00,
    vehicle: {
      vehicleType: "SEDAN",
      plateNumber: "51H-444.44",
      brand: "Kia",
      model: "K3",
      color: "Xám",
      manufactureYear: 2021,
      seatCount: 4,
    }
  },
  {
    id: "00000000-0000-0000-0000-000000000015",
    fullName: "Võ Minh Tâm (Pending Approval)",
    phone: "0905555555",
    nationalId: "001122334459",
    dateOfBirth: "1995-07-22",
    licenseNumber: "B2-77889900",
    licenseClass: "B2",
    licenseExpiryDate: "2032-06-30",
    status: "PENDING_APPROVAL",
    lat: 10.776000,
    lng: 106.700000,
    ratingSum: 0,
    ratingCount: 0,
    ratingAvg: 0,
    vehicle: {
      vehicleType: "BIKE",
      plateNumber: "59B-555.55",
      brand: "Honda",
      model: "Air Blade",
      color: "Đen",
      manufactureYear: 2020,
      seatCount: 1,
    }
  },
  {
    id: "00000000-0000-0000-0000-000000000016",
    fullName: "Đỗ Gia Huy (Online Far >1km)",
    phone: "0906666666",
    nationalId: "001122334460",
    dateOfBirth: "1991-09-09",
    licenseNumber: "B2-88990011",
    licenseClass: "A1",
    licenseExpiryDate: "2030-05-15",
    status: "ONLINE",
    lat: 10.810000,
    lng: 106.730000, // ~5km away
    ratingSum: 47,
    ratingCount: 10,
    ratingAvg: 4.70,
    vehicle: {
      vehicleType: "BIKE",
      plateNumber: "59C-666.66",
      brand: "Yamaha",
      model: "Exciter",
      color: "Xanh",
      manufactureYear: 2022,
      seatCount: 1,
    }
  }
];

async function seed() {
  const client = await pool.connect();
  try {
    const redis = getRedisClient();

    for (const d of SEED_DRIVERS) {
      const phoneEnc = encrypt(d.phone);
      const phoneH = hashPhone(d.phone);
      const nationalIdEnc = encrypt(d.nationalId);
      const nationalIdH = hashNationalId(d.nationalId);
      const licenseEnc = encrypt(d.licenseNumber);

      await client.query(`
        INSERT INTO drivers (
          id, phone_enc, phone_hash, national_id_enc, national_id_hash,
          full_name, email, date_of_birth, license_number_enc, license_class,
          license_expiry_date, status, rating_sum, rating_count, rating_avg
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        ) ON CONFLICT (id) DO UPDATE SET
          phone_enc = EXCLUDED.phone_enc,
          phone_hash = EXCLUDED.phone_hash,
          national_id_enc = EXCLUDED.national_id_enc,
          national_id_hash = EXCLUDED.national_id_hash,
          full_name = EXCLUDED.full_name,
          date_of_birth = EXCLUDED.date_of_birth,
          license_number_enc = EXCLUDED.license_number_enc,
          license_class = EXCLUDED.license_class,
          license_expiry_date = EXCLUDED.license_expiry_date,
          status = EXCLUDED.status,
          rating_sum = EXCLUDED.rating_sum,
          rating_count = EXCLUDED.rating_count,
          rating_avg = EXCLUDED.rating_avg
      `, [
        d.id, phoneEnc, phoneH, nationalIdEnc, nationalIdH,
        d.fullName, `${d.id.slice(0, 8)}@driver.cab`, d.dateOfBirth, licenseEnc, d.licenseClass,
        d.licenseExpiryDate, d.status, d.ratingSum, d.ratingCount, d.ratingAvg
      ]);

      // Vehicle
      await client.query(`
        INSERT INTO vehicles (
          driver_id, vehicle_type, plate_number, brand, model, color, manufacture_year, seat_count, is_active
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, true
        ) ON CONFLICT (plate_number) DO UPDATE SET
          driver_id = EXCLUDED.driver_id,
          vehicle_type = EXCLUDED.vehicle_type,
          is_active = true
      `, [
        d.id, d.vehicle.vehicleType, d.vehicle.plateNumber, d.vehicle.brand,
        d.vehicle.model, d.vehicle.color, d.vehicle.manufactureYear, d.vehicle.seatCount
      ]);

      // Location
      await client.query(`
        INSERT INTO driver_locations (
          driver_id, latitude, longitude, heading, recorded_at, updated_at
        ) VALUES (
          $1, $2, $3, 0, NOW(), NOW()
        ) ON CONFLICT (driver_id) DO UPDATE SET
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          updated_at = NOW()
      `, [d.id, d.lat, d.lng]);

      // If Redis is connected, add to GEO index
      if (redis && redis.isOpen) {
        try {
          await redis.geoAdd("driver:geo", {
            longitude: d.lng,
            latitude: d.lat,
            member: d.id
          });
        } catch (e) {
          // ignore if redis geoadd fails
        }
      }
    }

    console.log("[driver-service] Seeded 6 sample drivers with vehicles and locations");
  } catch (err) {
    console.error("[driver-service] Seed failed:", err.message);
  } finally {
    client.release();
  }
}

module.exports = { seed, SEED_DRIVERS };
