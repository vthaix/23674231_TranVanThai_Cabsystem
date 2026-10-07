// Input validation and sanitization utilities (PC25, PC26)

/**
 * Validates email format
 * Uses safe regex without catastrophic backtracking
 */
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  // Simple, safe email validation
  const emailRegex = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$/;
  return emailRegex.test(email.toLowerCase()) && email.length <= 255;
}

/**
 * A phone number is exactly 10 digits, with no country prefix or separators.
 */
function isValidPhone(phone) {
  if (typeof phone !== "string") return false;
  return /^\d{10}$/.test(phone);
}

/**
 * Validates password requirements
 */
function isValidPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

function isPlainCode(value) {
  return typeof value === "string" && /^[A-Za-z0-9._/-]+$/.test(value);
}

/**
 * Sanitize string for XSS (PC26)
 * Escapes HTML special characters
 */
function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Keep the existing name for callers that already use it.
const sanitizeString = escapeHTML;

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
  isPlainCode,
  escapeHTML,
  sanitizeString,
  validateRequired,
  sanitizeBody,
};
