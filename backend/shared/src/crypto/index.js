const crypto = require("crypto");

// AES-256-GCM encryption for sensitive data at rest (PC24)
// Format: enc:v1:<keyId>:<iv_hex>:<tag_hex>:<ciphertext_hex>

function getEncryptionKey() {
  const keyStr = process.env.DATA_ENCRYPTION_KEYS || "key1=changeme-32-byte-key-padding!";
  const activeKeyId = process.env.DATA_ENCRYPTION_ACTIVE_KEY_ID || "key1";

  // Parse key=value pairs
  const keys = {};
  for (const part of keyStr.split(",")) {
    const [id, ...rest] = part.split("=");
    if (id && rest.length) {
      const rawKey = rest.join("=").trim();
      // Derive 32-byte key from whatever string provided
      keys[id.trim()] = crypto.createHash("sha256").update(rawKey).digest();
    }
  }

  if (!keys[activeKeyId]) {
    // Fallback dev key
    keys[activeKeyId] = crypto.createHash("sha256").update("dev-encryption-key").digest();
  }

  return { keys, activeKeyId };
}

function encrypt(plaintext) {
  if (!plaintext) return null;
  const { keys, activeKeyId } = getEncryptionKey();
  const key = keys[activeKeyId];
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${activeKeyId}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(encryptedStr) {
  if (!encryptedStr) return null;
  if (!encryptedStr.startsWith("enc:v1:")) return encryptedStr; // not encrypted
  const parts = encryptedStr.split(":");
  if (parts.length !== 6 || !parts[5]) throw new Error("Invalid encrypted format");
  const keyId = parts[2];
  const iv = Buffer.from(parts[3], "hex");
  const tag = Buffer.from(parts[4], "hex");
  const ciphertext = Buffer.from(parts.slice(5).join(":"), "hex");

  const { keys } = getEncryptionKey();
  const key = keys[keyId];
  if (!key) throw new Error(`Unknown key id: ${keyId}`);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

function hashPhone(phone) {
  const pepper = process.env.PHONE_HASH_PEPPER || "dev-phone-pepper";
  return crypto.createHmac("sha256", pepper).update(phone).digest("hex");
}

function hashNationalId(id) {
  const pepper = process.env.NATIONAL_ID_HASH_PEPPER || "dev-national-id-pepper";
  return crypto.createHmac("sha256", pepper).update(id).digest("hex");
}

function hashPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

module.exports = { encrypt, decrypt, hashPhone, hashNationalId, hashPayload };
