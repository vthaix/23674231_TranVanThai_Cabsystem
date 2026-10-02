const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 4001);
const PAYMENT_CALLBACK_SECRET = process.env.PAYMENT_CALLBACK_SECRET || "dev-callback-secret-key-32b!";
const MOCK_CALLBACK_DELAY_MS = Number(process.env.MOCK_CALLBACK_DELAY_MS || 1000);

const transactions = new Map();

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "mock-payment-provider" });
});

async function sendCallback(txn, result = "SUCCESS") {
  const payload = {
    provider: "MOCK_PAYMENT",
    providerEventId: crypto.randomUUID(),
    providerTransactionId: txn.providerTransactionId,
    paymentId: txn.merchantRef,
    status: result,
    amount: txn.amount,
    currency: txn.currency,
    occurredAt: new Date().toISOString()
  };

  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", PAYMENT_CALLBACK_SECRET).update(rawBody).digest("hex");

  const targetUrl = txn.callbackUrl || "http://payment-service:3005/payments/callback";

  try {
    const resp = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-signature": signature
      },
      body: rawBody
    });
    console.log(`[MOCK PAYMENT CALLBACK] Sent to ${targetUrl}, status=${resp.status}`);
  } catch (err) {
    console.warn(`[MOCK PAYMENT CALLBACK] Failed to send callback to ${targetUrl}:`, err.message);
  }
}

app.post("/transactions", (req, res) => {
  const { merchantRef, amount, currency = "VND", callbackUrl } = req.body;
  const providerTransactionId = "mock_tx_" + crypto.randomBytes(12).toString("hex");

  const txn = {
    providerTransactionId,
    merchantRef,
    amount: Number(amount),
    currency,
    callbackUrl: callbackUrl || "http://payment-service:3005/payments/callback",
    status: "PENDING",
    createdAt: new Date().toISOString()
  };

  transactions.set(providerTransactionId, txn);

  // Auto trigger callback after delay if enabled
  if (MOCK_CALLBACK_DELAY_MS > 0) {
    setTimeout(() => {
      sendCallback(txn, "SUCCESS");
    }, MOCK_CALLBACK_DELAY_MS);
  }

  return res.status(202).json({
    providerTransactionId,
    status: "PENDING",
    merchantRef,
    message: "Payment transaction accepted"
  });
});

app.post("/mock/transactions/:id/complete", async (req, res) => {
  const { id } = req.params;
  const result = req.query.result === "FAILED" ? "FAILED" : "SUCCESS";
  const txn = transactions.get(id);

  if (!txn) {
    // Generate dummy txn for testing
    const dummy = {
      providerTransactionId: id,
      merchantRef: req.body.paymentId || id,
      amount: req.body.amount || 50000,
      callbackUrl: req.body.callbackUrl || "http://payment-service:3005/payments/callback"
    };
    await sendCallback(dummy, result);
    return res.json({ success: true, message: `Callback dispatched for ${id} with result ${result}` });
  }

  await sendCallback(txn, result);
  return res.json({ success: true, message: `Callback dispatched for ${id} with result ${result}` });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`mock-payment-provider listening on port ${PORT}`);
});
