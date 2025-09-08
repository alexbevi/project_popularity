import axios from "axios";

const DEFAULT_TIMEOUT = 15000;
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Fetch NuGet package download counts.
// Preferred: use search endpoint which includes totalDownloads.
// Fallback: parse registration index if needed.
export async function fetchNuGet(id) {
  const pkg = encodeURIComponent(id);
  let lastErr = null;

  // 1) Try search API which returns totalDownloads in a simple shape
  const searchUrl = `https://api-v2v3search-0.nuget.org/query?q=packageid:${pkg}&prerelease=false`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await axios.get(searchUrl, { timeout: DEFAULT_TIMEOUT });
      const first = data?.data?.[0] || null;
      if (first && typeof first.totalDownloads === 'number') {
        const total = first.totalDownloads;
        return { weekly_downloads: Math.round(total / 52), total_downloads: total };
      }
      break;
    } catch (err) {
      lastErr = err;
      const backoff = attempt * 300;
      await wait(backoff);
      continue;
    }
  }

  // 2) Fallback: parse registration index pages
  try {
    const indexUrl = "https://api.nuget.org/v3/index.json";
    const { data: idx } = await axios.get(indexUrl, { timeout: DEFAULT_TIMEOUT });
    const regResource = (idx.resources || []).find(r => String(r["@type"] || "").toLowerCase().includes("registrationsbaseurl"));
    const regBase = regResource && regResource["@id"] ? regResource["@id"] : null;
    if (!regBase) throw new Error('no-registrations-base');

    const regUrl = `${regBase}${id.toLowerCase()}/index.json`;
    const { data: reg } = await axios.get(regUrl, { timeout: DEFAULT_TIMEOUT });

    let total = 0;
    for (const page of reg.items || []) {
      // page may contain items or a subpage with items
      const items = page.items || page; // defensive
      for (const item of (page.items || [])) {
        const entry = item.catalogEntry || item;
        // check multiple common property names
        const d = entry?.downloads ?? entry?.totalDownloads ?? entry?.downloadCount ?? 0;
        total += d || 0;
      }
    }

    return { weekly_downloads: Math.round(total / 52), total_downloads: total };
  } catch (err) {
    lastErr = lastErr || err;
  }

  return { weekly_downloads: 0, _error: lastErr ? `${lastErr?.response?.status || ''} ${lastErr?.message || ''}`.trim() : 'nuget: no-data' };
}