// Run from backend/ after stopping application services. Destructive by design.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const { encrypt, hashPhone, hashNationalId } = require('../shared/src/crypto');
const { calculateFare } = require('../shared/src/fare');
const { ensureDemoAdmin, passwordHash } = require('./add-demo-admin');

const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  .split(/\r?\n/).filter(line => line && !line.startsWith('#'))
  .map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
const driverPhones = [
  '0391234561', '0391234562', '0391234563', '0391234564', '0391234565',
  '0391234566', '0391234567', '0391234568', '0391234569', '0391234510',
];
const statuses = ['SEARCHING', 'EXPIRED', 'NO_DRIVER_FOUND', 'COMPLETED', 'CANCELED'];
const center = { lat: 10.7769, lng: 106.7008 };
const uuid = (prefix, n) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const customerId = n => uuid('1', n);
const driverId = n => uuid('2', n);
const bookingId = n => uuid('3', n);
const tripId = n => uuid('4', n);
const paymentId = n => uuid('5', n);
const dbNames = ['identity', 'customer', 'driver', 'booking', 'trip', 'payment'];
const pools = Object.fromEntries(dbNames.map(name => [name, new Pool({
  host: 'localhost', port: 5432, user: name, database: `${name}_db`,
  password: env[`${name.toUpperCase()}_DB_PASSWORD`],
})]));
const redisCli = (...args) => execFileSync('docker', [
  'compose', '-f', path.join(__dirname, '..', 'docker-compose.yml'),
  'exec', '-T', 'redis', 'redis-cli', ...args,
], { encoding: 'utf8' }).trim();
const customer = Array.from({ length: 5 }, (_, i) => ({
  n: i + 1, id: customerId(i + 1), email: `kh${String(i + 1).padStart(2, '0')}@gmail.com`,
  phone: `039000000${i + 1}`, name: `Khách hàng ${String(i + 1).padStart(2, '0')}`,
}));
const driver = Array.from({ length: 10 }, (_, i) => ({
  n: i + 1, id: driverId(i + 1), email: `dr${String(i + 1).padStart(2, '0')}@gmail.com`,
  phone: driverPhones[i], name: `Tài xế ${String(i + 1).padStart(2, '0')}`,
  status: i < 2 ? 'ONLINE' : i < 7 ? 'OFFLINE' : 'PENDING_APPROVAL',
  lat: center.lat + (i % 5) * 0.00025,
  lng: center.lng + Math.floor(i / 5) * 0.00025,
}));

async function resetPg(name) {
  const client = await pools[name].connect();
  try {
    const { rows } = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_migrations'`);
    await client.query('BEGIN');
    if (rows.length) {
      const names = rows.map(r => `"public"."${r.tablename.replaceAll('"', '""')}"`).join(', ');
      await client.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
    }
    await client.query('COMMIT');
    console.log(`Cleared ${name}_db (${rows.length} tables)`);
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function seedIdentity() {
  const db = pools.identity;
  await db.query("INSERT INTO roles(code,name) VALUES ('CUSTOMER','Customer'),('DRIVER','Driver')");
  for (const person of [...customer, ...driver]) {
    await db.query(`INSERT INTO accounts(id,email,phone_hash,password_hash,display_name,status)
      VALUES($1,$2,$3,$4,$5,'ACTIVE')`,
      [person.id, person.email, hashPhone(person.phone), passwordHash, person.name]);
    await db.query(`INSERT INTO account_roles(account_id,role_code,is_primary) VALUES($1,$2,true)`,
      [person.id, person.email.startsWith('kh') ? 'CUSTOMER' : 'DRIVER']);
  }
  await ensureDemoAdmin(db);
}

async function seedProfiles() {
  for (const c of customer) {
    await pools.customer.query(`INSERT INTO customer_profiles(id,full_name,email,phone_enc,phone_hash,status)
      VALUES($1,$2,$3,$4,$5,'ACTIVE')`, [c.id, c.name, c.email, encrypt(c.phone), hashPhone(c.phone)]);
  }
  for (const d of driver) {
    await pools.driver.query(`INSERT INTO drivers(id,phone_enc,phone_hash,national_id_enc,national_id_hash,
      full_name,email,date_of_birth,license_number_enc,license_class,license_expiry_date,status)
      VALUES($1,$2,$3,$4,$5,$6,$7,'1990-01-01',$8,'A1','2035-12-31',$9)`,
      [d.id, encrypt(d.phone), hashPhone(d.phone), encrypt(`00123456${String(d.n).padStart(4, '0')}`),
        hashNationalId(`00123456${String(d.n).padStart(4, '0')}`), d.name, d.email,
        encrypt(`A1-DEMO-${d.n}`), d.status]);
    await pools.driver.query(`INSERT INTO vehicles(driver_id,vehicle_type,plate_number,brand,model,color,
      manufacture_year,seat_count,is_active) VALUES($1,'BIKE',$2,'Honda','Wave','Đen',2023,1,true)`,
      [d.id, `59A-${String(d.n).padStart(5, '0')}`]);
    await pools.driver.query(`INSERT INTO driver_locations(driver_id,latitude,longitude) VALUES($1,$2,$3)`,
      [d.id, d.lat, d.lng]);
  }
}

async function seedRides() {
  await pools.trip.query(`INSERT INTO fare_rules(vehicle_type,base_fare,per_km,is_active)
    VALUES('BIKE',12000,4000,true)`);
  let bookingNo = 0;
  let tripNo = 0;
  for (const c of customer) {
    for (let slot = 0; slot < 9; slot++) {
      const status = slot < 5 ? statuses[slot] : 'COMPLETED';
      const b = bookingId(++bookingNo);
      const lat = center.lat + (c.n - 1) * 0.00015 + (slot % 3) * 0.0001;
      const lng = center.lng + (slot % 2) * 0.0001;
      const assignedDriver = driver[(tripNo + c.n) % 7];
      const completed = status === 'COMPLETED';
      const t = completed ? tripId(++tripNo) : null;
      const fare = completed ? 24000 : calculateFare(lat, lng, lat + 0.02, lng + 0.02).amount;
      await pools.booking.query(`INSERT INTO bookings(id,customer_id,vehicle_type,pickup_address,pickup_lat,pickup_lng,
        destination_address,destination_lat,destination_lng,status,trip_id,current_driver_id,
        completed_at,canceled_at,cancel_reason,assigned_at,search_expires_at,fare,payment_status)
        VALUES($1,$2,'BIKE',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [b, c.id, `Điểm đón ${c.n}-${slot + 1}`, lat, lng, `Điểm đến ${c.n}-${slot + 1}`,
          lat + 0.02, lng + 0.02, status, t,
          completed ? assignedDriver.id : null,
          completed ? new Date() : null, status === 'CANCELED' ? new Date() : null,
          status === 'CANCELED' ? 'CUSTOMER_REQUEST' : null,
          completed ? new Date() : null,
          status === 'SEARCHING' ? new Date(Date.now() + 30 * 60 * 1000) : null,
          fare, completed ? 'PAID' : null]);
      await pools.booking.query(`INSERT INTO booking_status_history(booking_id,to_status,actor_id,actor_role)
        VALUES($1,$2,$3,'CUSTOMER')`, [b, status, c.id]);
      if (completed) {
        const stars = ((tripNo - 1) % 5) + 1;
        const p = paymentId(tripNo);
        await pools.trip.query(`INSERT INTO trips(id,booking_id,customer_id,driver_id,vehicle_type,
          pickup_address,pickup_lat,pickup_lng,destination_address,destination_lat,destination_lng,
          distance_km,base_fare,per_km_fare,fare,status,payment_status,payment_id,completed_at,driver_snapshot)
          VALUES($1,$2,$3,$4,'BIKE',$5,$6,$7,$8,$9,$10,3,12000,4000,24000,'COMPLETED','PAID',$11,NOW(),$12)`,
          [t, b, c.id, assignedDriver.id, `Điểm đón ${c.n}-${slot + 1}`, lat, lng,
            `Điểm đến ${c.n}-${slot + 1}`, lat + 0.02, lng + 0.02, p,
            JSON.stringify({ fullName: assignedDriver.name, vehicle: { vehicleType: 'BIKE', plateNumber: `59A-${String(assignedDriver.n).padStart(5, '0')}` } })]);
        await pools.trip.query(`INSERT INTO trip_status_history(trip_id,to_status,actor_id,actor_role)
          VALUES($1,'COMPLETED',$2,'DRIVER')`, [t, assignedDriver.id]);
        await pools.trip.query(`INSERT INTO reviews(trip_id,customer_id,driver_id,stars,comment)
          VALUES($1,$2,$3,$4,$5)`, [t, c.id, assignedDriver.id, stars,
            `Đánh giá ${stars} sao cho chuyến đi ${slot + 1} của ${c.email}`]);
        await pools.payment.query(`INSERT INTO payments(id,trip_id,customer_id,amount,status,completed_at)
          VALUES($1,$2,$3,24000,'COMPLETED',NOW())`, [p, t, c.id]);
      }
    }
  }
  // Two active search offers let both online drivers exercise GET /offers.
  for (let i = 0; i < 2; i++) {
    await pools.booking.query(`INSERT INTO offers(booking_id,driver_id,attempt_no,status,
      distance_to_pickup_m,eta_seconds,expires_at)
      VALUES($1,$2,1,'PENDING',$3,$4,NOW() + INTERVAL '30 minutes')`,
      [bookingId(i * 9 + 1), driver[i].id, i * 28, i * 4]);
    await pools.booking.query(`UPDATE bookings SET attempt_count=1,
      next_dispatch_at=NOW() + INTERVAL '30 minutes' WHERE id=$1`, [bookingId(i * 9 + 1)]);
  }
  const ratings = (await pools.trip.query(`SELECT driver_id, COUNT(*)::int AS n,
    SUM(stars)::int AS stars FROM reviews GROUP BY driver_id`)).rows;
  for (const rating of ratings) {
    await pools.driver.query(`UPDATE drivers SET rating_count=$1,rating_sum=$2,
      rating_avg=ROUND($2::numeric/$4::numeric,2),completed_trips=$1 WHERE id=$3`,
      [rating.n, rating.stars, rating.driver_id, rating.n]);
  }
}

async function main() {
  if (driverPhones.length !== 10 || new Set(driverPhones).size !== 10) throw new Error('Invalid driver phones');
  redisCli('PING');
  const mongo = new MongoClient(`mongodb://notification:${encodeURIComponent(env.NOTIFICATION_DB_PASSWORD)}@localhost:27017/notification_db?authSource=admin`);
  try {
    for (const name of dbNames) await resetPg(name);
    await mongo.connect();
    const collections = await mongo.db('notification_db').listCollections().toArray();
    for (const collection of collections) await mongo.db('notification_db').collection(collection.name).deleteMany({});
    console.log(`Cleared notification_db (${collections.length} collections)`);
    redisCli('FLUSHDB');
    console.log('Cleared Redis');
    await seedIdentity();
    await seedProfiles();
    await seedRides();
    redisCli('GEOADD', 'driver:geo', ...driver.flatMap(d => [String(d.lng), String(d.lat), d.id]));
    for (let i = 0; i < 2; i++) {
      redisCli('SET', `driver:reserve:${driver[i].id}`, bookingId(i * 9 + 1), 'EX', '1700');
    }
    console.log('Seeded 1 admin, 5 customers, 10 drivers, 45 bookings, 25 completed trips, 25 reviews, 25 payments, 2 offers');
  } finally {
    await mongo.close();
    await Promise.all(Object.values(pools).map(pool => pool.end()));
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
