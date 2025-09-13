#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '..', 'config', 'projects.yml');
const txt = fs.readFileSync(p, 'utf8');

// crude extraction of repo entries from the YAML file
const repos = [];
const repoRe = /\brepo:\s*["']?([^"'\n]+)["']?/g;
let m;
while ((m = repoRe.exec(txt)) !== null) {
  const val = m[1].trim();
  if (!val.includes('/')) continue;
  const [owner, repo] = val.split('/');
  repos.push({ owner, repo, repo_full: `${owner}/${repo}` });
}

// dedupe by repo_full
const uniq = [];
const seen = new Set();
for (const r of repos) {
  if (seen.has(r.repo_full)) continue;
  seen.add(r.repo_full);
  uniq.push(r);
}

// parse CLI args for --limit / -n
let limit = 0;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--limit' || a === '-n') {
    const v = argv[i+1];
    if (v) {
      limit = parseInt(v, 10) || 0;
      i++;
    }
  } else if (a.startsWith('--limit=')) {
    limit = parseInt(a.split('=')[1], 10) || 0;
  }
}

let out = uniq;
if (limit > 0) {
  out = uniq.slice(0, limit);
}

console.log(JSON.stringify(out));
