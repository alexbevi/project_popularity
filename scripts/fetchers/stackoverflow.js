import axios from "axios";

// Fetch basic Stack Overflow metrics for a tag.
// Returns { total_questions, recent_questions_last_6mo }
export async function fetchStackOverflow(tag) {
  if (!tag) return { total_questions: 0, recent_questions_last_6mo: 0 };
  const base = "https://api.stackexchange.com/2.3";
  try {
    // tag info -> total question count
    const infoUrl = `${base}/tags/${encodeURIComponent(tag)}/info?site=stackoverflow`;
    const infoResp = await axios.get(infoUrl, { timeout: 15000 });
    const total_questions = (infoResp.data?.items?.[0]?.count) || 0;

    // recent questions in last ~6 months
    const now = Math.floor(Date.now() / 1000);
    const sixMonths = 60 * 60 * 24 * 30 * 6;
    const fromdate = now - sixMonths;
    let recent = 0;
    let page = 1;
    let has_more = true;
    // limit to 5 pages to avoid long runs (500 results)
    while (has_more && page <= 5) {
      const qUrl = `${base}/questions?page=${page}&pagesize=100&fromdate=${fromdate}&tagged=${encodeURIComponent(tag)}&site=stackoverflow`;
      const qResp = await axios.get(qUrl, { timeout: 15000 });
      const items = qResp.data?.items || [];
      recent += items.length;
      has_more = !!qResp.data?.has_more;
      page += 1;
    }

    return { total_questions, recent_questions_last_6mo: recent };
  } catch (e) {
    return { total_questions: 0, recent_questions_last_6mo: 0, _error: e?.message || String(e) };
  }
}
