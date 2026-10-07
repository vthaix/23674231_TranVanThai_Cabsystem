const repository = require("../repositories/driver.repository");
const crypto = require("crypto");
const { pool } = require("../db/postgres");
const { getRedisClient } = require("../db/redis");
const { encrypt, decrypt, hashPhone } = require("../../../../shared/src/crypto/index");
const { isValidPhone, isValidPassword } = require("../../../../shared/src/validation/index");
const { maskPhone } = require("../utils/maskPhone");
const { inMemStore, haversineDistanceMeters } = require("../services/driver.service");
const { parsePagination } = require("../../../../shared/src/pagination");
const identityClient = require("../clients/identity.client");

function response(status, body) { return { status, body }; }
function errorResult(status, code, message, requestId) {
  return response(status, { code, message, requestId });
}

async function postDriversOtpRequest(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
  const { phone } = input.body;
  if (!phone || !isValidPhone(phone)) {
    return errorResult(400, "VALIDATION_ERROR", "phone must contain exactly 10 digits", requestId);
  }

  const phoneH = hashPhone(phone);
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpH = crypto.createHash("sha256").update(otp).digest("hex");
  const expiresAt = Date.now() + 300 * 1000; // 5 mins

  console.log(`[DRIVER OTP] Phone: ${phone}, OTP: ${otp}`);

  const redis = getRedisClient();
  if (redis && redis.isOpen) {
    try {
      await redis.set(`otp:${phoneH}`, otpH, { EX: 300 });
      await redis.del(`otp_fail:${phoneH}`);
    } catch (e) {
      inMemStore.otps.set(phoneH, { hash: otpH, expiresAt, attempts: 0 });
    }
  } else {
    inMemStore.otps.set(phoneH, { hash: otpH, expiresAt, attempts: 0 });
  }

  return response(200, {
    success: true,
    message: "OTP sent successfully",
    requestId,
    // Note: In development/test environment, we also return otp in debug header or log
    _dev_otp: process.env.NODE_ENV !== "production" ? otp : undefined
  });
}

async function postDriversOtpVerify(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
  const { phone, otp } = input.body;
  if (!isValidPhone(phone) || !otp) {
    return errorResult(400, "VALIDATION_ERROR", "phone must contain exactly 10 digits and otp is required", requestId);
  }

  const phoneH = hashPhone(phone);
  const otpH = crypto.createHash("sha256").update(otp.toString().trim()).digest("hex");

  const redis = getRedisClient();
  let storedOtpH = null;

  if (redis && redis.isOpen) {
    try {
      storedOtpH = await redis.get(`otp:${phoneH}`);
    } catch {}
  }
  if (!storedOtpH && inMemStore.otps.has(phoneH)) {
    const mem = inMemStore.otps.get(phoneH);
    if (mem.expiresAt > Date.now()) {
      storedOtpH = mem.hash;
    }
  }

  // Also accept static test OTP 123456 in dev/test mode
  const isMatch = storedOtpH === otpH || (process.env.NODE_ENV !== "production" && otp === "123456");

  if (!isMatch) {
    return errorResult(400, "INVALID_OTP", "Invalid or expired OTP", requestId);
  }

  // Generate 15-minute registration token
  const registrationToken = "reg_" + crypto.randomBytes(24).toString("hex");
  const regExpiresAt = Date.now() + 900 * 1000;

  if (redis && redis.isOpen) {
    try {
      await redis.set(`regtoken:${registrationToken}`, phone, { EX: 900 });
      await redis.del(`otp:${phoneH}`);
    } catch {}
  }
  inMemStore.tokens.set(registrationToken, { phone, expiresAt: regExpiresAt });

  return response(200, {
    success: true,
    registrationToken,
    expiresIn: 900,
    requestId
  });
}

async function postDriversRegister(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
  const {
    registrationToken,
    fullName,
    phone,
    password,
    licenseNumber,
    licenseClass,
    licenseExpiryDate,
    vehicle
  } = input.body;

  if (!isValidPassword(password)) {
    return errorResult(400, "VALIDATION_ERROR", "password must be 8-128 characters", requestId);
  }

  const redis = getRedisClient();
  let verifiedPhone = null;
  if (registrationToken && redis && redis.isOpen) {
    try { verifiedPhone = await redis.get(`regtoken:${registrationToken}`); } catch {}
  }
  if (!verifiedPhone && registrationToken && inMemStore.tokens.has(registrationToken)) {
    const mem = inMemStore.tokens.get(registrationToken);
    if (mem.expiresAt > Date.now()) verifiedPhone = mem.phone;
  }
  if (!verifiedPhone || verifiedPhone !== phone) {
    return errorResult(400, "INVALID_REGISTRATION_TOKEN", "Valid OTP registration token for this phone is required", requestId);
  }

  if (!fullName || !licenseNumber || !licenseClass || !licenseExpiryDate) {
    return errorResult(400, "VALIDATION_ERROR", "Missing required driver fields", requestId);
  }
  for (const [field, value] of Object.entries({ fullName, licenseNumber, licenseClass, licenseExpiryDate })) {
    if (typeof value !== "string" || !value.trim()) {
      return errorResult(400, "VALIDATION_ERROR", `${field} must be a non-empty string`, requestId);
    }
  }
  if (vehicle?.vehicleType != null && typeof vehicle.vehicleType !== "string") {
    return errorResult(400, "VALIDATION_ERROR", "vehicle.vehicleType must be a string", requestId);
  }

  // Validate license expiry
  const expiryDate = new Date(licenseExpiryDate);
  if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
    return errorResult(400, "LICENSE_EXPIRED", "Driver license has expired or invalid", requestId);
  }

  // Normalize vehicle
  const vType = (vehicle?.vehicleType || "BIKE").toUpperCase();
  const normalizedVehicle = {
    vehicleType: ["BIKE", "SEDAN", "SUV"].includes(vType) ? vType : "BIKE",
    plateNumber: vehicle?.plateNumber || `59X-${Math.floor(10000 + Math.random() * 90000)}`,
    brand: vehicle?.brand || "Honda",
    model: vehicle?.model || "Wave",
    color: vehicle?.color || "Đen",
    manufactureYear: Number(vehicle?.manufactureYear || 2022),
    seatCount: Number(vehicle?.seatCount || (vType === "BIKE" ? 1 : 4))
  };

  const driverId = crypto.randomUUID();
  const phoneH = hashPhone(verifiedPhone);
  const phoneEnc = encrypt(verifiedPhone);
  const licenseEnc = encrypt(licenseNumber);

  // Create a disabled account until an admin approves the driver profile.
  try {
    await identityClient.createDriverAccount({
      id: driverId,
      phone: verifiedPhone,
      password,
      displayName: fullName.trim()
    }, requestId);
  } catch (err) {
    return errorResult(err.status || 503, err.code || "DEPENDENCY_ERROR", err.message, requestId);
  }

  let client;
  try {
    client = await pool.connect();
    await repository.begin(client);

    // Insert driver in PENDING_APPROVAL
    await repository.insertDrivers(client, [
      driverId, phoneEnc, phoneH,
      fullName, `${driverId.slice(0, 8)}@driver.cab`,
      licenseEnc, licenseClass, licenseExpiryDate
    ]);

    // Insert vehicle
    await repository.insertVehicles(client, [
      driverId, normalizedVehicle.vehicleType, normalizedVehicle.plateNumber,
      normalizedVehicle.brand, normalizedVehicle.model, normalizedVehicle.color,
      normalizedVehicle.manufactureYear, normalizedVehicle.seatCount
    ]);

    // Outbox event
    await repository.insertOutboxEvents(client, [
      driverId,
      JSON.stringify({ driverId, fullName, phoneHash: phoneH, vehicleType: normalizedVehicle.vehicleType }),
      requestId
    ]);

    await repository.commit(client);

    if (redis && redis.isOpen) {
      try { await redis.del(`regtoken:${registrationToken}`); } catch {}
    }
    inMemStore.tokens.delete(registrationToken);

    return response(201, {
      id: driverId,
      fullName,
      status: "PENDING_APPROVAL",
      message: "Driver application submitted, awaiting approval",
      requestId
    });
  } catch (err) {
    if (client) await repository.rollback(client).catch(() => {});
    await identityClient.deleteDriverAccount(driverId, requestId).catch(error => {
      console.error("[driver/register/cleanup]", error.message);
    });
    console.error("[driver/register]", err.message);
    if (err.code === "23505") {
      return errorResult(409, "ALREADY_EXISTS", "Driver phone or national ID already registered", requestId);
    }
    return errorResult(500, "INTERNAL_ERROR", "Registration failed", requestId);
  } finally {
    client?.release();
  }
}

async function getDrivers(input) {
  if (input.user.role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Admin access required", input.requestId);
  }
  return listDrivers(input);
}

async function getDriversMe(input) {
  const requestId = input.requestId;
  if (input.user.role !== "DRIVER") {
    return errorResult(403, "FORBIDDEN", "Driver access required", requestId);
  }

  try {
    const { rows } = await repository.findDriverMe(pool, input.user.sub);
    if (rows.length === 0) return errorResult(404, "NOT_FOUND", "Driver profile not found", requestId);
    const d = rows[0];
    const decryptField = value => {
      if (!value) return null;
      try { return decrypt(value); } catch { return null; }
    };

    return response(200, {
      id: d.id,
      fullName: d.full_name,
      phone: decryptField(d.phone_enc),
      email: d.email,
      balance: Number(d.balance),
      licenseNumber: decryptField(d.license_number_enc),
      licenseClass: d.license_class,
      licenseExpiryDate: d.license_expiry_date,
      avatarUrl: d.avatar_url,
      status: d.status,
      ratingAvg: Number(d.rating_avg),
      ratingCount: d.rating_count,
      completedTrips: d.completed_trips,
      currentTripId: d.current_trip_id,
      rejectedReason: d.rejected_reason,
      reviewedAt: d.reviewed_at,
      lastOnlineAt: d.last_online_at,
      vehicle: d.plate_number ? {
        vehicleType: d.vehicle_type,
        plateNumber: d.plate_number,
        brand: d.brand,
        model: d.model,
        color: d.color,
        manufactureYear: d.manufacture_year,
        seatCount: d.seat_count
      } : null,
      location: d.latitude === null ? null : {
        lat: Number(d.latitude),
        lng: Number(d.longitude),
        heading: d.heading === null ? null : Number(d.heading),
        speedKmh: d.speed_kmh === null ? null : Number(d.speed_kmh),
        recordedAt: d.location_recorded_at
      },
      createdAt: d.created_at,
      updatedAt: d.updated_at
    });
  } catch (err) {
    console.error("[drivers/me]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to get driver profile", requestId);
  }
}

async function listDrivers(input) {
  const requestId = input.requestId;
  const { status } = input.query;
  const pagination = parsePagination(input.query);
  if (!pagination || (status && !["PENDING_APPROVAL", "REJECTED", "OFFLINE", "ONLINE", "BUSY"].includes(status))) {
    return errorResult(400, "VALIDATION_ERROR", "Invalid status, page or limit (limit must be 1-100)", requestId);
  }
  const { page, limit, offset } = pagination;

  try {
    const { rows } = await repository.listAdminDrivers(pool, { status, limit, offset });
    const countRes = await repository.countAdminDrivers(pool, status);
    const total = Number(countRes.rows[0].count);

    const data = rows.map(r => ({
      id: r.id,
      fullName: r.full_name,
      status: r.status,
      balance: Number(r.balance),
      licenseClass: r.license_class,
      licenseExpiryDate: r.license_expiry_date,
      ratingAvg: Number(r.rating_avg),
      completedTrips: r.completed_trips,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      rejectedReason: r.rejected_reason,
      vehicle: r.plate_number ? {
        vehicleType: r.vehicle_type,
        plateNumber: r.plate_number,
        brand: r.brand,
        model: r.model,
        color: r.color
      } : null,
      createdAt: r.created_at
    }));

    return response(200, {
      data,
      pagination: {
        page,
        limit,
        total
      }
    });
  } catch (err) {
    console.error("[admin/drivers]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to list drivers", requestId);
  }
}

async function getAdminDriversId(input) {
  const { role } = input.user;
  const requestId = input.requestId;
  if (role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Admin access required", requestId);
  }

  const { id } = input.params;
  try {
    const { rows } = await repository.findDrivers(pool, [id]);

    if (rows.length === 0) {
      return errorResult(404, "NOT_FOUND", "Driver not found", requestId);
    }
    const r = rows[0];
    return response(200, {
      id: r.id,
      fullName: r.full_name,
      status: r.status,
      balance: Number(r.balance),
      licenseClass: r.license_class,
      licenseExpiryDate: r.license_expiry_date,
      ratingAvg: Number(r.rating_avg),
      completedTrips: r.completed_trips,
      vehicle: r.plate_number ? {
        vehicleType: r.vehicle_type,
        plateNumber: r.plate_number,
        brand: r.brand,
        model: r.model,
        color: r.color
      } : null,
      createdAt: r.created_at
    });
  } catch (err) {
    return errorResult(500, "INTERNAL_ERROR", "Failed to get driver", requestId);
  }
}

async function postAdminDriversIdApprove(input) {
  const { sub: actorId, role } = input.user;
  const requestId = input.requestId;
  if (role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Admin access required", requestId);
  }

  const { id } = input.params;
  const client = await pool.connect();
  let committed = false;
  try {
    await repository.begin(client);
    const { rows } = await repository.findDrivers2(client, [id]);
    if (rows.length === 0) {
      await repository.rollback(client);
      return errorResult(404, "NOT_FOUND", "Driver not found", requestId);
    }
    const driver = rows[0];
    if (driver.status === "OFFLINE" && driver.reviewed_at) {
      await repository.rollback(client);
      await identityClient.activateDriverAccount(id, requestId);
      return response(200, { id, status: "OFFLINE", message: "Driver approved successfully and set to OFFLINE", requestId });
    }
    if (driver.status !== "PENDING_APPROVAL") {
      await repository.rollback(client);
      return errorResult(409, "INVALID_STATE", `Cannot approve driver in status ${driver.status}`, requestId);
    }

    // Update status to OFFLINE
    await repository.updateDrivers(client, [actorId, id]);

    // History & Audit log
    await repository.insertDriverStatusHistory(client, [id, actorId, role, requestId]);

    await repository.insertAuditLogs(client, [actorId, role, id, requestId]);

    // Outbox event
    await repository.insertOutboxEvents2(client, [id, JSON.stringify({ driverId: id, status: "OFFLINE", approvedBy: actorId }), requestId]);

    await repository.commit(client);
    committed = true;
    await identityClient.activateDriverAccount(id, requestId);

    return response(200, {
      id,
      status: "OFFLINE",
      message: "Driver approved successfully and set to OFFLINE",
      requestId
    });
  } catch (err) {
    if (!committed) await repository.rollback(client).catch(() => {});
    console.error("[admin/approve]", err.message);
    if (err.status) return errorResult(err.status, err.code, err.message, requestId);
    return errorResult(500, "INTERNAL_ERROR", "Approval failed", requestId);
  } finally {
    client.release();
  }
}

async function postAdminDriversIdReject(input) {
  const { sub: actorId, role } = input.user;
  const requestId = input.requestId;
  if (role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Admin access required", requestId);
  }

  const { id } = input.params;
  const { reason } = input.body;
  if (!reason) {
    return errorResult(400, "VALIDATION_ERROR", "Rejection reason is required", requestId);
  }

  const client = await pool.connect();
  let committed = false;
  try {
    await repository.begin(client);
    const { rows } = await repository.findDrivers2(client, [id]);
    if (rows.length === 0) {
      await repository.rollback(client);
      return errorResult(404, "NOT_FOUND", "Driver not found", requestId);
    }
    const driver = rows[0];
    if (driver.status === "REJECTED") {
      await repository.rollback(client);
      await identityClient.deleteDriverAccount(id, requestId);
      return response(200, { id, status: "REJECTED", reason: driver.rejected_reason, message: "Driver application rejected", requestId });
    }
    if (driver.status !== "PENDING_APPROVAL") {
      await repository.rollback(client);
      return errorResult(409, "INVALID_STATE", `Cannot reject driver in status ${driver.status}`, requestId);
    }

    await repository.updateDrivers2(client, [reason, actorId, id]);

    await repository.insertDriverStatusHistory2(client, [id, actorId, role, reason, requestId]);

    await repository.insertAuditLogs2(client, [actorId, role, id, reason, requestId]);

    await repository.insertOutboxEvents3(client, [id, JSON.stringify({ driverId: id, status: "REJECTED", reason, rejectedBy: actorId }), requestId]);

    await repository.commit(client);
    committed = true;
    await identityClient.deleteDriverAccount(id, requestId);

    return response(200, {
      id,
      status: "REJECTED",
      reason,
      message: "Driver application rejected",
      requestId
    });
  } catch (err) {
    if (!committed) await repository.rollback(client).catch(() => {});
    console.error("[admin/reject]", err.message);
    if (err.status) return errorResult(err.status, err.code, err.message, requestId);
    return errorResult(500, "INTERNAL_ERROR", "Rejection failed", requestId);
  } finally {
    client.release();
  }
}

async function putDriversMeAvailability(input) {
  const { sub: driverId, role } = input.user;
  const requestId = input.requestId;
  if (role !== "DRIVER" && role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Driver access required", requestId);
  }

  const { status } = input.body;
  if (!status || !["ONLINE", "OFFLINE"].includes(status)) {
    return errorResult(400, "VALIDATION_ERROR", "status must be ONLINE or OFFLINE", requestId);
  }

  const client = await pool.connect();
  try {
    await repository.begin(client);
    const { rows } = await repository.findDrivers2(client, [driverId]);
    if (rows.length === 0) {
      await repository.rollback(client);
      return errorResult(404, "NOT_FOUND", "Driver profile not found", requestId);
    }
    const driver = rows[0];

    if (["PENDING_APPROVAL", "REJECTED"].includes(driver.status)) {
      await repository.rollback(client);
      return errorResult(403, "NOT_APPROVED", `Driver is in ${driver.status} state`, requestId);
    }

    if (driver.status === "BUSY" && status === "OFFLINE") {
      await repository.rollback(client);
      return errorResult(409, "DRIVER_BUSY", "Cannot switch to OFFLINE while in a trip", requestId);
    }

    // If going ONLINE, check location
    if (status === "ONLINE") {
      const locRes = await repository.findDriverLocations(client, [driverId]);
      if (locRes.rows.length === 0) {
        // default a location if none exists
        await repository.insertDriverLocations(client, [driverId]);
      }
    }

    await repository.updateDrivers3(client, [status, driverId]);

    await repository.insertDriverStatusHistory3(client, [driverId, driver.status, status, driverId, requestId]);

    await repository.insertOutboxEvents4(client, [
      driverId,
      status === "ONLINE" ? "driver.online" : "driver.offline",
      JSON.stringify({ driverId, status }),
      requestId
    ]);

    await repository.commit(client);

    return response(200, {
      id: driverId,
      status,
      message: `Driver status updated to ${status}`,
      requestId
    });
  } catch (err) {
    await repository.rollback(client);
    console.error("[driver/availability]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to update availability", requestId);
  } finally {
    client.release();
  }
}

async function putDriversMeLocation(input) {
  const { sub: driverId, role } = input.user;
  const requestId = input.requestId;
  if (role !== "DRIVER" && role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Driver access required", requestId);
  }

  const { lat, lng, heading, speedKmh } = input.body;

  if (Object.keys(input.body).some(key => /latitude|longitude|longtitude/i.test(key))) {
    return errorResult(400, "VALIDATION_ERROR", "Use lat and lng for coordinates", requestId);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return errorResult(400, "VALIDATION_ERROR", "Invalid coordinates: lat in [-90, 90], lng in [-180, 180]", requestId);
  }

  try {
    await repository.insertDriverLocations2(pool, [driverId, lat, lng, heading || 0, speedKmh || 0]);

    // Update Redis GEO
    const redis = getRedisClient();
    if (redis && redis.isOpen) {
      try {
        await redis.geoAdd("driver:geo", {
          longitude: lng,
          latitude: lat,
          member: driverId
        });
      } catch (e) {}
    }

    return response(200, {
      success: true,
      driverId,
      lat,
      lng,
      requestId
    });
  } catch (err) {
    console.error("[driver/location]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to update location", requestId);
  }
}

async function getDriversNearby(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
  const { lat, lng, radius = 1000, vehicleType, status = "ONLINE", page = 1, limit = 20 } = input.query;

  const centerLat = Number(lat || 10.776889);
  const centerLng = Number(lng || 106.700806);
  const radMeters = Number(radius);
  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));

  if (isNaN(centerLat) || isNaN(centerLng)) {
    return errorResult(400, "VALIDATION_ERROR", "Invalid coordinates", requestId);
  }

  try {
    // Get all drivers with their location and active vehicle
    const { rows } = await repository.listNearbyDrivers(pool, { status, vehicleType });

    // Calculate distance and filter by radius
    const withDistance = rows.map(r => {
      const dist = haversineDistanceMeters(centerLat, centerLng, Number(r.latitude), Number(r.longitude));
      return {
        id: r.id,
        fullName: r.full_name,
        status: r.status,
        ratingAvg: Number(r.rating_avg),
        completedTrips: r.completed_trips,
        location: {
          lat: Number(r.latitude),
          lng: Number(r.longitude)
        },
        distanceM: dist,
        vehicle: r.plate_number ? {
          vehicleType: r.vehicle_type,
          plateNumber: r.plate_number,
          brand: r.brand,
          model: r.model,
          color: r.color
        } : null
      };
    }).filter(d => d.distanceM <= radMeters);

    // Sort by distance ascending
    withDistance.sort((a, b) => a.distanceM - b.distanceM);

    const total = withDistance.length;
    const paginated = withDistance.slice((p - 1) * l, p * l);

    return response(200, {
      data: paginated,
      pagination: {
        page: p,
        limit: l,
        total
      },
      requestId
    });
  } catch (err) {
    console.error("[drivers/nearby]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to search nearby drivers", requestId);
  }
}

async function getDriversId(input) {
  const { id } = input.params;
  const { sub: userId, role } = input.user;
  const requestId = input.requestId;

  // Authorization: DRIVER can view self; EMPLOYEE/ADMIN can view all; CUSTOMER can view
  if (role === "DRIVER" && userId !== id) {
    return errorResult(403, "FORBIDDEN", "Drivers can only view their own profile", requestId);
  }

  try {
    const { rows } = await repository.findDrivers(pool, [id]);

    if (rows.length === 0) {
      return errorResult(404, "NOT_FOUND", "Driver not found", requestId);
    }

    const d = rows[0];
    let phone = null;
    if (d.phone_enc) {
      try {
        const dec = decrypt(d.phone_enc);
        phone = (role === "DRIVER" && userId === id) ? dec : maskPhone(dec);
      } catch {
        phone = null;
      }
    }

    return response(200, {
      id: d.id,
      fullName: d.full_name,
      phone,
      status: d.status,
      ...(role === 'DRIVER' || role === 'ADMIN' ? { balance: Number(d.balance) } : {}),
      ratingAvg: Number(d.rating_avg),
      ratingCount: d.rating_count,
      completedTrips: d.completed_trips,
      currentTripId: d.current_trip_id,
      vehicle: d.plate_number ? {
        vehicleType: d.vehicle_type,
        plateNumber: d.plate_number,
        brand: d.brand,
        model: d.model,
        color: d.color
      } : null,
      createdAt: d.created_at
    });
  } catch (err) {
    console.error("[drivers/get]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to get driver", requestId);
  }
}

async function getInternalDriversNearby(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
  const { lat, lng, radius = 5000, vehicleType, excludeIds = "" } = input.query;

  const centerLat = Number(lat);
  const centerLng = Number(lng);
  const radMeters = Number(radius);
  const excluded = excludeIds.split(",").filter(Boolean);

  try {
    const { rows } = await repository.listDispatchCandidates(pool, vehicleType);

    const candidates = [];
    const redis = getRedisClient();

    for (const r of rows) {
      if (excluded.includes(r.id)) continue;

      // Check reservation
      let isReserved = false;
      if (redis && redis.isOpen) {
        try {
          const resBooking = await redis.get(`driver:reserve:${r.id}`);
          if (resBooking) isReserved = true;
        } catch {}
      }
      if (!isReserved && inMemStore.reservations.has(r.id)) {
        const mem = inMemStore.reservations.get(r.id);
        if (mem.expiresAt > Date.now()) isReserved = true;
      }
      if (isReserved) continue;

      const dist = haversineDistanceMeters(centerLat, centerLng, Number(r.latitude), Number(r.longitude));
      if (dist <= radMeters) {
        candidates.push({
          id: r.id,
          fullName: r.full_name,
          distanceM: dist,
          etaSeconds: Math.round(dist / 8.33), // ~30 km/h
          vehicle: {
            vehicleType: r.vehicle_type,
            plateNumber: r.plate_number,
            brand: r.brand,
            model: r.model,
            color: r.color
          }
        });
      }
    }

    candidates.sort((a, b) => a.distanceM - b.distanceM);
    return response(200, { candidates });
  } catch (err) {
    console.error("[internal/drivers/nearby]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Search failed", requestId);
  }
}

async function postInternalDriversIdReservations(input) {
  const { id } = input.params;
  const { bookingId } = input.body;
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();

  if (!bookingId) {
    return errorResult(400, "VALIDATION_ERROR", "bookingId required", requestId);
  }

  const redis = getRedisClient();
  const ttlSec = Number(process.env.OFFER_TTL_SEC || 1800) + 5;

  if (redis && redis.isOpen) {
    try {
      const existing = await redis.get(`driver:reserve:${id}`);
      if (existing && existing !== bookingId) {
        return errorResult(409, "DRIVER_RESERVED", "Driver already reserved by another booking", requestId);
      }
      await redis.set(`driver:reserve:${id}`, bookingId, { EX: ttlSec });
      return response(200, { reserved: true, driverId: id, bookingId });
    } catch {}
  }

  // Memory fallback
  const mem = inMemStore.reservations.get(id);
  if (mem && mem.expiresAt > Date.now() && mem.bookingId !== bookingId) {
    return errorResult(409, "DRIVER_RESERVED", "Driver already reserved by another booking", requestId);
  }
  inMemStore.reservations.set(id, { bookingId, expiresAt: Date.now() + ttlSec * 1000 });

  return response(200, { reserved: true, driverId: id, bookingId });
}

async function deleteInternalDriversIdReservationsBookingid(input) {
  const { id, bookingId } = input.params;
  const redis = getRedisClient();
  if (redis && redis.isOpen) {
    try {
      const cur = await redis.get(`driver:reserve:${id}`);
      if (cur === bookingId) await redis.del(`driver:reserve:${id}`);
    } catch {}
  }
  if (inMemStore.reservations.has(id)) {
    const mem = inMemStore.reservations.get(id);
    if (mem.bookingId === bookingId) inMemStore.reservations.delete(id);
  }
  return response(200, { released: true });
}

async function postInternalDriversIdBusy(input) {
  const { id } = input.params;
  const { tripId } = input.body;
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();

  const client = await pool.connect();
  try {
    await repository.begin(client);

    // Remove reservation
    const redis = getRedisClient();
    if (redis && redis.isOpen) {
      try { await redis.del(`driver:reserve:${id}`); } catch {}
    }
    inMemStore.reservations.delete(id);

    await repository.updateDrivers4(client, [tripId, id]);

    await repository.insertDriverStatusHistory4(client, [id, tripId, requestId]);

    await repository.commit(client);

    return response(200, { id, status: "BUSY", currentTripId: tripId });
  } catch (err) {
    await repository.rollback(client);
    console.error("[internal/busy]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to mark driver busy", requestId);
  } finally {
    client.release();
  }
}

async function getInternalDriversIdSummary(input) {
  const { id } = input.params;
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();

  try {
    const { rows } = await repository.findDrivers3(pool, [id]);

    if (rows.length === 0) {
      return errorResult(404, "NOT_FOUND", "Driver not found", requestId);
    }

    const r = rows[0];
    return response(200, {
      id: r.id,
      fullName: r.full_name,
      avatarUrl: r.avatar_url,
      ratingAvg: Number(r.rating_avg),
      completedTrips: r.completed_trips,
      vehicle: r.plate_number ? {
        vehicleType: r.vehicle_type,
        plateNumber: r.plate_number,
        brand: r.brand,
        model: r.model,
        color: r.color
      } : null
    });
  } catch (err) {
    return errorResult(500, "INTERNAL_ERROR", "Failed to get driver summary", requestId);
  }
}

async function postInternalDriversIdAvailable(input) {
  const { id } = input.params;
  const { tripId } = input.body;
  const requestId = input.requestId || crypto.randomUUID();
  if (!tripId) return errorResult(400, 'VALIDATION_ERROR', 'tripId is required', requestId);
  const client = await pool.connect();
  try {
    await repository.begin(client);
    const { rows } = await client.query('SELECT status,current_trip_id FROM drivers WHERE id=$1 FOR UPDATE', [id]);
    if (!rows.length) {
      await repository.rollback(client);
      return errorResult(404, 'NOT_FOUND', 'Driver not found', requestId);
    }
    if (rows[0].status === 'ONLINE' && rows[0].current_trip_id === null) {
      await repository.rollback(client);
      return response(200, { id, status: 'ONLINE', requestId });
    }
    if (rows[0].status !== 'BUSY' || rows[0].current_trip_id !== tripId) {
      await repository.rollback(client);
      return errorResult(409, 'TRIP_MISMATCH', 'Driver is busy with another trip', requestId);
    }
    await client.query(`UPDATE drivers SET status='ONLINE',current_trip_id=NULL,
      last_online_at=NOW(),updated_at=NOW() WHERE id=$1`, [id]);
    await client.query(`INSERT INTO driver_status_history(driver_id,from_status,to_status,trip_id,request_id)
      VALUES($1,'BUSY','ONLINE',$2,$3)`, [id, tripId, requestId]);
    await repository.commit(client);
    return response(200, { id, status: 'ONLINE', requestId });
  } catch (error) {
    await repository.rollback(client).catch(() => {});
    console.error('[internal/available]', error.message);
    return errorResult(500, 'INTERNAL_ERROR', 'Failed to release driver', requestId);
  } finally { client.release(); }
}

module.exports = { postDriversOtpRequest, postDriversOtpVerify, postDriversRegister, getDrivers, getDriversMe, getAdminDriversId, postAdminDriversIdApprove, postAdminDriversIdReject, putDriversMeAvailability, putDriversMeLocation, getDriversNearby, getDriversId, getInternalDriversNearby, postInternalDriversIdReservations, deleteInternalDriversIdReservationsBookingid, postInternalDriversIdBusy, postInternalDriversIdAvailable, getInternalDriversIdSummary };
