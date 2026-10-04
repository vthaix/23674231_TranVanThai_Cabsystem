function maskPhone(phone) {
  // 0901234567 -> 090•••••567
  if (!phone || phone.length < 6) return "•••••";
  return phone.slice(0, 3) + "•••••" + phone.slice(-3);
}

module.exports = { maskPhone };
