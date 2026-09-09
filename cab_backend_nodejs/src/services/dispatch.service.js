const { store } = require("../data/store");

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findDrivers(pickup, vehicleType) {
  return store.drivers
    .filter(d => d.status === "AVAILABLE")
    .map(driver => {
      const vehicle = store.vehicles.find(v => v.driverId === driver.driverId);
      if (!vehicle || vehicle.vehicleType !== vehicleType) return null;

      return {
        ...driver,
        vehicle,
        distanceKm: distanceKm(
          pickup.latitude,
          pickup.longitude,
          driver.currentLatitude,
          driver.currentLongitude
        )
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

module.exports = { findDrivers };
