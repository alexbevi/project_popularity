import axios from "axios";

// PyPI JSON doesn't expose downloads directly anymore. Use pypistats.org if you want real weekly.
// Here we return 0 by default to avoid guessing; or wire up pypistats w/ caching later.
export async function fetchPyPI(pkg) {
  return { weekly_downloads: 0 };
}