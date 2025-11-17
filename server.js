// ----------------------------
// IMPORTS
// ----------------------------
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { Pool } = require("pg");
require("dotenv").config();
const fetch = require("node-fetch");

const app = express();
app.use(express.json());
app.use(cors());

// ----------------------------
// HEALTH-CHECK ROUTE
// ----------------------------
app.get("/", (req, res) => res.send("Backend is running!"));

// ----------------------------
// POSTGRESQL SETUP
// ----------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Initialize table
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS deposits (
        id TEXT PRIMARY KEY,
        userId TEXT,
        currency TEXT,
        chain TEXT,
        address TEXT,
        memo TEXT,
        status TEXT DEFAULT 'pending',
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("PostgreSQL database ready");
  } catch (err) {
    console.error("Error initializing database:", err);
  }
})();

// ----------------------------
// OKX API INTEGRATION
// ----------------------------
async function getOkxDepositAddress(currency, chain) {
  if (!process.env.OKX_API_KEY || !process.env.OKX_SECRET_KEY || !process.env.OKX_PASSPHRASE) {
    return { error: "Missing OKX API credentials" };
  }

  const timestamp = Date.now() / 1000;
  const method = "GET";
  const requestPath = `/api/v5/asset/deposit-address?ccy=${currency}&chain=${chain}`;
  const prehash = timestamp.toString() + method + requestPath;
  const hmac = crypto.createHmac("sha256", process.env.OKX_SECRET_KEY);
  hmac.update(prehash);
  const signature = hmac.digest("base64");

  const headers = {
    "OK-ACCESS-KEY": process.env.OKX_API_KEY,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp.toString(),
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE,
  };

  const baseUrl = process.env.OKX_API_BASE || "https://www.okx.com";

  try {
    const response = await fetch(`${baseUrl}${requestPath}`, { method: "GET", headers });
    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      return { error: "No deposit address returned from OKX" };
    }

    return {
      address: data.data[0].addr,
      memo: data.data[0].memo || null,
    };
  } catch (err) {
    return { error: "OKX API request failed", detail: err.message };
  }
}

// ----------------------------
// API ROUTES
// ----------------------------
app.post("/api/deposit/address", async (req, res) => {
  const { userId, currency, chain } = req.body;
  if (!userId || !currency || !chain) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  const okxResponse = await getOkxDepositAddress(currency, chain);
  if (okxResponse.error) return res.status(400).json(okxResponse);

  const depositId = crypto.randomUUID();

  try {
    await pool.query(
      `INSERT INTO deposits (id, userId, currency, chain, address, memo) VALUES ($1, $2, $3, $4, $5, $6)`,
      [depositId, userId, currency, chain, okxResponse.address, okxResponse.memo]
    );

    res.json({
      success: true,
      depositId,
      address: okxResponse.address,
      memo: okxResponse.memo,
      currency,
      chain,
    });
  } catch (err) {
    console.error("Database insert error:", err);
    res.status(500).json({ error: "Database error", detail: err.message });
  }
});

// ----------------------------
// START SERVER
// ----------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
