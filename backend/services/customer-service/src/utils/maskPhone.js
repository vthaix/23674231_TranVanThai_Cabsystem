function maskPhone(phone) {
  // +84901234567 -> +84•••••567
  if (!phone || phone.length < 6) return "•••••";
  return phone.slice(0, 3) + "•••••" + phone.slice(-3);
}

module.exports = { maskPhone };
