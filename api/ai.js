// Tend: optional AI sorting for brain dumps (and project steps / recipes).
// Uses your own Anthropic API key from the ANTHROPIC_API_KEY environment variable.
// If the key is missing or anything fails, the app falls back to Quick sort on the phone.
const hits = new Map(); // simple per-visitor limit, so nobody can run up your bill
const LIMIT = 40, WINDOW = 60 * 60 * 1000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) return res.status(503).json({ error: 'AI is not set up' });
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && !origin.includes(host)) return res.status(403).json({ error: 'Not allowed' });
  const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim(), now = Date.now();
  const h = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (h.length >= LIMIT) return res.status(429).json({ error: 'Too many requests, try again later' });
  h.push(now); hits.set(ip, h);
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const prompt = String(b.prompt || '').slice(0, 24000);
  if (prompt.length < 10) return res.status(400).json({ error: 'Empty' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
        max_tokens: 4000,
        system: 'You are the sorting helper inside Tend, a calm planner app. Reply with ONLY valid JSON, no other text.',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: (j.error && j.error.message) || 'AI error' });
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'Could not reach the AI' });
  }
};
