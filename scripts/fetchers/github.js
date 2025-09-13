import axios from "axios";
import { httpGet } from '../http-retry.mjs';

export async function fetchGitHub(repo, package_id) {
  const base = `https://api.github.com/repos/${repo}`;
  const headers = {};
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

  let data;
  try {
    const resp = await httpGet(base, { headers, responseType: 'json' });
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
  const resp = await httpGet(contribUrl, { headers, responseType: 'json' });
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
  const closedResp = await httpGet(closedUrl, { headers, responseType: 'json' });
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
  const pullsResp = await httpGet(pullsUrl, { headers, responseType: 'json' });
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
  const relResp = await httpGet(relUrl, { headers, responseType: 'json' });
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
    dependents_count: 0,
    default_branch: data.default_branch,
    pushed_at: data.pushed_at
  };
}

// Attempt to fetch dependents count by scraping the GitHub network dependents page.
// If package_id is supplied, prefer the package dependents listing when applicable.
export async function fetchGitHubDependents(repo, package_id) {
  const verbose = process.env.LOG_VERBOSE === '1';
  const headers = {
    'Accept': 'text/html',
    'User-Agent': 'project-popularity-fetcher/1.0 (+https://github.com)'
  };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

  // small helper: fetch with one retry
    const fetchHtml = async (url) => {
      if (verbose) console.log(`[fetchGitHubDependents] GET ${url}`);
      try {
        const resp = await httpGet(url, { headers, responseType: 'text' });
        return resp.data || '';
      } catch (err) {
        if (verbose) console.warn(`[fetchGitHubDependents] error for ${url}: ${err?.message || err}`);
        return '';
      }
    };

  try {
    let html = '';
    // If package_id provided, try the package dependents URL first (best-effort)
    if (package_id) {
      // package_id in config may already be percent-encoded; decode first to avoid double-encoding
      let pid = package_id;
      try { pid = decodeURIComponent(String(package_id)); } catch (e) { /* ignore decode errors */ }
      const pkgUrl = `https://github.com/${repo}/network/dependents?dependent_type=PACKAGE&package_id=${encodeURIComponent(pid)}`;
      if (verbose) console.log(`[fetchGitHubDependents] trying package-scoped dependents URL: ${pkgUrl}`);
      try {
        html = await fetchHtml(pkgUrl);
      } catch (e) {
        if (verbose) console.warn(`[fetchGitHubDependents] package dependents fetch failed for ${repo}: ${e?.message || e}`);
        html = '';
      }
    }

    // fallback to generic dependents page if package-specific page didn't yield HTML
    if (!html) {
      const url = `https://github.com/${repo}/network/dependents`;
      try {
        html = await fetchHtml(url);
      } catch (e) {
        if (verbose) console.warn(`[fetchGitHubDependents] generic dependents fetch failed for ${repo}: ${e?.message || e}`);
        html = '';
      }
    }

    if (!html) return 0;

    // try several regex patterns to catch different GitHub markup variants
    const patterns = [
      /aria-label=["']?Dependents["']?[^>]*>\s*([0-9,]+)/i,
      />([0-9][0-9,]*)<\/a>\s*dependents/i,
  /(\d[\d,]*)\s+dependents/i,
  /(\d[\d,]*)\s+Repositories/i,
      /<summary[^>]*>\s*Dependents\s*<span[^>]*>\s*([0-9,]+)\s*<\/span>/i,
      /<span[^>]*class=["'][^"'>]*(?:Counter|num|text-bold)[^"'>]*["'][^>]*>\s*([0-9,]+)\s*<\/span>/i,
      /"dependents"\s*:\s*"?([0-9,]+)"?/i
    ];

    for (const pat of patterns) {
      const m = html.match(pat);
      if (m && m[1]) {
        const n = Number(String(m[1]).replace(/,/g, ''));
        if (!Number.isNaN(n)) return { dependents_count: n };
      }
    }

    // last-resort: look for any number near the word 'dependents'
    const m2 = html.match(/([0-9,]{1,15})[^]{0,120}?dependents/i) || html.match(/dependents[^]{0,120}?([0-9,]{1,15})/i);
    if (m2 && m2[1]) {
      const n = Number(String(m2[1]).replace(/,/g, ''));
      if (!Number.isNaN(n)) return { dependents_count: n };
    }

    if (verbose) {
      console.warn(`[fetchGitHubDependents] no dependents count found for ${repo}; sample HTML start:\n${String(html).slice(0,2000)}`);
    }
    return { dependents_count: 0 };
  } catch (e) {
    console.warn(`[fetchGitHubDependents] dependents fetch failed for ${repo}: ${e?.message || e}`);
    return { dependents_count: 0, _error: e?.message || String(e) };
  }
}
