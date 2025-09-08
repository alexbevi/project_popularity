import axios from "axios";

// NuGet v3 registration: total downloads; we’ll approximate weekly by 1/52 of total if needed.
// For simplicity, return total as "weekly" proxy if no weekly exists; easy to swap later.
export async function fetchNuGet(id) {
  const indexUrl = "https://api.nuget.org/v3/index.json";
  const { data: idx } = await axios.get(indexUrl, { timeout: 15000 });
  const regBase = idx.resources.find(r => r["@type"]?.includes("RegistrationsBaseUrl"))["@id"];
  const regUrl = `${regBase}${id.toLowerCase()}/index.json`;
  const { data: reg } = await axios.get(regUrl, { timeout: 15000 });

  let total = 0;
  for (const page of reg.items || []) {
    for (const item of (page.items || [])) {
      total += item.catalogEntry?.downloads || 0;
    }
  }
  // crude weekly proxy; adjust if you wire in a real weekly source
  const weekly_downloads = Math.round(total / 52);
  return { weekly_downloads, total_downloads: total };
}