import axios from "axios";

export async function fetchRubyGems(gem) {
  const url = `https://rubygems.org/api/v1/gems/${encodeURIComponent(gem)}.json`;
  const { data } = await axios.get(url, { timeout: 15000 });
  // RubyGems provides total downloads (gem + versions), no weekly. Use 1/52 proxy like NuGet.
  const total = data.downloads || 0;
  return { weekly_downloads: Math.round(total / 52), total_downloads: total };
}