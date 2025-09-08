import axios from "axios";

export async function fetchGitHub(repo) {
  const url = `https://api.github.com/repos/${repo}`;
  const headers = {};
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const { data } = await axios.get(url, { headers, timeout: 15000 });
  return {
    stars: data.stargazers_count ?? 0,
    forks: data.forks_count ?? 0,
    watchers: data.subscribers_count ?? 0,
    open_issues: data.open_issues_count ?? 0,
    default_branch: data.default_branch,
    pushed_at: data.pushed_at
  };
}