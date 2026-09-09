const { v4: uuid } = require("uuid");

const store = {
  users: [],
  drivers: [],
  vehicles: [],
  trips: [],
  payments: [],
  ratings: [],
  notifications: []
};

function seed() {
  if (store.drivers.length > 0) return;

  const driverId = uuid();
  const vehicleId = uuid();

  store.drivers.push({
    driverId,
    fullName: "Nguyen Van A",
    phone: "0900000001",
    email: "driver1@cab.local",
    status: "AVAILABLE",
    currentLatitude: 10.7769,
    currentLongitude: 106.7009,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  store.vehicles.push({
    vehicleId,
    driverId,
    vehicleType: "MOTORBIKE",
    licensePlate: "59-A1-00001",
    model: "Honda Vision",
    status: "ACTIVE"
  });
}

seed();

module.exports = { store };
