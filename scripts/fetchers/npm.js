import axios from "axios";

export async function fetchNpm(pkg) {
  // weekly downloads endpoint
  const url = `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  return { weekly_downloads: data.downloads ?? 0 };
}