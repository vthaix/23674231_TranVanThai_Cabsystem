const express = require("express");
const { pool } = require("../db/postgres");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/auth/demo/storage/:id", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV !== "development") return res.status(404).json({ code: "NOT_FOUND" });
  if (req.user.role !== "ADMIN") return res.status(403).json({ code: "FORBIDDEN" });
  try {
    const { rows } = await pool.query("SELECT password_hash, phone_hash FROM accounts WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ code: "NOT_FOUND" });
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      accountId: req.params.id,
      passwordHashPrefix: rows[0].password_hash.slice(0, 4),
      passwordIsBcrypt: /^\$2[aby]\$/.test(rows[0].password_hash),
      phoneIsHashed: /^[a-f0-9]{64}$/.test(rows[0].phone_hash)
    });
  } catch (error) {
    console.error("[identity/demo/storage]", error.message);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

module.exports = router;
