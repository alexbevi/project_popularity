import axios from "axios";

// Attempt to use pypistats.org public API to get recent/week downloads.
// pypistats rate-limits and occasionally blocks scrapers; fall back to 0 if unavailable.
export async function fetchPyPI(pkg) {
  const safeName = encodeURIComponent(pkg);
  const tryEndpoints = [
    `https://pypistats.org/api/packages/${safeName}/recent`,
    `https://pypistats.org/api/packages/${safeName}/overall?period=week`
  ];

  for (const url of tryEndpoints) {
    try {
      const { data } = await axios.get(url, { timeout: 15000 });
      // pypistats responses vary; try a few common shapes
      const d = data?.data || data;
      if (!d) continue;

      // recent endpoint may include last_week or last_7_days or last_day/last_month
      if (typeof d.last_week === 'number') return { weekly_downloads: d.last_week };
      if (typeof d.last_7_days === 'number') return { weekly_downloads: d.last_7_days };
      // overall?period=week might include 'overall' or numeric directly
      if (typeof d.overall === 'number') return { weekly_downloads: d.overall };

      // some responses nest keyed by period
      if (d?.data && typeof d.data === 'object') {
        const keys = Object.keys(d.data);
        for (const k of keys) {
          const v = d.data[k];
          if (v && typeof v === 'object') {
            if (typeof v.last_week === 'number') return { weekly_downloads: v.last_week };
            if (typeof v.overall === 'number') return { weekly_downloads: v.overall };
          }
        }
      }

    } catch (err) {
      // try next endpoint
      continue;
    }
  }

  // Best-effort fallback: PyPI no longer exposes reliable download counts. Return 0 and let caller see _error if needed.
  return { weekly_downloads: 0 };
}