# Popularity Tracker

Automation that ranks MongoDB-adjacent projects with a cross-ecosystem Popularity Index and publishes a static web view + JSON data.

Current deployment: https://alexbevi.com/project_popularity/

## How It Works

1. Read project definitions from `config/projects.yml`.
2. Fetch metrics from GitHub and package ecosystems (`scripts/fetchers/*`).
3. Compute index scores in `scripts/build-popularity.js`.
4. Aggregate per-repo artifacts into `data/popularity.json`.
5. Publish generated assets to the `output` branch via GitHub Actions.

## Popularity Index

Implemented in `scripts/build-popularity.js`:

```text
index =
  weights.stars * log10(1 + stars) +
  weights.forks * log10(1 + forks) +
  weights.weekly_downloads * log10(1 + weekly_downloads) +
  weights.merged_prs_last_6mo * log10(1 + merged_prs_last_6mo) +
  weights.release_frequency * log10(1 + release_frequency) +
  weights.dependents * log10(1 + dependents)
```

Current weights from `config/popularity.config.json`:

- `weekly_downloads`: `0.30`
- `stars`: `0.45`
- `forks`: `0.20`
- `merged_prs_last_6mo`: `0.30`
- `release_frequency`: `0.10`
- `dependents`: `0.45`

Notes:

- Each signal is log-scaled with `log10(1 + value)` to reduce outlier skew.
- For multi-ecosystem projects, `weekly_downloads` is the max value across available registries.

## Data Fields

Common fields in output rows include:

- Identity: `name`, `language`, `type`, `repo`
- Core metrics: `stars`, `forks`, `weekly_downloads`, `dependents`
- Engagement metrics: `contributors_count`, `closed_issues`, `avg_pr_merge_days`, `merged_prs_last_6mo`, `releases_count`, `release_frequency_per_year`
- Community metrics: `stackoverflow_total_questions`, `stackoverflow_recent_questions_last_6mo`, `discussions_count`, `discussions_recent_activity_last_6mo`
- Score: `index`

## Outputs

Generated artifacts:

- `data/popularity.json` (canonical ranked dataset)
- `data/popularity.<owner>.<repo>.json` (per-repo scrape artifacts in CI)
- `data/README.md` (table generated from `data/popularity.json`)
- `web/index.html` (generated from `web/index.template.html` by weight injection)

## Run Locally

```bash
npm ci
export GH_TOKEN=ghp_yourtoken
node scripts/build-popularity.js
```

Useful commands:

```bash
# Build one project (matches name/repo substring)
node scripts/build-popularity.js --repo=mongoose

# Inject current weights into web/index.html
node scripts/inject-weights.cjs

# Regenerate data README table
node scripts/generate-readme.js
```

Notes:

- `GH_TOKEN` is recommended to reduce GitHub API rate-limit failures.
- Fetchers are best-effort; missing sources fall back to zeros so runs can complete.

## Add or Update Projects

Edit `config/projects.yml`.

Required fields:

- `name`
- `language`
- `type`
- `repo` (`owner/repo`)

Optional ecosystem fields:

- `npm`, `nuget`, `rubygems`, `crates`, `pypi`, `packagist`, `go`
- `maven: { group, artifact }`
- `stackoverflow`
- `package_id` (for package-scoped dependents where supported)

## CI/CD

Main workflow: `.github/workflows/popularity.yml`

- Scheduled daily at `03:17 UTC` and runnable manually.
- Builds a matrix from `projects.yml`.
- Runs `scripts/scrape-single.cjs` per repo.
- Aggregates artifacts via `scripts/aggregate-artifacts.cjs`.
- Generates `data/README.md`.
- Force-pushes generated assets to the `output` branch.

Redeploy helper workflow: `.github/workflows/redeploy-web.yml`

- Manually republishes web assets (and `popularity.json` if present) to `output`.

## Maintenance

See `AGENTS.md` for repository operating rules and the required documentation-update contract when behavior changes.

