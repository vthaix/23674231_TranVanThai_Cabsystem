const { pool } = require("./postgres");
const { encrypt } = require("../../../../shared/src/crypto/index");

const SEED_IDS = {
  customer1: "10000000-0000-4000-8000-000000000001",
  customer2: "10000000-0000-4000-8000-000000000002",
};

async function seed() {
  if (process.env.SEED_ON_START !== "true") return;
  const client = await pool.connect();
  try {
    console.log("[SEED] Starting customer seed...");

    const customers = [
      {
        id: SEED_IDS.customer1,
        fullName: "Nguyen Van A",
        email: "customer1@example.com",
        phone: "0901000001",
        phoneHash: require("../../../../shared/src/crypto/index").hashPhone("0901000001"),
      },
      {
        id: SEED_IDS.customer2,
        fullName: "Tran Thi B",
        email: "customer2@example.com",
        phone: "0901000002",
        phoneHash: require("../../../../shared/src/crypto/index").hashPhone("0901000002"),
      },
    ];

    for (const c of customers) {
      const phoneEnc = encrypt(c.phone);
      await client.query(
        `INSERT INTO customer_profiles (id, full_name, email, phone_enc, phone_hash, status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.fullName, c.email, phoneEnc, c.phoneHash]
      );
    }

    console.log("[SEED] Customer seed completed.");
  } catch (err) {
    console.error("[SEED] Customer seed failed:", err.message);
  } finally {
    client.release();
  }
}

module.exports = { seed };
