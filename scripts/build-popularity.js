import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import axios from "axios";

import { fetchGitHub } from "./fetchers/github.js";
import { fetchNpm } from "./fetchers/npm.js";
import { fetchNuGet } from "./fetchers/nuget.js";
import { fetchRubyGems } from "./fetchers/rubygems.js";
import { fetchCrates } from "./fetchers/crates.js";
import { fetchPyPI } from "./fetchers/pypi.js";
import { fetchMaven } from "./fetchers/maven.js"; // currently returns { weekly_downloads: 0 }

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../config/popularity.config.json")));
const projectsYaml = yaml.load(fs.readFileSync(path.join(__dirname, "../config/projects.yml"), "utf8"));
const projects = projectsYaml.projects || [];

function log10(x) { return Math.log10(x); }

function computeIndex({ stars=0, forks=0, weekly_downloads=0 }, weights) {
  const s = log10(1 + stars);
  const f = log10(1 + forks);
  const d = log10(1 + weekly_downloads);
  return weights.stars * s + weights.forks * f + weights.weekly_downloads * d;
}

async function safe(fn, fallback = {}) {
  try { return await fn(); } catch (e) { return { ...fallback, _error: e?.message || String(e) }; }
}

async function fetchMetrics(p) {
  const [gh, npm, nuget, rubygems, crates, pypi, maven] = await Promise.all([
    safe(() => fetchGitHub(p.repo)),
    safe(() => p.npm ? fetchNpm(p.npm) : { weekly_downloads: 0 }),
    safe(() => p.nuget ? fetchNuGet(p.nuget) : { weekly_downloads: 0 }),
    safe(() => p.rubygems ? fetchRubyGems(p.rubygems) : { weekly_downloads: 0 }),
    safe(() => p.crates ? fetchCrates(p.crates) : { weekly_downloads: 0 }),
    safe(() => p.pypi ? fetchPyPI(p.pypi) : { weekly_downloads: 0 }),
    safe(() => p.maven ? fetchMaven(p.maven) : { weekly_downloads: 0 })
  ]);

  // pick the max weekly_downloads across ecosystems (a project may publish in more than one)
  const weekly_downloads = Math.max(
    npm.weekly_downloads || 0,
    nuget.weekly_downloads || 0,
    rubygems.weekly_downloads || 0,
    crates.weekly_downloads || 0,
    pypi.weekly_downloads || 0,
    maven.weekly_downloads || 0
  );

  return {
    stars: gh.stars || 0,
    forks: gh.forks || 0,
    weekly_downloads,
    sources: { gh, npm, nuget, rubygems, crates, pypi, maven }
  };
}

function groupAndSort(rows) {
  // group by language + type; sort within groups by index desc
  const groups = {};
  for (const r of rows) {
    const key = `${r.language}::${r.type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => b.index - a.index);
  }
  return groups;
}

(async () => {
  const weights = cfg.weights;

  const results = [];
  for (const p of projects) {
    const m = await fetchMetrics(p);
    const index = computeIndex(m, weights);
    results.push({
      name: p.name,
      language: p.language,
      type: p.type,
      repo: p.repo,
      npm: p.npm || null,
      nuget: p.nuget || null,
      rubygems: p.rubygems || null,
      crates: p.crates || null,
      pypi: p.pypi || null,
      maven: p.maven || null,
      stars: m.stars,
      forks: m.forks,
  // GitHub engagement fields (if available)
  contributors_count: m.sources?.gh?.contributors_count ?? 0,
  closed_issues: m.sources?.gh?.closed_issues ?? 0,
  avg_pr_merge_days: m.sources?.gh?.avg_pr_merge_days ?? null,
  merged_prs_last_6mo: m.sources?.gh?.merged_prs_last_6mo ?? 0,
  releases_count: m.sources?.gh?.releases_count ?? 0,
  release_frequency_per_year: m.sources?.gh?.release_frequency_per_year ?? null,
      weekly_downloads: m.weekly_downloads,
      index: Number(index.toFixed(6))
    });
  }

  const grouped = groupAndSort(results);

  // Flatten with rank inside each group
  const output = [];
  for (const [key, rows] of Object.entries(grouped)) {
    const [language, type] = key.split("::");
    rows.forEach((r, i) => output.push({ rank: i + 1, language, type, ...r }));
  }

  // Write JSON
  fs.mkdirSync(path.join(__dirname, "../data"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "../" + cfg.output.json), JSON.stringify(output, null, 2));

  console.log(`Wrote ${output.length} rows to ${cfg.output.json}`);
})();