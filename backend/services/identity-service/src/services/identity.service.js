const { isValidEmail, isValidPhone, isValidPassword } = require("../../../../shared/src/validation/index");

function validateRegistration({ fullName, email, phone, password }) {
  const errors = [];
  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    errors.push("fullName is required");
  }
  if (!email || !isValidEmail(email)) {
    errors.push("email must be a valid email address");
  }
  if (!phone || !isValidPhone(phone)) {
    errors.push("phone must contain exactly 10 digits");
  }
  if (!isValidPassword(password)) {
    errors.push("password must be at least 8 characters");
  }
  return errors;
}

module.exports = { validateRegistration };
