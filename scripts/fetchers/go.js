import axios from "axios";

const DEFAULT_TIMEOUT = 10000;

// Go modules don't have a public global download count API. We can fetch
// the list of versions from the Go proxy and return a diagnostic (versions_count)
// while returning weekly_downloads: 0 and an explanatory _error so callers know
// why counts are missing.
export async function fetchGo(modulePath) {
  if (!modulePath) return { weekly_downloads: 0 };
  try {
    const safe = encodeURIComponent(modulePath);
    const listUrl = `https://proxy.golang.org/${safe}/@v/list`;
    const { data } = await axios.get(listUrl, { timeout: DEFAULT_TIMEOUT });
    // response is newline-separated versions
    const versions = (data || '').split(/\r?\n/).filter(Boolean);
    return { weekly_downloads: 0, versions_count: versions.length, latest_version: versions[versions.length-1] || null, _error: 'no-public-downloads-for-go' };
  } catch (err) {
    return { weekly_downloads: 0, _error: `go proxy failed: ${err?.response?.status || ''} ${err?.message || ''}`.trim() };
  }
}
