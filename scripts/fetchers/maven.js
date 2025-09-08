import axios from "axios";

const DEFAULT_TIMEOUT = 10000;

// Maven Central doesn't provide public per-artifact download counts. We'll
// query the search API for the artifact and return a diagnostic: 'found' and
// 'version_count', and return weekly_downloads: 0 with an _error explaining why.
export async function fetchMaven(coords) {
  try {
    if (!coords || !coords.group || !coords.artifact) return { weekly_downloads: 0 };
    const q = `g:${coords.group} AND a:${coords.artifact}`;
    const url = `https://search.maven.org/solrsearch/select?q=${encodeURIComponent(q)}&rows=20&wt=json`;
    const { data } = await axios.get(url, { timeout: DEFAULT_TIMEOUT });
    const docs = data?.response?.docs || [];
    const found = docs.length > 0;
    const versions = found ? (docs[0].v ? 1 : 0) : 0; // solr returns 'v' latest version, but not a full version list here
    return { weekly_downloads: 0, found, version_count: versions, latest_version: docs[0]?.v || null, _error: 'maven: no-public-downloads' };
  } catch (err) {
    return { weekly_downloads: 0, _error: `maven query failed: ${err?.response?.status || ''} ${err?.message || ''}`.trim() };
  }
}
