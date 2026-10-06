function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * toRad / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
    Math.sin((lon2 - lon1) * toRad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateFare(lat1, lon1, lat2, lon2) {
  const meters = distanceMeters(lat1, lon1, lat2, lon2);
  return { distanceMeters: Math.round(meters), amount: Math.max(900, Math.ceil(meters / 100) * 900) };
}

module.exports = { distanceMeters, calculateFare };
