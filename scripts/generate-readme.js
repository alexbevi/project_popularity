import fs from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'data', 'popularity.json');
const outPath = path.join(process.cwd(), 'data', 'README.md');

function safeString(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

try {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);
  const sorted = data.slice().sort((a,b) => (b.index || 0) - (a.index || 0));

  const rows = [];
  rows.push('| Name | Index | Stars | Weekly downloads |');
  rows.push('|---|---:|---:|---:|');
  for (const r of sorted) {
    const name = safeString(r.name);
    const repo = safeString(r.repo);
    const index = safeString(r.index);
    const stars = safeString(r.stars);
    const weekly = safeString(r.weekly_downloads);
    const line = `| [${name}](https://github.com/${repo}) | ${index} | ${stars} | ${weekly} |`;
    rows.push(line);
  }

  const content = `# Popularity data\n\n${rows.join('\n')}\n`;
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath}`);
} catch (e) {
  console.error('generate-readme failed:', e?.message || e);
  process.exit(1);
}
