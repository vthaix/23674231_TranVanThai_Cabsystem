const express = require("express");
const { pool } = require("../db/postgres");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

router.get("/drivers/:id/storage", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV !== "development") return res.status(404).json({ code: "NOT_FOUND" });
  if (req.user.role !== "ADMIN") return res.status(403).json({ code: "FORBIDDEN" });
  try {
    const { rows } = await pool.query(
      "SELECT phone_enc, license_number_enc FROM drivers WHERE id = $1", [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ code: "NOT_FOUND" });
    const phoneParts = rows[0].phone_enc?.split(":") || [];
    const licenseParts = rows[0].license_number_enc?.split(":") || [];
    res.setHeader("Cache-Control", "no-store");
    return res.json({
      driverId: req.params.id,
      phoneEncrypted: phoneParts.length === 6 && phoneParts[0] === "enc" && phoneParts[1] === "v1",
      licenseEncrypted: licenseParts.length === 6 && licenseParts[0] === "enc" && licenseParts[1] === "v1",
      phoneKeyId: phoneParts[2] || null,
      licenseKeyId: licenseParts[2] || null
    });
  } catch (error) {
    console.error("[driver/demo/storage]", error.message);
    return res.status(500).json({ code: "INTERNAL_ERROR" });
  }
});

module.exports = router;
