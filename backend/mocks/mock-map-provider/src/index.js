const express = require("express");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 4002);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "mock-map-provider" });
});

app.get("/geocode", (req, res) => {
  const { address = "" } = req.query;
  // Deterministic or default coordinate around HCMC
  res.json({
    lat: 10.776889,
    lng: 106.700806,
    formattedAddress: address || "Quận 1, Thành phố Hồ Chí Minh, Việt Nam"
  });
});

app.get("/route", (req, res) => {
  const { fromLat, fromLng, toLat, toLng } = req.query;

  const lat1 = Number(fromLat || 10.776889);
  const lon1 = Number(fromLng || 106.700806);
  const lat2 = Number(toLat || 10.795000);
  const lon2 = Number(toLng || 106.721944);

  // Haversine
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const rawDist = R * c;

  // Road factor ~1.3
  const distanceKm = Math.max(1.0, Math.round(rawDist * 1.3 * 10) / 10);
  const durationSec = Math.round((distanceKm / 30) * 3600); // 30 km/h avg speed

  res.json({
    distanceKm,
    durationSec
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`mock-map-provider listening on port ${PORT}`);
});
