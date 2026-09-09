const { v4: uuid } = require("uuid");
const { store } = require("../data/store");
const { findDrivers } = require("./dispatch.service");
const { notify } = require("./notification.service");

const transitions = {
  REQUESTED: ["SEARCHING_DRIVER", "CANCELLED"],
  SEARCHING_DRIVER: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["PASSENGER_PICKED_UP", "CANCELLED"],
  PASSENGER_PICKED_UP: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: []
};

function createTrip({ customerId, pickup, destination, vehicleType }) {
  const trip = {
    tripId: uuid(),
    customerId,
    driverId: null,
    vehicleId: null,
    pickup,
    destination,
    vehicleType,
    status: "SEARCHING_DRIVER",
    fare: null,
    createdAt: new Date().toISOString(),
    completedAt: null
  };

  store.trips.push(trip);
  notify(customerId, "BOOKING_CREATED", "Booking accepted", "Your booking has been created.");

  const candidates = findDrivers(pickup, vehicleType);

  if (candidates.length > 0) {
    trip.status = "DRIVER_ASSIGNED";
    trip.driverId = candidates[0].driverId;
    trip.vehicleId = candidates[0].vehicle.vehicleId;

    const driver = store.drivers.find(d => d.driverId === trip.driverId);
    driver.status = "BUSY";

    notify(customerId, "DRIVER_ASSIGNED", "Driver assigned", "A driver has accepted your trip.");
  }

  return trip;
}

function updateStatus(trip, nextStatus) {
  if (!transitions[trip.status]?.includes(nextStatus)) {
    const error = new Error(`Invalid transition: ${trip.status} -> ${nextStatus}`);
    error.status = 409;
    throw error;
  }

  trip.status = nextStatus;

  if (nextStatus === "COMPLETED") {
    trip.completedAt = new Date().toISOString();
    const driver = store.drivers.find(d => d.driverId === trip.driverId);
    if (driver) driver.status = "AVAILABLE";

    notify(trip.customerId, "TRIP_COMPLETED", "Trip completed", "Your trip has been completed.");
  }

  if (nextStatus === "CANCELLED") {
    const driver = store.drivers.find(d => d.driverId === trip.driverId);
    if (driver) driver.status = "AVAILABLE";
  }

  return trip;
}

module.exports = { createTrip, updateStatus, transitions };
