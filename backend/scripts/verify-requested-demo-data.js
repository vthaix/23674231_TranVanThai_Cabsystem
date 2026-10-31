const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { runMongoScript } = require('./mongo-internal');

const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  .split(/\r?\n/).filter(line => line && !line.startsWith('#'))
  .map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
const names = ['identity', 'customer', 'driver', 'booking', 'trip', 'payment'];
const pools = Object.fromEntries(names.map(name => [name, new Pool({
  host: 'localhost', user: name, database: `${name}_db`, password: env[`${name.toUpperCase()}_DB_PASSWORD`],
})]));
const expect = (actual, wanted, label) => {
  if (Number(actual) !== wanted) throw new Error(`${label}: expected ${wanted}, got ${actual}`);
  console.log(`${label}: ${actual}`);
};
const count = async (name, table) => (await pools[name].query(`SELECT COUNT(*)::int AS n FROM ${table}`)).rows[0].n;
const seedId = (prefix, n) => `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const distance = (a, b) => {
  const rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

async function main() {
  try {
    expect(await count('identity', 'accounts'), 17, 'Accounts');
    expect((await pools.identity.query(`SELECT COUNT(*)::int AS n FROM accounts a
      JOIN account_roles ar ON ar.account_id=a.id
      WHERE a.email='admin@gmail.com' AND a.status='ACTIVE' AND ar.role_code='ADMIN'`)).rows[0].n,
      1, 'Admin account');
    const publicIds = (await pools.identity.query('SELECT email,public_id FROM accounts ORDER BY public_id')).rows;
    const expectedEmails = [
      'admin@gmail.com',
      ...Array.from({ length: 5 }, (_, i) => `kh${String(i + 1).padStart(2, '0')}@gmail.com`),
      ...Array.from({ length: 11 }, (_, i) => `dr${String(i + 1).padStart(2, '0')}@gmail.com`),
    ];
    for (const [index, account] of publicIds.entries()) {
      const expectedId = `user_${String(index + 1).padStart(2, '0')}`;
      if (account.public_id !== expectedId || account.email !== expectedEmails[index]) {
        throw new Error(`Expected ${expectedEmails[index]} as ${expectedId}, got ${account.email} as ${account.public_id}`);
      }
    }
    expect(await count('customer', 'customer_profiles'), 5, 'Customer profiles');
    expect(await count('driver', 'drivers'), 11, 'Drivers');
    const pendingId = seedId('2', 11);
    expect((await pools.identity.query(`SELECT COUNT(*)::int AS n FROM accounts a
      JOIN account_roles ar ON ar.account_id=a.id AND ar.is_primary=true
      WHERE a.id=$1 AND a.email='dr11@gmail.com' AND a.public_id='user_17'
        AND a.status='PENDING' AND ar.role_code='DRIVER'`, [pendingId])).rows[0].n,
      1, 'Pending driver account');
    expect((await pools.driver.query(`SELECT COUNT(*)::int AS n FROM drivers d
      JOIN vehicles v ON v.driver_id=d.id AND v.is_active=true
      LEFT JOIN driver_locations l ON l.driver_id=d.id
      WHERE d.id=$1 AND d.email='dr11@gmail.com' AND d.status='PENDING_APPROVAL'
        AND d.license_class='A1' AND v.vehicle_type='BIKE' AND v.model='Wave'
        AND l.driver_id IS NULL`, [pendingId])).rows[0].n,
      1, 'Pending driver profile');
    expect((await pools.driver.query(`SELECT COUNT(*)::int AS n FROM drivers
      WHERE status='PENDING_APPROVAL'`)).rows[0].n, 1, 'Pending drivers');
    expect(await count('booking', 'bookings'), 47, 'Bookings');
    expect(await count('booking', 'offers'), 2, 'Offers');
    expect(await count('trip', 'trips'), 27, 'Trips');
    expect(await count('trip', 'reviews'), 26, 'Reviews');
    expect(await count('payment', 'payments'), 26, 'Payments');
    const b = (await pools.booking.query(`SELECT customer_id,status,count(*)::int n FROM bookings GROUP BY customer_id,status`)).rows;
    const t = (await pools.trip.query(`SELECT customer_id,count(*)::int n FROM trips WHERE status='COMPLETED' GROUP BY customer_id`)).rows;
    const r = (await pools.trip.query(`SELECT customer_id,count(*)::int n,min(stars) lo,max(stars) hi,
      count(*) FILTER (WHERE comment IS NULL OR comment='')::int missing FROM reviews GROUP BY customer_id`)).rows;
    for (const c of new Set(b.map(x => x.customer_id))) {
      const hasExamples = c === seedId('1', 1);
      expect(b.filter(x => x.customer_id === c).reduce((sum, x) => sum + x.n, 0), hasExamples ? 11 : 9, `${c} bookings`);
      expect(b.find(x => x.customer_id === c && x.status === 'NO_DRIVER_FOUND')?.n, 1,
        `${c} NO_DRIVER_FOUND`);
      expect(b.find(x => x.customer_id === c && x.status === 'COMPLETED')?.n, hasExamples ? 7 : 5, `${c} COMPLETED`);
      const active = b.filter(x => x.customer_id === c && ['SEARCHING', 'ASSIGNED'].includes(x.status))
        .reduce((sum, x) => sum + x.n, 0);
      if (active > 1) throw new Error(`${c} has ${active} active bookings`);
      console.log(`${c} active bookings: ${active}`);
      expect(t.find(x => x.customer_id === c)?.n, hasExamples ? 7 : 5, `${c} completed trips`);
      const review = r.find(x => x.customer_id === c);
      expect(review?.n, hasExamples ? 6 : 5, `${c} reviews`);
      expect(review?.lo, 1, `${c} min stars`);
      expect(review?.hi, 5, `${c} max stars`);
      expect(review?.missing, 0, `${c} missing comments`);
    }
    const drivers = (await pools.driver.query(`SELECT d.id,d.email,d.status,l.latitude,l.longitude
      FROM drivers d JOIN driver_locations l ON l.driver_id=d.id ORDER BY d.email`)).rows;
    expect(drivers.filter(d => d.status === 'ONLINE').length, 7, 'Online drivers');
    expect(drivers.filter(d => d.status === 'OFFLINE').length, 3, 'Offline drivers');
    for (let i = 1; i < drivers.length; i++) {
      const previous = drivers[i - 1], current = drivers[i];
      const meters = distance(
        { lat: Number(previous.latitude), lng: Number(previous.longitude) },
        { lat: Number(current.latitude), lng: Number(current.longitude) }
      );
      if (Math.abs(meters - 100) > 1)
        throw new Error(`${previous.email} to ${current.email}: expected ~100m, got ${meters.toFixed(1)}m`);
    }
    const bookings = (await pools.booking.query(`SELECT pickup_lat,pickup_lng,status FROM bookings`)).rows;
    for (const d of drivers) {
      const pos = { lat: Number(d.latitude), lng: Number(d.longitude) };
      if (!bookings.some(b => distance(pos, {lat: Number(b.pickup_lat), lng: Number(b.pickup_lng)}) < 600))
        throw new Error(`Driver ${d.id} is not within 600m of a booking`);
    }
    for (const b of bookings.filter(b => b.status === 'SEARCHING')) {
      const pos = { lat: Number(b.pickup_lat), lng: Number(b.pickup_lng) };
      for (const d of drivers.filter(d => d.status === 'ONLINE')) {
        if (distance(pos, {lat: Number(d.latitude), lng: Number(d.longitude)}) >= 600)
          throw new Error('SEARCHING booking too far from an ONLINE driver');
      }
    }
    const tripRows = (await pools.trip.query('SELECT id,booking_id,customer_id,driver_id FROM trips')).rows;
    const bookingRows = (await pools.booking.query('SELECT id,customer_id,current_driver_id,trip_id,status FROM bookings')).rows;
    for (const trip of tripRows) {
      const booking = bookingRows.find(b => b.id === trip.booking_id);
      if (!booking || booking.customer_id !== trip.customer_id || booking.current_driver_id !== trip.driver_id ||
          booking.trip_id !== trip.id || booking.status !== 'COMPLETED')
        throw new Error(`Inconsistent trip ${trip.id}`);
    }
    for (const example of [
      { number: 26, reviewed: false, paid: true },
      { number: 27, reviewed: true, paid: false },
    ]) {
      const id = seedId('4', example.number);
      const trip = (await pools.trip.query('SELECT booking_id,customer_id,status,payment_status,payment_id FROM trips WHERE id=$1', [id])).rows[0];
      if (!trip || trip.customer_id !== seedId('1', 1) || trip.status !== 'COMPLETED' ||
          trip.payment_status !== (example.paid ? 'PAID' : 'UNPAID') ||
          Boolean(trip.payment_id) !== example.paid) throw new Error(`Invalid example trip ${id}`);
      const booking = (await pools.booking.query('SELECT payment_status FROM bookings WHERE id=$1', [trip.booking_id])).rows[0];
      if (booking?.payment_status !== trip.payment_status) throw new Error(`Payment status mismatch for ${id}`);
      expect((await pools.trip.query('SELECT COUNT(*)::int AS n FROM reviews WHERE trip_id=$1', [id])).rows[0].n,
        Number(example.reviewed), `${id} reviews`);
      expect((await pools.payment.query('SELECT COUNT(*)::int AS n FROM payments WHERE trip_id=$1', [id])).rows[0].n,
        Number(example.paid), `${id} payments`);
    }
    const driverCounts = (await pools.driver.query('SELECT id,completed_trips,rating_count FROM drivers')).rows;
    const tripCounts = (await pools.trip.query(`SELECT driver_id,COUNT(*)::int AS n FROM trips
      WHERE status='COMPLETED' GROUP BY driver_id`)).rows;
    const reviewCounts = (await pools.trip.query(`SELECT driver_id,COUNT(*)::int AS n FROM reviews GROUP BY driver_id`)).rows;
    for (const d of driverCounts) {
      expect(d.completed_trips, tripCounts.find(x => x.driver_id === d.id)?.n || 0, `${d.id} completed trips`);
      expect(d.rating_count, reviewCounts.find(x => x.driver_id === d.id)?.n || 0, `${d.id} rating count`);
    }
    const notificationCount = Number(runMongoScript(
      'print(db.getCollectionNames().reduce((sum, name) => sum + db.getCollection(name).countDocuments({}), 0));'
    ));
    expect(notificationCount, 0, 'Mongo notifications');
    console.log('All checks passed');
  } finally {
    await Promise.all(Object.values(pools).map(pool => pool.end()));
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
