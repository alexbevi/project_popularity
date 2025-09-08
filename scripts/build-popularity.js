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
import { fetchMaven } from "./fetchers/maven.js";
import { fetchGo } from "./fetchers/go.js";
import { fetchStackOverflow } from "./fetchers/stackoverflow.js";
import { fetchDiscussions } from "./fetchers/discussions.js";
import { fetchPackagist } from "./fetchers/packagist.js";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../config/popularity.config.json")));
const projectsYaml = yaml.load(fs.readFileSync(path.join(__dirname, "../config/projects.yml"), "utf8"));
let projects = projectsYaml.projects || [];

// CLI: allow testing a single repo by name or repo substring
// Usage: node scripts/build-popularity.js --repo=morphia  OR  -r morphia
const argv = process.argv.slice(2);
let singleRepo = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--repo=")) {
    singleRepo = a.split("=")[1];
  } else if (a === "-r") {
    if (argv[i + 1]) { singleRepo = argv[i + 1]; i++; }
  } else if (a.startsWith("-r=")) {
    singleRepo = a.split("=")[1];
  }
}
if (singleRepo) {
  const q = singleRepo.toLowerCase();
  const filtered = projects.filter(p => {
    if (!p) return false;
    const name = (p.name || "").toLowerCase();
    const repo = (p.repo || "").toLowerCase();
    return name === q || name.includes(q) || repo.includes(q) || repo.endsWith(q);
  });
  if (filtered.length === 0) {
    console.error(`[build] --repo ${singleRepo} matched no project; exiting`);
    process.exit(2);
  }
  console.log(`[build] filtering to ${filtered.length} project(s) matching '${singleRepo}'`);
  projects = filtered;
}

function log10(x) { return Math.log10(x); }

function computeIndex({ stars=0, forks=0, weekly_downloads=0, release_frequency=0 }, weights) {
  const s = log10(1 + stars);
  const f = log10(1 + forks);
  const d = log10(1 + weekly_downloads);
  const rf = log10(1 + (release_frequency || 0));
  // include release_frequency weight if present
  return (weights.stars * s) + (weights.forks * f) + (weights.weekly_downloads * d) + ((weights.release_frequency || 0) * rf);
}

async function safe(fn, fallback = {}) {
  try { return await fn(); } catch (e) { return { ...fallback, _error: e?.message || String(e) }; }
}

async function fetchMetrics(p) {
  const verbose = process.env.LOG_VERBOSE === '1';
  if (verbose) console.log(`[build] fetching metrics for ${p.name} (${p.repo})`);

  const [gh, npm, nuget, rubygems, crates, pypi, maven, packagist, stackoverflow, discussions, go] = await Promise.all([
    safe(() => { if (verbose) console.log(`[build] fetchGitHub ${p.repo}`); return fetchGitHub(p.repo); }),
    safe(() => { if (verbose && p.npm) console.log(`[build] fetchNpm ${p.npm}`); return p.npm ? fetchNpm(p.npm) : { weekly_downloads: 0 }; }),
    safe(() => { if (verbose && p.nuget) console.log(`[build] fetchNuGet ${p.nuget}`); return p.nuget ? fetchNuGet(p.nuget) : { weekly_downloads: 0 }; }),
    safe(() => { if (verbose && p.rubygems) console.log(`[build] fetchRubyGems ${p.rubygems}`); return p.rubygems ? fetchRubyGems(p.rubygems) : { weekly_downloads: 0 }; }),
    safe(() => { if (verbose && p.crates) console.log(`[build] fetchCrates ${p.crates}`); return p.crates ? fetchCrates(p.crates) : { weekly_downloads: 0 }; }),
    safe(() => { if (verbose && p.pypi) console.log(`[build] fetchPyPI ${p.pypi}`); return p.pypi ? fetchPyPI(p.pypi) : { weekly_downloads: 0 }; }),
    safe(() => { if (verbose && p.maven) console.log(`[build] fetchMaven ${JSON.stringify(p.maven)}`); return p.maven ? fetchMaven(p.maven) : { weekly_downloads: 0 }; }),
    safe(() => { if (verbose && p.packagist) console.log(`[build] fetchPackagist ${p.packagist}`); return p.packagist ? fetchPackagist(p.packagist) : { weekly_downloads: 0 }; }),
    safe(() => { if (verbose && p.stackoverflow) console.log(`[build] fetchStackOverflow ${p.stackoverflow}`); return p.stackoverflow ? fetchStackOverflow(p.stackoverflow) : { total_questions: 0, recent_questions_last_6mo: 0 }; }),
    safe(() => { if (verbose) console.log(`[build] fetchDiscussions ${p.repo}`); return fetchDiscussions(p.repo); }),
    // call fetchGo for Go projects or when p.go is provided; pass p.go or fallback to repo
    safe(() => { if (verbose && (p.go || p.language === 'Go')) console.log(`[build] fetchGo ${p.go || p.repo}`); return (p.go || p.language === 'Go') ? fetchGo(p.go || p.repo) : { weekly_downloads: 0 }; })
  ]);

  // pick the max weekly_downloads across ecosystems (a project may publish in more than one)
  const weekly_downloads = Math.max(
    npm.weekly_downloads || 0,
    nuget.weekly_downloads || 0,
    rubygems.weekly_downloads || 0,
    crates.weekly_downloads || 0,
  pypi.weekly_downloads || 0,
  maven.weekly_downloads || 0,
  packagist.weekly_downloads || 0,
  go.weekly_downloads || 0
  );

  return {
    stars: gh.stars || 0,
    forks: gh.forks || 0,
    weekly_downloads,
  release_frequency: gh.release_frequency_per_year || 0,
  sources: { gh, npm, nuget, rubygems, crates, pypi, maven, packagist, stackoverflow, discussions, go }
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
  // Stack Overflow & Discussions
  stackoverflow_total_questions: m.sources?.stackoverflow?.total_questions ?? 0,
  stackoverflow_recent_questions_last_6mo: m.sources?.stackoverflow?.recent_questions_last_6mo ?? 0,
  discussions_count: m.sources?.discussions?.discussions_count ?? 0,
  discussions_recent_activity_last_6mo: m.sources?.discussions?.recent_activity_last_6mo ?? 0,
      weekly_downloads: m.weekly_downloads,
      index: Number(index.toFixed(6))
    });
  }

  const grouped = groupAndSort(results);

  // Flatten groups (preserve sort by index). Do NOT add a rank field; we'll sort/display by index only.
  const output = [];
  for (const [key, rows] of Object.entries(grouped)) {
    const [language, type] = key.split("::");
    rows.forEach((r) => output.push({ language, type, ...r }));
  }

  // Write JSON
  fs.mkdirSync(path.join(__dirname, "../data"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "../" + cfg.output.json), JSON.stringify(output, null, 2));

  console.log(`Wrote ${output.length} rows to ${cfg.output.json}`);
})();