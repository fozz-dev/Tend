// Tells the app what's switched on. The App ID is public; secret keys never leave the server.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ appId: process.env.ONESIGNAL_APP_ID || null, ai: !!process.env.ANTHROPIC_API_KEY });
};
