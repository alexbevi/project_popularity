#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const dataDir = path.join(repoRoot, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

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
