const axios = require('axios');

async function httpGet(url, opts = {}, retries = 3, backoff = 500) {
  for (let i = 0; i <= retries; i++) {
    try {
      const merged = Object.assign({ timeout: 15000 }, opts);
      const resp = await axios.get(url, merged);
      return resp;
    } catch (err) {
      const code = err && err.response && err.response.status;
      const isRate = code === 429 || code === 403;
      if (i === retries || !isRate) throw err;
      await new Promise(r => setTimeout(r, backoff * Math.pow(2, i)));
    }
  }
}

module.exports = { httpGet };
