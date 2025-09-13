const fs = require('fs');
const path = require('path');
const { buildSingle } = require('./build-popularity.js');
const yaml = require('js-yaml');

function projectExists(repoFull) {
  try {
    const cfgPath = path.join(__dirname, '..', 'config', 'projects.yml');
    const raw = require('fs').readFileSync(cfgPath, 'utf8');
    const parsed = yaml.load(raw);
    const list = parsed && parsed.projects ? parsed.projects : [];
    const q = String(repoFull).toLowerCase();
    return list.some(p => (p && p.repo && String(p.repo).toLowerCase() === q));
  } catch (e) {
    // if we can't read config, be conservative and return false
    console.error('projectExists: failed to read projects.yml', e && e.message);
    return false;
  }
}

(async function(){
  try {
    const owner = process.env.OWNER || process.argv[2];
    const repo = process.env.REPO || process.argv[3];
    const repo_full = process.env.REPO_FULL || process.argv[4] || (owner && repo && `${owner}/${repo}`);
    if(!repo_full){
      console.error('Usage: node scripts/scrape-single.cjs <owner> <repo> <owner/repo> or set OWNER/REPO/REPO_FULL env');
      process.exit(2);
    }

    console.log('scrape-single starting for', repo_full);
    // guard: ensure the repo exists in config/projects.yml
    if (!projectExists(repo_full)) {
      console.error(`Error: project ${repo_full} not found in config/projects.yml`);
      process.exit(2);
    }
    const row = await buildSingle(repo_full);
    const ts = new Date().toISOString();
    const out = Object.assign({}, row, { repo: repo_full, timestamp: ts });
  const outDir = path.join(__dirname, '..', 'data');
  require('fs').mkdirSync(outDir, { recursive: true });
  const fname = path.join(outDir, `popularity.${owner}.${repo}.json`);
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(fname,'utf8')) || []; } catch(e){}
    arr.push(out);
    fs.writeFileSync(fname, JSON.stringify(arr, null, 2), 'utf8');
    console.log('Wrote', fname);
  } catch (e) {
    console.error('scrape-single error', e && e.stack || e);
    process.exit(1);
  }
})();
