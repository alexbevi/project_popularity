#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const dataDir = path.join(repoRoot, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// find all per-repo popularity files in workspace
const files = fs.readdirSync('.').filter(f => f.startsWith('popularity.') && f.endsWith('.json'));
const aggregated = [];

for (const f of files) {
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    // j is expected to be an array of entries for this project
    if (Array.isArray(j)) {
      for (const rec of j) aggregated.push(rec);
    } else if (j && j.repo) {
      aggregated.push(j);
    }
  } catch (e) {
    console.warn('failed to read', f, e && e.message);
  }
}

// write canonical data/popularity.json
fs.writeFileSync(path.join(dataDir, 'popularity.json'), JSON.stringify(aggregated, null, 2), 'utf8');
console.log('Wrote data/popularity.json with', aggregated.length, 'records');
