#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const dataDir = path.join(repoRoot, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
// artifact downloads sometimes place files under an artifact-named directory
// e.g. ./per-repo-popularity-xxx/data/popularity.owner.repo.json
// find all popularity.*.json files anywhere under the repo root and copy them into data/
function walkSync(dir, cb) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      // avoid recursing into .git
      if (ent.name === '.git') continue;
      try { walkSync(full, cb); } catch (e) { /* ignore */ }
    } else if (ent.isFile()) {
      cb(full);
    }
  }
}

const popularityPattern = /^popularity\..+\.json$/;
const found = [];
try {
  walkSync(repoRoot, pth => {
    const name = path.basename(pth);
    if (popularityPattern.test(name)) found.push(pth);
  });
} catch (e) {
  console.warn('error scanning workspace for popularity files', e && e.message);
}

console.log('Found', found.length, 'popularity.*.json files in workspace');
for (const src of found) {
  const dest = path.join(dataDir, path.basename(src));
  try {
    if (fs.existsSync(dest)) {
      const sStat = fs.statSync(src);
      const dStat = fs.statSync(dest);
      if ((sStat.mtimeMs || 0) <= (dStat.mtimeMs || 0)) {
        // existing dest is newer or equal; skip
        console.log('Skipping copy (dest newer):', path.basename(src));
        continue;
      }
    }
    fs.copyFileSync(src, dest);
    console.log('Copied', src, '->', dest);
  } catch (e) {
    console.warn('failed to copy', src, e && e.message);
  }
}

// find all per-repo popularity files in data/ directory
const files = fs.readdirSync(dataDir).filter(f => f.startsWith('popularity.') && f.endsWith('.json'));
// Build a map of latest record per repo (keyed by owner/repo)
const latestByRepo = new Map();

for (const f of files) {
  const full = path.join(dataDir, f);
  let stat = null;
  try { stat = fs.statSync(full); } catch (e) { /* ignore */ }
  try {
    const j = JSON.parse(fs.readFileSync(full, 'utf8'));
    const items = Array.isArray(j) ? j : (j && j.repo ? [j] : []);
    for (const rec of items) {
      // determine repo key: prefer rec.repo, fallback to filename pattern popularity.<owner>.<repo>.json -> owner/repo
      let repoKey = rec && rec.repo ? rec.repo : null;
      if (!repoKey) {
        const name = f.replace(/^popularity\./, '').replace(/\.json$/, '');
        const parts = name.split('.');
        const owner = parts.shift();
        const repo = parts.join('.');
        repoKey = `${owner}/${repo}`;
      }

      // determine timestamp: prefer ISO timestamp in record, else fallback to file mtime
      let ts = 0;
      if (rec && rec.timestamp) {
        const parsed = Date.parse(rec.timestamp);
        if (!Number.isNaN(parsed)) ts = parsed;
      }
      if (!ts && stat) ts = stat.mtimeMs || stat.ctimeMs || 0;

      const existing = latestByRepo.get(repoKey);
      const existingTs = existing && existing._agg_ts ? existing._agg_ts : 0;
      if (!existing || ts > existingTs) {
        // attach an internal timestamp to decide ordering later
        const copy = Object.assign({}, rec, { _agg_ts: ts });
        latestByRepo.set(repoKey, copy);
      }
    }
  } catch (e) {
    console.warn('failed to read', full, e && e.message);
  }
}

// produce final array: remove internal _agg_ts and sort by index desc
const aggregated = Array.from(latestByRepo.values()).map(r => {
  const out = Object.assign({}, r);
  delete out._agg_ts;
  return out;
});
aggregated.sort((a,b) => (b.index || 0) - (a.index || 0));

// write canonical data/popularity.json
fs.writeFileSync(path.join(dataDir, 'popularity.json'), JSON.stringify(aggregated, null, 2), 'utf8');
console.log('Wrote data/popularity.json with', aggregated.length, 'records');
