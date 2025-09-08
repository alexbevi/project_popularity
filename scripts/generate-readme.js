import fs from 'fs';
import path from 'path';

const dataPath = path.join(process.cwd(), 'data', 'popularity.json');
const outPath = path.join(process.cwd(), 'data', 'README.md');

function fmt(v, opts = {}) {
  if (v === undefined || v === null) return '';
  if (opts.integer && typeof v === 'number') return String(Math.round(v));
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return v.toFixed(opts.decimals ?? 6);
  }
  return String(v);
}

try {
  const raw = fs.readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);
  const sorted = data.slice().sort((a,b) => (b.index || 0) - (a.index || 0));

  const rows = [];
  rows.push('# Popularity data');
  rows.push('');
  rows.push('| Name | Language | Type | Index | Stars | Forks | Contributors | Closed issues | Avg PR merge days | Merged PRs (6mo) | Releases | Releases/yr | SO total questions | SO recent (6mo) | Discussions | Discussions recent (6mo) | Weekly downloads |');
  rows.push('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');

  for (const r of sorted) {
    const name = fmt(r.name);
    const repo = fmt(r.repo);
    const language = fmt(r.language);
    const type = fmt(r.type);
    const index = fmt(r.index, { decimals: 6 });
    const stars = fmt(r.stars, { integer: true });
    const forks = fmt(r.forks, { integer: true });
    const contributors = fmt(r.contributors_count, { integer: true });
    const closed_issues = fmt(r.closed_issues, { integer: true });
    const avg_pr_merge_days = (r.avg_pr_merge_days === null || r.avg_pr_merge_days === undefined) ? '' : String(r.avg_pr_merge_days);
    const merged_prs_last_6mo = fmt(r.merged_prs_last_6mo, { integer: true });
    const releases_count = fmt(r.releases_count, { integer: true });
    const release_frequency_per_year = (r.release_frequency_per_year === null || r.release_frequency_per_year === undefined) ? '' : String(r.release_frequency_per_year);
    const so_total = fmt(r.stackoverflow_total_questions, { integer: true });
    const so_recent = fmt(r.stackoverflow_recent_questions_last_6mo, { integer: true });
    const discussions_count = fmt(r.discussions_count, { integer: true });
    const discussions_recent = fmt(r.discussions_recent_activity_last_6mo, { integer: true });
    const weekly = fmt(r.weekly_downloads, { integer: true });

    const line = `| [${name}](https://github.com/${repo}) | ${language} | ${type} | ${index} | ${stars} | ${forks} | ${contributors} | ${closed_issues} | ${avg_pr_merge_days} | ${merged_prs_last_6mo} | ${releases_count} | ${release_frequency_per_year} | ${so_total} | ${so_recent} | ${discussions_count} | ${discussions_recent} | ${weekly} |`;
    rows.push(line);
  }

  const content = `${rows.join('\n')}\n`;
  fs.writeFileSync(outPath, content, 'utf8');
  console.log(`Wrote ${outPath}`);
} catch (e) {
  console.error('generate-readme failed:', e?.message || e);
  process.exit(1);
}
