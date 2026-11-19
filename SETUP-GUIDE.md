# Tend on Vercel: setup guide (all on iPhone)

You need about 30 minutes, free accounts on **GitHub**, **Vercel** (yours is ready) and **OneSignal**, and an iPhone on iOS 16.4 or newer.

What's in the zip:

| File | What it's for |
|---|---|
| `index.html` | The whole Tend app (test version, no Claude needed) |
| `manifest.webmanifest`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Makes it install as "Tend" with its own icon |
| `OneSignalSDKWorker.js` | Lets the phone receive notifications |
| `api/push.js`, `api/config.js` | Two tiny server functions that schedule notifications. Your secret key stays here, never in the app |
| `vercel.json` | Makes phones always load the newest version |

You never need to type your link anywhere: Tend works out its own address, so links in notifications and calendar reminders fill themselves in.

---

## 1. Put Tend online (GitHub + Vercel)

GitHub keeps the files; Vercel turns them into a website. Doing it this way means you can update Tend later from your iPhone, and the link never changes.

1. In the **Files** app, tap `tend-vercel.zip` once. It unzips into a folder `tend-vercel`.
2. In Safari, go to **github.com**, sign up or log in.
3. Tap **+** (top right) → **New repository**. Name it `tend`. Choose **Private**. Tap **Create repository**.
4. On the empty repository page, tap the link **uploading an existing file**.
5. Tap **choose your files**, open the `tend-vercel` folder and select all the files at the top level: `index.html`, `manifest.webmanifest`, the three `.png` icons, `OneSignalSDKWorker.js`, `vercel.json` and `SETUP-GUIDE.md`. Tap **Commit changes**.
6. Now the two server files (GitHub on iPhone can't upload folders, so you create them):
   - Tap **Add file** → **Create new file**.
   - In the name box type exactly `api/push.js` (typing the `/` makes the folder).
   - Paste the code from **Appendix A** at the bottom of this guide. Tap **Commit changes**.
   - Again: **Add file** → **Create new file**, name `api/config.js`, paste **Appendix B**, **Commit changes**.
7. Go to **vercel.com** → log in → **Add New…** → **Project**.
8. Tap **Continue with GitHub**, allow Vercel to see your `tend` repository, then tap **Import** next to it.
9. Leave every setting as it is (Framework: "Other"). Tap **Deploy**. Wait about a minute.
10. Tap **Continue to Dashboard**. Under **Domains** you'll see your permanent link, something like `https://tend-yourname.vercel.app`. That's the link to send testers.

*Want a nicer link?* Project → **Settings** → **Domains** → edit the `.vercel.app` name (for example `tend-sam.vercel.app`). Do this **before** testers start, because their data belongs to the exact address.

## 2. Turn on notifications (OneSignal)

1. Go to **onesignal.com** → **Sign up** (the free plan is plenty).
2. Create a new app: name it `Tend`, choose **Web** as the platform.
3. Pick **Custom Code** as the integration type.
4. Fill in:
   - **Site Name**: `Tend`
   - **Site URL**: your Vercel link from step 1.10, for example `https://tend-sam.vercel.app` (no slash at the end)
   - **Default icon**: upload `icon-192.png`
   - Leave everything else off. You don't need a Safari certificate; iPhones on iOS 16.4+ work without one.
5. Save. Skip the code snippets OneSignal shows you: Tend already has them.
6. Go to **Settings** → **Keys & IDs**:
   - Copy the **OneSignal App ID**.
   - Under **API keys**, tap **Add key**, name it `Tend`, and copy the key it shows (it starts with `os_v2_app_`). You only see it once, so paste it straight into Vercel (next step).
7. In **Vercel** → your project → **Settings** → **Environment Variables**, add two:
   - Name `ONESIGNAL_APP_ID`, value: the App ID.
   - Name `ONESIGNAL_REST_API_KEY`, value: the API key.
8. Vercel → **Deployments** → tap **⋯** on the top one → **Redeploy**. The keys only take effect after this.

What OneSignal stores: your testers' notification IDs and the reminder messages with their times. Task names are only included if a tester turns on "Show task names in reminders" (it's off by default). Nothing else from the app leaves the phone.

## 3. Update Tend later (same link, testers keep their data)

When I send you a new `index.html`:

1. Save it to Files.
2. In Safari, open **github.com** → your `tend` repository.
3. Tap **Add file** → **Upload files** → choose the new `index.html` → **Commit changes**.
4. Vercel updates the site by itself within a minute or two. The link stays the same, and testers keep everything, because their data lives on their own phones under that address.

Only replace the files I tell you to. Never rename the project's domain once testers are using it.

## 4. Test it on your own phone first

1. Open your link in **Safari** on your iPhone.
2. Tap **Share** → **Add to Home Screen** → **Add**. A Tend icon appears.
3. Open Tend **from the home screen icon** (not Safari). The home-screen app keeps its own data, separate from Safari.
4. Go through the welcome. When it asks **"Want a nudge each day?"**, tap **Allow notifications**, then **Allow** on the iPhone pop-up.
5. Go to **Settings** (⚙️) → **Reminders** → **Send a test**. Close Tend (swipe up). Within a few seconds a "🌱 Hello from Tend!" notification should arrive.
6. To test a scheduled one: set the morning check-in time to 2–3 minutes from now, close Tend, and wait.
7. Tap a notification: Tend should open on the check-in (morning) or check-out (evening).

**If the test doesn't arrive:**
- Check iPhone **Settings → Notifications → Tend** is on.
- Check both environment variables in Vercel, and that you tapped **Redeploy** after adding them.
- In OneSignal → **Audience**, you should see 1 subscription. If not, delete the home-screen icon, add it again, and allow notifications again.
- Focus modes (Sleep, Work) can hold notifications back.

**Good to know:**
- Tend schedules the next two weeks of reminders and tops them up every time it's opened. If a tester doesn't open it for two weeks, the reminders stop. The last one says "Open Tend to keep these coming."
- Testers who don't allow notifications (or whose phone can't do them) can tap **📅 Add daily reminders to my phone's calendar** instead.

## What to send testers

> Hi! Here's Tend, the planner I'm building: **[your link]**
> On iPhone: open it in Safari → Share → **Add to Home Screen**, then open Tend from your home screen and allow notifications so it can give you a gentle nudge. There's a 💬 Feedback button on the Today screen. Thank you! 💜

---

## Appendix A: `api/push.js`

```js
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
```

## Appendix B: `api/config.js`

```js
// Tells the app which OneSignal app to use. The App ID is public; the REST API key never leaves the server.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ appId: process.env.ONESIGNAL_APP_ID || null });
};
```
