import axios from "axios";

export async function fetchCrates(crate) {
  const url = `https://crates.io/api/v1/crates/${encodeURIComponent(crate)}`;
  const { data } = await axios.get(url, { timeout: 15000 });
  // crates API returns total downloads; use 1/52 proxy
  const total = data.crate?.downloads || 0;
  return { weekly_downloads: Math.round(total / 52), total_downloads: total };
}