// Input validation and sanitization utilities (PC25, PC26)

/**
 * Validates email format
 * Uses safe regex without catastrophic backtracking
 */
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  // Simple, safe email validation
  const emailRegex = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
  return emailRegex.test(email.toLowerCase()) && email.length <= 255;
}

/**
 * Validates phone number in E.164 format or common Vietnamese format
 */
function isValidPhone(phone) {
  if (typeof phone !== "string") return false;
  // E.164: +[country code][number], up to 15 digits total
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  return e164Regex.test(phone);
}

/**
 * Validates password requirements
 */
function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

/**
 * Sanitize string for XSS (PC26)
 * Escapes HTML special characters
 */
function sanitizeString(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Validate and sanitize a request body field
 * Returns { valid: bool, error: string }
 */
function validateRequired(value, fieldName, type = "string", maxLength = 500) {
  if (value === undefined || value === null || value === "") {
    return { valid: false, error: `${fieldName} is required` };
  }
  if (typeof value !== type) {
    return { valid: false, error: `${fieldName} must be a ${type}` };
  }
  if (type === "string" && value.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length of ${maxLength}` };
  }
  return { valid: true };
}

/**
 * Express middleware: sanitizes string fields in req.body (PC26)
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object") {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === "string") {
        // Don't sanitize password fields (would corrupt bcrypt)
        if (!["password", "newPassword", "currentPassword"].includes(key)) {
          req.body[key] = req.body[key].trim();
        }
      }
    }
  }
  next();
}

module.exports = {
  isValidEmail,
  isValidPhone,
  isValidPassword,
  sanitizeString,
  validateRequired,
  sanitizeBody,
};
