const express = require("express");
const { auth, allowRoles } = require("../middleware/auth");
const { store } = require("../data/store");

const router = express.Router();
const staff = [auth, allowRoles("OPERATIONS_STAFF", "ADMIN")];

router.get("/operations/customers", ...staff, (req, res) => {
  res.json(store.users.filter(u => u.role === "CUSTOMER").map(({ passwordHash, ...u }) => u));
});

router.get("/operations/customers/:customerId", ...staff, (req, res) => {
  const user = store.users.find(u => u.userId === req.params.customerId && u.role === "CUSTOMER");
  if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });

  const { passwordHash, ...safe } = user;
  res.json(safe);
});

router.patch("/operations/customers/:customerId", ...staff, (req, res) => {
  const user = store.users.find(u => u.userId === req.params.customerId && u.role === "CUSTOMER");
  if (!user) return res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });

  Object.assign(user, {
    fullName: req.body.fullName ?? user.fullName,
    phone: req.body.phone ?? user.phone,
    status: req.body.status ?? user.status,
    updatedAt: new Date().toISOString()
  });

  const { passwordHash, ...safe } = user;
  res.json(safe);
});

router.get("/operations/drivers", ...staff, (req, res) => res.json(store.drivers));
router.get("/operations/vehicles", ...staff, (req, res) => res.json(store.vehicles));

router.get("/operations/trips", ...staff, (req, res) => {
  let result = [...store.trips];

  if (req.query.status) result = result.filter(t => t.status === req.query.status);
  if (req.query.driverId) result = result.filter(t => t.driverId === req.query.driverId);

  res.json(result);
});

router.get("/operations/trips/:tripId", ...staff, (req, res) => {
  const trip = store.trips.find(t => t.tripId === req.params.tripId);
  if (!trip) return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });
  res.json(trip);
});

router.get("/operations/drivers/status", ...staff, (req, res) => {
  res.json(store.drivers.map(d => ({
    driverId: d.driverId,
    fullName: d.fullName,
    status: d.status,
    currentLatitude: d.currentLatitude,
    currentLongitude: d.currentLongitude
  })));
});

module.exports = router;
