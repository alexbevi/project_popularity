// Load the generated output from the repo's data folder
const dataUrl = 'data/popularity.json';

function $id(id){return document.getElementById(id)}
function fmtNumber(n){if(n===undefined||n===null||n==='')return ''; return new Intl.NumberFormat().format(n)}

function pkgSourceUrl(r){
  // Prefer ecosystem package pages in this order
  try{
    if(r.npm) return `https://www.npmjs.com/package/${encodeURIComponent(r.npm)}`;
    if(r.pypi) return `https://pypi.org/project/${encodeURIComponent(r.pypi)}/`;
    if(r.nuget) return `https://www.nuget.org/packages/${encodeURIComponent(r.nuget)}`;
    if(r.rubygems) return `https://rubygems.org/gems/${encodeURIComponent(r.rubygems)}`;
    if(r.crates) return `https://crates.io/crates/${encodeURIComponent(r.crates)}`;
    if(r.packagist) return `https://packagist.org/packages/${encodeURIComponent(r.packagist)}`;
    if(r.maven && r.maven.group && r.maven.artifact) return `https://search.maven.org/artifact/${encodeURIComponent(r.maven.group)}/${encodeURIComponent(r.maven.artifact)}`;
    if(r.go) return `https://pkg.go.dev/${encodeURIComponent(r.go)}`;
    if(r.repo) return `https://github.com/${r.repo}`;
  }catch(e){/* ignore */}
  // fallback heuristics
  const h = heuristicPackageUrl(r);
  return h || '#';
}

// slugify project name into a package id guess
function slugifyName(name){
  if(!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g,'-').replace(/[()\[\],]/g,'').replace(/[^a-z0-9\-_.@]/g,'');
}

// Heuristic package URL generation when explicit package IDs are missing.
function heuristicPackageUrl(r){
  try{
    // PyPI for Python projects
    if(r.language === 'Python'){
      const pkg = r.pypi || slugifyName(r.name);
      if(pkg) return `https://pypi.org/project/${encodeURIComponent(pkg)}/`;
    }
    // npm for JavaScript projects
    if(r.language === 'JavaScript' || r.language === 'TypeScript'){
      const pkg = r.npm || slugifyName(r.name);
      if(pkg) return `https://www.npmjs.com/package/${encodeURIComponent(pkg)}`;
    }
    // Maven: try to search by artifact using repo name when maven info absent
    if(r.language === 'Java' && r.repo){
      const parts = (r.repo || '').split('/');
      const artifact = parts[parts.length-1];
      if(artifact) return `https://search.maven.org/search?q=a:%22${encodeURIComponent(artifact)}%22`;
    }
  }catch(e){}
  return null;
}

function stackOverflowUrl(r){
  if(r.stackoverflow) return `https://stackoverflow.com/questions/tagged/${encodeURIComponent(r.stackoverflow)}`;
  // fallback: search by repo/name
  const q = encodeURIComponent((r.name || r.repo || '').trim());
  return q ? `https://stackoverflow.com/search?q=${q}` : '#';
}

function discussionsUrl(r){
  if(r.repo) return `https://github.com/${r.repo}/discussions`;
  return '#';
}

async function loadData(){
  const status = $id('status');
  try{
    const res = await fetch(dataUrl, {cache: 'no-store'});
    if(!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const data = await res.json();
    status.textContent = '';
    return data;
  }catch(e){
    status.textContent = 'Failed to load data: '+e.message;
    console.error(e);
    return [];
  }
}

// Theme handling
function setTheme(theme){
  if(theme === 'light') document.documentElement.classList.add('light');
  else document.documentElement.classList.remove('light');
  localStorage.setItem('theme', theme);
  const btn = document.getElementById('theme-toggle');
  if(btn) btn.textContent = theme === 'light' ? '☀️ Light' : '🌙 Dark';
}

function initTheme(){
  const saved = localStorage.getItem('theme');
  if(saved) setTheme(saved);
  else {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    setTheme(prefersLight ? 'light' : 'dark');
  }
  const btn = document.getElementById('theme-toggle');
    if(btn){
      btn.setAttribute('aria-pressed', document.documentElement.classList.contains('light'));
      btn.addEventListener('click', ()=>{
        const now = document.documentElement.classList.contains('light') ? 'dark' : 'light';
        setTheme(now);
        btn.setAttribute('aria-pressed', now === 'light');
      });
    }
}

function unique(values){return Array.from(new Set(values.filter(v=>v!==undefined && v!==null && v!==''))).sort()}

function makeOption(value){const o=document.createElement('option');o.value=value;o.textContent=value;return o}

function renderTable(rows){
  const tbody = document.querySelector('#results tbody');
  tbody.innerHTML = '';
  for(const r of rows){
    const tr = document.createElement('tr');
    const name = document.createElement('td');
    const a = document.createElement('a');
    a.href = r.repo ? `https://github.com/${r.repo}` : '#';
    a.textContent = r.name || r.repo || '';
    a.target = '_blank';
    name.appendChild(a);
    tr.appendChild(name);

    const language = document.createElement('td'); language.textContent = r.language || '';
    const type = document.createElement('td'); type.textContent = r.type || '';
  const index = document.createElement('td'); index.textContent = (r.index===undefined||r.index===null)?'':Number(r.index).toFixed(6);
  const stars = document.createElement('td'); stars.textContent = fmtNumber(r.stars);
  const forksTd = document.createElement('td'); forksTd.textContent = fmtNumber(r.forks);
  const mergedPrsTd = document.createElement('td'); mergedPrsTd.textContent = fmtNumber(r.merged_prs_last_6mo || 0);
  const weekly = document.createElement('td');
  const weeklyLink = document.createElement('a');
  weeklyLink.href = pkgSourceUrl(r);
  weeklyLink.target = '_blank';
  weeklyLink.rel = 'noopener noreferrer';
  weeklyLink.textContent = fmtNumber(r.weekly_downloads);
  weekly.appendChild(weeklyLink);

  const so = document.createElement('td');
  const soLink = document.createElement('a');
  soLink.href = stackOverflowUrl(r);
  soLink.target = '_blank';
  soLink.rel = 'noopener noreferrer';
  soLink.textContent = fmtNumber(r.stackoverflow_recent_questions_last_6mo);
  so.appendChild(soLink);

  const disc = document.createElement('td');
  const discLink = document.createElement('a');
  discLink.href = discussionsUrl(r);
  discLink.target = '_blank';
  discLink.rel = 'noopener noreferrer';
  discLink.textContent = fmtNumber(r.discussions_recent_activity_last_6mo);
  disc.appendChild(discLink);
  const releasesTd = document.createElement('td');
  const relLink = document.createElement('a');
  relLink.href = r.repo ? `https://github.com/${r.repo}/releases` : '#';
  relLink.target = '_blank';
  relLink.rel = 'noopener noreferrer';
  relLink.textContent = fmtNumber(r.releases_count);
  releasesTd.appendChild(relLink);

  const relFreqTd = document.createElement('td');
  relFreqTd.textContent = r.release_frequency_per_year ? Number(r.release_frequency_per_year).toFixed(2) : '';

  const dependentsTd = document.createElement('td');
  if(r.dependents){
    const depLink = document.createElement('a');
    depLink.href = `https://github.com/${r.repo}/network/dependents`;
    depLink.target = '_blank';
    depLink.rel = 'noopener noreferrer';
    depLink.textContent = fmtNumber(r.dependents);
    dependentsTd.appendChild(depLink);
  } else {
    dependentsTd.textContent = fmtNumber(r.dependents || 0);
  }

  const contributors = document.createElement('td');
  if(r.repo){
    const cLink = document.createElement('a');
    cLink.href = `https://github.com/${r.repo}/graphs/contributors`;
    cLink.target = '_blank';
    cLink.rel = 'noopener noreferrer';
    cLink.textContent = fmtNumber(r.contributors_count);
    contributors.appendChild(cLink);
  } else {
    contributors.textContent = fmtNumber(r.contributors_count);
  }

  tr.appendChild(language);
  tr.appendChild(type);
  tr.appendChild(index);
  tr.appendChild(stars);
  tr.appendChild(forksTd);
  tr.appendChild(mergedPrsTd);
  tr.appendChild(weekly);
  tr.appendChild(so);
  tr.appendChild(disc);
  tr.appendChild(releasesTd);
  tr.appendChild(relFreqTd);
  tr.appendChild(dependentsTd);
  tr.appendChild(contributors);

    tbody.appendChild(tr);
  }
}

function applyFilters(data){
  const lang = $id('filter-language').value;
  const type = $id('filter-type').value;
  const q = $id('filter-search').value.trim().toLowerCase();
  let rows = data.slice();
  // apply current sort state if present
  const currentSortKey = document.body.getAttribute('data-sort-key') || 'index';
  const currentSortDir = document.body.getAttribute('data-sort-dir') || 'desc';
  rows.sort((a,b)=> compareRows(a,b,currentSortKey,currentSortDir));
  if(lang) rows = rows.filter(r=>r.language===lang);
  if(type) rows = rows.filter(r=>r.type===type);
  if(q) rows = rows.filter(r=> (r.name||'').toLowerCase().includes(q) || (r.repo||'').toLowerCase().includes(q));
  renderTable(rows);
}

function compareRows(a,b,key,dir){
  const av = (a && a[key] !== undefined && a[key] !== null) ? a[key] : '';
  const bv = (b && b[key] !== undefined && b[key] !== null) ? b[key] : '';
  // numeric compare when both look like numbers
  const an = Number(av);
  const bn = Number(bv);
  let cmp = 0;
  if(!isNaN(an) && !isNaN(bn)) cmp = an - bn;
  else cmp = String(av).localeCompare(String(bv));
  return dir === 'asc' ? cmp : -cmp;
}

initTheme();

(async function(){
  const data = await loadData();
  const languages = unique(data.map(d=>d.language));
  const types = unique(data.map(d=>d.type));
  const langSel = $id('filter-language');
  const typeSel = $id('filter-type');
  for(const l of languages) langSel.appendChild(makeOption(l));
  for(const t of types) typeSel.appendChild(makeOption(t));

  const search = $id('filter-search');
  const clear = $id('clear');

  langSel.addEventListener('change',()=>applyFilters(data));
  typeSel.addEventListener('change',()=>applyFilters(data));
  search.addEventListener('input',()=>applyFilters(data));
  clear.addEventListener('click',()=>{ langSel.value=''; typeSel.value=''; search.value=''; applyFilters(data); });

  // setup sortable headers: th[data-key]
  document.body.setAttribute('data-sort-key', 'index');
  document.body.setAttribute('data-sort-dir', 'desc');
  const ths = document.querySelectorAll('th[data-key]');
  ths.forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', ()=>{
      const key = th.getAttribute('data-key');
      const curKey = document.body.getAttribute('data-sort-key');
      const curDir = document.body.getAttribute('data-sort-dir') || 'desc';
      if(curKey === key) {
        // toggle
        const newDir = curDir === 'asc' ? 'desc' : 'asc';
        document.body.setAttribute('data-sort-dir', newDir);
        // update header visuals
        updateSortHeaderState(key, newDir);
      } else {
        document.body.setAttribute('data-sort-key', key);
        document.body.setAttribute('data-sort-dir', 'desc');
        updateSortHeaderState(key, 'desc');
      }
      applyFilters(data);
    });
  });

  // initialize header visuals
  updateSortHeaderState(document.body.getAttribute('data-sort-key') || 'index', document.body.getAttribute('data-sort-dir') || 'desc');

  function updateSortHeaderState(activeKey, dir){
    ths.forEach(t=>{ t.classList.remove('sorted','asc','desc'); });
    const active = document.querySelector(`th[data-key="${activeKey}"]`);
    if(active){ active.classList.add('sorted'); active.classList.add(dir === 'asc' ? 'asc' : 'desc'); }
  }

  applyFilters(data);
})();
