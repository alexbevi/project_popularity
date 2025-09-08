import axios from "axios";

const DEFAULT_TIMEOUT = 15000;
function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Attempt to use pypistats.org public API to get recent/week downloads.
// pypistats can rate-limit (429) or return 403; we retry a few times with backoff
// and surface an _error when unavailable so the caller can log why downloads are missing.
export async function fetchPyPI(pkg) {
  const safeName = encodeURIComponent(pkg);
  const tryEndpoints = [
    `https://pypistats.org/api/packages/${safeName}/recent`,
    `https://pypistats.org/api/packages/${safeName}/overall?period=week`,
    `https://pypistats.org/api/packages/${safeName}/overall`
  ];

  const headers = {
    Accept: "application/json, text/plain, */*",
    // small, polite UA may reduce automated blocks
    "User-Agent": "project_popularity/0.1 (+https://github.com/your/repo)"
  };

  let lastErr = null;

  for (const url of tryEndpoints) {
    // try up to 3 times with exponential backoff for transient failures
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { data } = await axios.get(url, { timeout: DEFAULT_TIMEOUT, headers });
        const d = data?.data || data;
        if (!d) break; // try next endpoint

        // Common shapes from pypistats.org
        if (typeof d.last_week === 'number') return { weekly_downloads: d.last_week };
        if (typeof d.last_7_days === 'number') return { weekly_downloads: d.last_7_days };
        if (typeof d.last_month === 'number') {
          // approximate weekly from monthly
          return { weekly_downloads: Math.round(d.last_month / 4) };
        }
        if (typeof d.overall === 'number') return { weekly_downloads: d.overall };

        // sometimes the API nests values under data keys (e.g., { data: { last_week: ... } })
        if (d && typeof d === 'object') {
          // check common nested places
          if (d?.data && typeof d.data === 'object') {
            if (typeof d.data.last_week === 'number') return { weekly_downloads: d.data.last_week };
            if (typeof d.data.last_7_days === 'number') return { weekly_downloads: d.data.last_7_days };
            if (typeof d.data.overall === 'number') return { weekly_downloads: d.data.overall };
          }

          // some responses are keyed by period
          for (const key of Object.keys(d)) {
            const v = d[key];
            if (v && typeof v === 'object') {
              if (typeof v.last_week === 'number') return { weekly_downloads: v.last_week };
              if (typeof v.last_7_days === 'number') return { weekly_downloads: v.last_7_days };
              if (typeof v.overall === 'number') return { weekly_downloads: v.overall };
            }
          }
        }

        // nothing matched on this endpoint
        break;
      } catch (err) {
        lastErr = err;
        // if it's a rate-limit, wait longer before retrying
        const status = err?.response?.status;
        const backoff = attempt * 500 * (status === 429 ? 3 : 1);
        await wait(backoff);
        continue;
      }
    }
  }

  // Best-effort fallback: PyPI download counts are not reliably public. Return 0 and surface error.
  const msg = lastErr ? `${lastErr?.response?.status || ''} ${lastErr?.message || ''}`.trim() : 'no-data';
  return { weekly_downloads: 0, _error: `pypistats failed: ${msg}` };
}