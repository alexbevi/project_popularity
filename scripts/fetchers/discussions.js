import axios from "axios";

// Fetch basic GitHub Discussions metrics for a repo (owner/repo)
export async function fetchDiscussions(repo) {
  if (!repo) return { discussions_count: 0, recent_activity_last_6mo: 0 };
  const url = `https://api.github.com/repos/${repo}/discussions`;
  const headers = {};
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  try {
    const resp = await axios.get(url, { headers, timeout: 15000 });
    const items = resp.data || [];
    // count recent activity: discussions updated in last 6 months
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    let recent = 0;
    for (const d of items) {
      const updated = new Date(d.updated_at || d.created_at || 0);
      if (updated >= sixMonthsAgo) recent += 1;
    }
    return { discussions_count: items.length, recent_activity_last_6mo: recent };
  } catch (e) {
    return { discussions_count: 0, recent_activity_last_6mo: 0, _error: e?.message || String(e) };
  }
}
