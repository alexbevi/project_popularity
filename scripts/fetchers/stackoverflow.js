import axios from "axios";

// Fetch basic Stack Overflow metrics for a tag.
// Returns { total_questions, recent_questions_last_6mo }
export async function fetchStackOverflow(tag) {
  if (!tag) return { total_questions: 0, recent_questions_last_6mo: 0 };
  const base = "https://api.stackexchange.com/2.3";
  console.log(`[fetchStackOverflow] starting fetch for tag="${tag}"`);
  try {
    // Try a few candidate tag variants to handle capitalization/spacing differences
    const candidates = [
      tag,
      tag.toLowerCase(),
      tag.replace(/\s+/g, '-'),
      tag.toLowerCase().replace(/\s+/g, '-')
    ].filter(Boolean);

    let resolvedTag = null;
    let total_questions = 0;

    for (const t of candidates) {
      const infoUrl = `${base}/tags/${encodeURIComponent(t)}/info?site=stackoverflow`;
      console.log(`[fetchStackOverflow] trying tag info URL: ${infoUrl}`);
      const infoResp = await axios.get(infoUrl, { timeout: 15000 });
      const items = infoResp.data?.items || [];
      if (items.length > 0) {
        resolvedTag = items[0].name || t;
        total_questions = items[0].count || items[0].question_count || 0;
        console.log(`[fetchStackOverflow] resolved tag '${resolvedTag}' -> total_questions=${total_questions}`);
        break;
      }
    }

    // fallback: search for tags containing the name
    if (!resolvedTag) {
      const searchUrl = `${base}/tags?inname=${encodeURIComponent(tag)}&site=stackoverflow&pagesize=5`;
      console.log(`[fetchStackOverflow] tag not found, searching tags via: ${searchUrl}`);
      const sResp = await axios.get(searchUrl, { timeout: 15000 });
      const items = sResp.data?.items || [];
      if (items.length > 0) {
        resolvedTag = items[0].name;
        total_questions = items[0].count || 0;
        console.log(`[fetchStackOverflow] search matched tag '${resolvedTag}' -> total_questions=${total_questions}`);
      }
    }

    // If still not resolved, return zeros but include warning
    if (!resolvedTag) {
      console.warn(`[fetchStackOverflow] could not resolve tag for '${tag}', returning zeros`);
      return { total_questions: 0, recent_questions_last_6mo: 0 };
    }

    // recent questions in last ~6 months (paginate, but limit to 10 pages to be safe)
    const now = Math.floor(Date.now() / 1000);
    const sixMonths = 60 * 60 * 24 * 30 * 6;
    const fromdate = now - sixMonths;
    let recent = 0;
    let page = 1;
    let has_more = true;
    const maxPages = 10;
    while (has_more && page <= maxPages) {
      const qUrl = `${base}/search/advanced?page=${page}&pagesize=100&fromdate=${fromdate}&tagged=${encodeURIComponent(resolvedTag)}&site=stackoverflow`;
      console.log(`[fetchStackOverflow] fetching recent questions page=${page} url=${qUrl}`);
      const qResp = await axios.get(qUrl, { timeout: 15000 });
      const items = qResp.data?.items || [];
      recent += items.length;
      has_more = !!qResp.data?.has_more;
      page += 1;
      // respect backoff if provided
      const backoff = qResp.data?.backoff;
      if (backoff) {
        console.log(`[fetchStackOverflow] backoff requested: ${backoff}s — sleeping`);
        await new Promise(r => setTimeout(r, backoff * 1000));
      }
    }

    console.log(`[fetchStackOverflow] finished for '${tag}' (resolved: '${resolvedTag}') total_questions=${total_questions} recent_last_6mo=${recent}`);
    return { total_questions, recent_questions_last_6mo: recent };
  } catch (e) {
    console.warn(`[fetchStackOverflow] fetch failed for '${tag}': ${e?.message || e}`);
    return { total_questions: 0, recent_questions_last_6mo: 0, _error: e?.message || String(e) };
  }
}
