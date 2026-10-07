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
const distance = (a, b) => {
  const rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

async function main() {
  try {
    expect(await count('identity', 'accounts'), 16, 'Accounts');
    expect((await pools.identity.query(`SELECT COUNT(*)::int AS n FROM accounts a
      JOIN account_roles ar ON ar.account_id=a.id
      WHERE a.email='admin@gmail.com' AND a.status='ACTIVE' AND ar.role_code='ADMIN'`)).rows[0].n,
      1, 'Admin account');
    expect(await count('customer', 'customer_profiles'), 5, 'Customer profiles');
    expect(await count('driver', 'drivers'), 10, 'Drivers');
    expect(await count('booking', 'bookings'), 45, 'Bookings');
    expect(await count('booking', 'offers'), 2, 'Offers');
    expect(await count('trip', 'trips'), 25, 'Trips');
    expect(await count('trip', 'reviews'), 25, 'Reviews');
    expect(await count('payment', 'payments'), 25, 'Payments');
    const b = (await pools.booking.query(`SELECT customer_id,status,count(*)::int n FROM bookings GROUP BY customer_id,status`)).rows;
    const t = (await pools.trip.query(`SELECT customer_id,count(*)::int n FROM trips WHERE status='COMPLETED' GROUP BY customer_id`)).rows;
    const r = (await pools.trip.query(`SELECT customer_id,count(*)::int n,min(stars) lo,max(stars) hi,
      count(*) FILTER (WHERE comment IS NULL OR comment='')::int missing FROM reviews GROUP BY customer_id`)).rows;
    for (const c of new Set(b.map(x => x.customer_id))) {
      expect(b.filter(x => x.customer_id === c).reduce((sum, x) => sum + x.n, 0), 9, `${c} bookings`);
      expect(b.find(x => x.customer_id === c && x.status === 'NO_DRIVER_FOUND')?.n, 1,
        `${c} NO_DRIVER_FOUND`);
      expect(b.find(x => x.customer_id === c && x.status === 'COMPLETED')?.n, 5, `${c} COMPLETED`);
      const active = b.filter(x => x.customer_id === c && ['SEARCHING', 'ASSIGNED'].includes(x.status))
        .reduce((sum, x) => sum + x.n, 0);
      if (active > 1) throw new Error(`${c} has ${active} active bookings`);
      console.log(`${c} active bookings: ${active}`);
      expect(t.find(x => x.customer_id === c)?.n, 5, `${c} completed trips`);
      const review = r.find(x => x.customer_id === c);
      expect(review?.n, 5, `${c} reviews`);
      expect(review?.lo, 1, `${c} min stars`);
      expect(review?.hi, 5, `${c} max stars`);
      expect(review?.missing, 0, `${c} missing comments`);
    }
    const drivers = (await pools.driver.query(`SELECT d.id,d.email,d.status,l.latitude,l.longitude
      FROM drivers d JOIN driver_locations l ON l.driver_id=d.id ORDER BY d.email`)).rows;
    expect(drivers.filter(d => d.status === 'ONLINE').length, 10, 'Online drivers');
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
