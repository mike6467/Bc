const axios = require('axios');
const crypto = require('crypto');

const base = process.env.OKX_API_BASE || 'https://www.okx.com';

function getTimestamp() {
  return (Date.now() / 1000).toString();
}

function signRequest(secret, timestamp, method, requestPath, bodyStr='') {
  const prehash = timestamp + method.toUpperCase() + requestPath + bodyStr;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(prehash);
  return hmac.digest('base64');
}

async function getDepositAddress({ ccy, chain }) {
  if (!process.env.OKX_API_KEY || !process.env.OKX_API_SECRET || !process.env.OKX_API_PASSPHRASE) {
    throw new Error('OKX API keys not set in environment');
  }

  const method = 'GET';
  const requestPath = `/api/v5/asset/deposit-address?ccy=${encodeURIComponent(ccy)}${chain ? \`&chain=\${encodeURIComponent(chain)}\` : ''}`;
  const timestamp = getTimestamp();
  const bodyStr = '';
  const sign = signRequest(process.env.OKX_API_SECRET, timestamp, method, requestPath, bodyStr);

  const headers = {
    'OK-ACCESS-KEY': process.env.OKX_API_KEY,
    'OK-ACCESS-SIGN': sign,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': process.env.OKX_API_PASSPHRASE,
    'Content-Type': 'application/json'
  };

  const url = `${base}${requestPath}`;
  const resp = await axios.get(url, { headers });
  return resp.data;
}

module.exports = { getDepositAddress };
