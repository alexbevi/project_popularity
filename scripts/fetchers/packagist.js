import axios from "axios";

// Packagist provides package downloads (total); we'll proxy to a weekly approximation by dividing by 52
export async function fetchPackagist(pkg) {
  const safe = encodeURIComponent(pkg);
  const url = `https://repo.packagist.org/p2/${safe}.json`;
  try {
    const { data } = await axios.get(url, { timeout: 15000 });
    // The packagist p2 response includes packages -> {name: [versions...]}
    // Sum downloads across versions if present (some endpoints include downloads)
    let total = 0;
    const pkgData = data?.packages?.[pkg] || data?.packages?.[Object.keys(data?.packages || {})[0]];
    if (pkgData && Array.isArray(pkgData)) {
      for (const v of pkgData) {
        if (typeof v.downloads === 'number') total += v.downloads;
      }
    }
    // fallback: try metadata endpoint for total downloads
    if (total === 0) {
      try {
        const metaUrl = `https://packagist.org/packages/${safe}.json`;
        const { data: meta } = await axios.get(metaUrl, { timeout: 15000 });
        total = meta?.package?.downloads?.total || 0;
      } catch (e) {
        // ignore
      }
    }
    return { weekly_downloads: Math.round(total / 52), total_downloads: total };
  } catch (e) {
    return { weekly_downloads: 0, _error: e?.message || String(e) };
  }
}
