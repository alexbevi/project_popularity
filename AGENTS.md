# AGENTS.md

This file is the working guide for humans and coding agents in this repository.
It is a living document and must be updated alongside behavior-changing code/config changes.

## Maintenance Contract

Update this file in the same change whenever you modify:

- `config/projects.yml`
- `config/popularity.config.json`
- any file under `scripts/`
- any workflow under `.github/workflows/`
- any `web/` data-loading path or output format assumptions

Also update:

- `System Map` if ownership of files/scripts changes
- `Runbook` if local/CI commands change
- `Generated Artifacts` if outputs or paths change
- `Change Log` with a new dated line

## Project Purpose

Track and rank MongoDB-adjacent projects using a cross-ecosystem popularity index, then publish static output (web UI + JSON data) for deployment.

## Runtime and Tooling

- Node.js 20 in CI (`actions/setup-node@v4`)
- npm (`npm ci`)
- `package.json` uses `"type": "module"`
- repo mixes ESM (`.js`, `.mjs`) and CommonJS helpers (`.cjs`)

## System Map

- `config/projects.yml`: source of truth for tracked projects and package/repo identifiers
- `config/popularity.config.json`: index weights + output paths
- `scripts/build-popularity.js`:
  - fetches metrics from all fetchers
  - computes index
  - writes `data/popularity.json`
  - exports `buildSingle(repoFull)` for single-project runs
- `scripts/matrix-from-projects.cjs`: builds GitHub Actions matrix from `projects.yml`
- `scripts/scrape-single.cjs`: runs one repo scrape and writes `data/popularity.<owner>.<repo>.json`
- `scripts/aggregate-artifacts.cjs`: discovers/merges per-repo artifacts into canonical `data/popularity.json`
- `scripts/generate-readme.js`: writes `data/README.md` summary table
- `scripts/inject-weights.cjs`: injects config weights into `web/index.html` from `web/index.template.html`
- `scripts/fetchers/*.js`: per-source metric fetchers (GitHub, npm, NuGet, RubyGems, crates, PyPI, Maven, Go, Packagist, StackOverflow, Discussions)
- `.github/workflows/popularity.yml`: daily pipeline (03:17 UTC) + output-branch publish
- `.github/workflows/redeploy-web.yml`: manual redeploy of web assets (and `popularity.json` when present)
- `web/`: static UI assets; app reads `data/popularity.json`

## Popularity Index (Code Truth)

Current formula in `scripts/build-popularity.js`:

`index = w_stars*log10(1+stars) + w_forks*log10(1+forks) + w_weekly_downloads*log10(1+weekly_downloads) + w_merged_prs_last_6mo*log10(1+merged_prs_last_6mo) + w_release_frequency*log10(1+release_frequency) + w_dependents*log10(1+dependents)`

Weights come from `config/popularity.config.json`.

## Generated Artifacts

Treat these as generated outputs (avoid hand edits):

- `data/popularity.json`
- `data/popularity.<owner>.<repo>.json`
- `data/README.md`
- `web/index.html` (generated from `web/index.template.html` + injected weights)

Primary editable sources:

- `config/projects.yml`
- `config/popularity.config.json`
- `scripts/**/*.js` / `scripts/**/*.cjs` / `scripts/**/*.mjs`
- `web/index.template.html`
- `web/app.js`
- `web/style.css`
- `.github/workflows/*.yml`

## Local Runbook

1. Install dependencies: `npm ci`
2. Set token (recommended): `export GH_TOKEN=<token>`
3. Full build: `node scripts/build-popularity.js`
4. Single project build: `node scripts/build-popularity.js --repo=<name-or-owner/repo>`
5. Refresh injected weights in UI: `node scripts/inject-weights.cjs`
6. Regenerate data README: `node scripts/generate-readme.js`

## projects.yml Entry Shape

Required fields:

- `name`
- `language`
- `type`
- `repo` (`owner/repo`)

Optional ecosystem fields:

- `npm`
- `nuget`
- `rubygems`
- `crates`
- `pypi`
- `maven: { group, artifact }`
- `packagist`
- `go`
- `stackoverflow`
- `package_id` (used for package-scoped GitHub dependents when available)

## Known Gotchas

- `data/` is gitignored in this branch; generated data is generally published through the `output` branch workflow.
- `README.md` can drift from live formula/weights. Code + `config/popularity.config.json` are the authoritative source.
- Because the repo is ESM-first, prefer `scripts/inject-weights.cjs` over `scripts/inject-weights.js`.

## Change Log

- 2026-02-20: Initial `AGENTS.md` created from a full repository scan.
- 2026-02-20: Web filters now sync with URL query params (`language`, `type`, `search`) and are restored on load.
