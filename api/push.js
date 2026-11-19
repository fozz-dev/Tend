// Tend: schedules push notifications for one phone through OneSignal.
// Keeps nothing itself. It receives the phone's notification ID plus a list of reminder times,
// cancels that phone's previously scheduled reminders, and asks OneSignal to schedule the new ones.
const ID = /^[0-9a-zA-Z-]{20,64}$/;
const clip = (s, n) => String(s || '').slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const APP = process.env.ONESIGNAL_APP_ID, KEY = process.env.ONESIGNAL_REST_API_KEY;
  if (!APP || !KEY) return res.status(500).json({ error: 'Notifications are not set up yet (missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY).' });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const sub = String(b.sub || '');
  const auth = KEY.startsWith('os_v2') ? `Key ${KEY}` : `Basic ${KEY}`;
  const site = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

  // 1. Cancel the reminders this phone scheduled last time
  const cancel = (Array.isArray(b.cancel) ? b.cancel : []).filter(x => ID.test(x)).slice(0, 80);
  for (let i = 0; i < cancel.length; i += 10) {
    await Promise.all(cancel.slice(i, i + 10).map(id =>
      fetch(`https://api.onesignal.com/notifications/${id}?app_id=${APP}`, { method: 'DELETE', headers: { Authorization: auth } }).catch(() => null)));
  }
  if (!ID.test(sub)) return res.status(200).json({ ids: [] });

  // 2. Schedule the new ones (max 60, max 30 days ahead, only links back to this site)
  const now = Date.now(), max = now + 30 * 864e5;
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 60).filter(x => x && (x.now || (+x.at > now && +x.at < max)));
  const ids = [];
  for (let i = 0; i < items.length; i += 10) {
    const out = await Promise.all(items.slice(i, i + 10).map(async x => {
      const url = typeof x.url === 'string' && x.url.startsWith(site) ? x.url : site + '/';
      const body = {
        app_id: APP, target_channel: 'push', include_subscription_ids: [sub],
        headings: { en: clip(x.title, 60) || 'Tend' }, contents: { en: clip(x.body, 160) || 'A little nudge from Tend' },
        web_url: url, web_push_topic: clip(`${x.kind || 'n'}-${x.at}`, 60)
      };
      if (!x.now) body.send_after = new Date(+x.at).toISOString();
      try {
        const r = await fetch('https://api.onesignal.com/notifications?c=push', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: auth }, body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        return r.ok && j.id ? j.id : null;
      } catch (e) { return null; }
    }));
    out.forEach(id => id && ids.push(id));
  }
  if (items.length && !ids.length) return res.status(502).json({ error: 'OneSignal did not accept the reminders. Check the App ID and REST API key.' });
  return res.status(200).json({ ids });
};
