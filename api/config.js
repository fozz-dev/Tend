// Tells the app which OneSignal app to use. The App ID is public; the REST API key never leaves the server.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ appId: process.env.ONESIGNAL_APP_ID || null });
};
