import axios from "axios";

export async function fetchGitHub(repo) {
  const base = `https://api.github.com/repos/${repo}`;
  const headers = {};
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

  let data;
  try {
    const resp = await axios.get(base, { headers, timeout: 15000 });
    data = resp.data;
  } catch (e) {
    console.warn(`[fetchGitHub] repo fetch failed for ${repo}: ${e?.message || e}`);
    return {
      stars: 0,
      forks: 0,
      watchers: 0,
      open_issues: 0,
      closed_issues: 0,
      contributors_count: 0,
      avg_pr_merge_days: null,
      merged_prs_last_6mo: 0,
      releases_count: 0,
      release_frequency_per_year: null,
      default_branch: null,
      pushed_at: null,
      _error: e?.message || String(e)
    };
  }

  // fetch contributors (simple count)
  let contributors_count = 0;
  try {
    const contribUrl = `${base}/contributors?per_page=1&anon=1`;
    const resp = await axios.get(contribUrl, { headers, timeout: 15000 });
    // GitHub returns Link header for pagination; if present, estimate total from it
    const link = resp.headers.link || "";
    if (link) {
      const m = link.match(/&page=(\d+)>; rel="last"/);
      contributors_count = m ? Number(m[1]) : resp.data.length;
    } else {
      contributors_count = resp.data.length;
    }
  } catch (e) {
  contributors_count = 0;
  console.warn(`[fetchGitHub] contributors fetch failed for ${repo}: ${e?.message || e}`);
  }

  // issues: open vs closed (use search API to get counts without listing)
  let open_issues = data.open_issues_count ?? 0;
  let closed_issues = 0;
  try {
    const repoQuery = `repo:${repo} is:issue`;
    const closedQ = encodeURIComponent(`${repoQuery} is:closed`);
    const closedUrl = `https://api.github.com/search/issues?q=${closedQ}`;
    const closedResp = await axios.get(closedUrl, { headers, timeout: 15000 });
    closed_issues = closedResp.data.total_count || 0;
  } catch (e) {
  closed_issues = 0;
  console.warn(`[fetchGitHub] closed issues count failed for ${repo}: ${e?.message || e}`);
  }

  // pulls: compute merged PR stats (avg merge time in days, merged count in last 6 months)
  let avg_pr_merge_days = null;
  let merged_prs_last_6mo = 0;
  try {
    const pullsUrl = `${base}/pulls?state=closed&per_page=100`;
    const pullsResp = await axios.get(pullsUrl, { headers, timeout: 15000 });
    const pulls = pullsResp.data || [];
    const merged = pulls.filter(p => p.merged_at);
    if (merged.length > 0) {
      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(now.getMonth() - 6);
      let totalDays = 0;
      let count = 0;
      for (const pr of merged) {
        const created = new Date(pr.created_at);
        const mergedAt = new Date(pr.merged_at);
        totalDays += (mergedAt - created) / (1000 * 60 * 60 * 24);
        count += 1;
        if (mergedAt >= sixMonthsAgo) merged_prs_last_6mo += 1;
      }
      avg_pr_merge_days = totalDays / count;
    }
  } catch (e) {
  avg_pr_merge_days = null;
  merged_prs_last_6mo = 0;
  console.warn(`[fetchGitHub] pull requests fetch failed for ${repo}: ${e?.message || e}`);
  }

  // releases: count and approximate frequency (releases per year)
  let releases_count = 0;
  let release_frequency_per_year = null;
  try {
    const relUrl = `${base}/releases?per_page=100`;
    const relResp = await axios.get(relUrl, { headers, timeout: 15000 });
    const releases = relResp.data || [];
    releases_count = releases.length;
    if (releases_count > 1) {
      const dates = releases.map(r => new Date(r.published_at || r.created_at)).filter(Boolean).sort((a,b) => a - b);
      const first = dates[0];
      const last = dates[dates.length - 1];
      const years = (last - first) / (1000 * 60 * 60 * 24 * 365.25) || 1/365.25;
      release_frequency_per_year = releases_count / years;
    }
  } catch (e) {
  releases_count = 0;
  release_frequency_per_year = null;
  console.warn(`[fetchGitHub] releases fetch failed for ${repo}: ${e?.message || e}`);
  }

  return {
    stars: data.stargazers_count ?? 0,
    forks: data.forks_count ?? 0,
    watchers: data.subscribers_count ?? 0,
    open_issues: open_issues,
    closed_issues: closed_issues,
    contributors_count,
    avg_pr_merge_days,
    merged_prs_last_6mo,
    releases_count,
    release_frequency_per_year,
    default_branch: data.default_branch,
    pushed_at: data.pushed_at
  };
}