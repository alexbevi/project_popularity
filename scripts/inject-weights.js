#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const cfgPath = path.join(repoRoot, 'config', 'popularity.config.json');
const tplPath = path.join(repoRoot, 'web', 'index.template.html');
const outPath = path.join(repoRoot, 'web', 'index.html');

function main(){
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const tpl = fs.readFileSync(tplPath, 'utf8');
  const weights = cfg.weights || {};
  const keys = ['weekly_downloads','stars','forks','merged_prs_last_6mo','release_frequency','dependents'];
  const html = keys.map(k => `        <div class="item">${k}: ${weights[k] !== undefined ? weights[k] : 0}</div>`).join('\n');
  const out = tpl.replace('<!-- WEIGHTS_INJECT -->', html);
  fs.writeFileSync(outPath, out, 'utf8');
  console.log('Injected weights into', outPath);
}

main();
