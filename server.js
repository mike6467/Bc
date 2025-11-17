require("dotenv").config();
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ------------------------
// OKX API CLIENT
// ------------------------
function okxSign(timestamp, method, path, body = "") {
  const preHash = timestamp + method + path + body;
  return crypto
    .createHmac("sha256", process.env.OKX_SECRET_KEY)
    .update(preHash)
    .digest("base64");
}

async function okxRequest(method, path, body = "") {
  const timestamp = new Date().toISOString();
  const signature = okxSign(timestamp, method, path, body);

  const headers = {
    "OK-ACCESS-KEY": process.env.OKX_API_KEY,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": process.env.OKX_PASSPHRASE,
    "Content-Type": "application/json",
  };

  return axios({
    url: `https://www.okx.com${path}`,
    method,
    headers,
    data: body ? JSON.parse(body) : undefined
  });
}

// ------------------------
// DEPOSIT ADDRESS ROUTE
// ------------------------
app.post("/api/deposit/address", async (req, res) => {
  const { userId, currency, chain } = req.body;

  try {
    const requestPath = `/api/v5/asset/deposit-address?ccy=${currency}`;
    const okxRes = await okxRequest("GET", requestPath);

    const items = okxRes.data.data || [];

    const match = items.find(i => i.chain.includes(chain));

    if (!match) {
      return res.json({ error: "Chain not found in OKX response" });
    }

    return res.json({
      success: true,
      address: match.addr,
      memo: match.tag || null,
      currency,
      chain,
    });

  } catch (err) {
    console.error("OKX ERROR:", err.response?.data || err);
    return res.json({ error: "OKX request failed" });
  }
});

// ------------------------
// PORT CONFIG
// ------------------------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
