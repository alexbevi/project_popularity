# MongoDB-Adjacent Popularity Tracker

Nightly automation that ranks MongoDB-adjacent projects by a simple, cross-ecosystem Popularity Index:

```
index = 0.45 \* log10(1 + weekly\_downloads)
\+ 0.45 \* log10(1 + stars)
\+ 0.10 \* log10(1 + forks)

```

## Add/Update Projects
Edit `config/projects.yml`. Supply any registry IDs you have (npm, nuget, rubygems, crates, pypi, maven).

## Run Locally
```bash
npm ci
GH_TOKEN=ghp_yourtoken node scripts/build-popularity.js
```

## CI

GitHub Actions runs nightly and auto-commits updates.

## Notes & Options
- **Why weekly vs total downloads?** Weekly gives a “current velocity” feel. Some registries (NuGet, RubyGems, crates) expose only totals; I used a conservative `total/52` proxy. Swap in true weekly if/when you have it (e.g., pypistats.org for PyPI, custom Maven telemetry).
- **Cross-language fairness:** The log transform + fixed weights keeps it simple and broadly comparable. If you later want ecosystem-specific adjustments, add optional per-language weight overrides in `popularity.config.json`.
- **Missing data:** The formula stays defined; projects without download metrics won’t score as high as those with strong download velocity, which is generally acceptable.
- **Extending adapters:** Add any new `fetchers/*.js` that return `{ weekly_downloads }`. The orchestrator already takes the max across registries (handy for projects published to multiple).


