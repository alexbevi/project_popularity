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

console.log(JSON.stringify(uniq));
