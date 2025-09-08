# Popularity Tracker

Nightly automation that ranks MongoDB-adjacent projects by a simple, cross-ecosystem Popularity Index.

## Popularity Index (current logic)

The index combines three signals: weekly downloads, GitHub stars, and GitHub forks. Each value is log-transformed to reduce skew and then weighted.

Formula (implemented in `scripts/build-popularity.js`):

```
index = weights.weekly_downloads * log10(1 + weekly_downloads)
	+ weights.stars * log10(1 + stars)
	+ weights.forks * log10(1 + forks)
```

Default weights are in `config/popularity.config.json` (current defaults are 0.45 for downloads, 0.45 for stars, 0.10 for forks).

Implementation note: the orchestrator picks the max `weekly_downloads` across registries when a project is published to multiple ecosystems.

## New developer engagement fields

The GitHub fetcher now collects additional signals that help indicate maintenance and community engagement. These appear under the top-level JSON rows (when available):

- `contributors_count` — approximate number of contributors
- `closed_issues` — total closed issues (from GitHub search)
- `avg_pr_merge_days` — average time from PR creation to merge (days)
- `merged_prs_last_6mo` — number of merged PRs in the last 6 months
- `releases_count` — number of tagged releases
- `release_frequency_per_year` — estimated releases/year (based on published dates)

These are optional enrichment fields used for analysis and not currently part of the index calculation. They are useful for classifying projects as "actively maintained" vs "abandoned".

## Outputs

The build now produces JSON-only output:

- `data/popularity.json` — array of ranked rows with the index and engagement fields.

If a CSV file from previous runs exists (`data/popularity.csv`), it will no longer be re-generated; delete it if you want to remove stale artifacts.

## Run locally

Install and run the build script (recommended to set a GitHub token to avoid rate limits):

```bash
npm ci
export GH_TOKEN=ghp_yourtoken
node scripts/build-popularity.js
```

Notes:
- `GH_TOKEN` increases GitHub API rate limits and avoids 403 responses during fetches.
- The fetchers are tolerant of failures and will log warnings. Missing data results in sensible defaults so the pipeline completes.

## Add / update projects

Edit `config/projects.yml` and add or update entries. Supply any registry IDs you have (npm, nuget, rubygems, crates, pypi, maven).

## CI

GitHub Actions runs nightly and auto-commits updates to `data/popularity.json`.

## Extending the project

- To add more signals (Stack Overflow, GitHub Discussions), add a new fetcher under `scripts/fetchers/` that returns the expected shape and include it in the orchestrator.
- For large repositories, consider adding pagination to contributor/PR fetches for more accurate counts.


