// Link's app config: app.json, plus signing options for building on someone else's Apple team.
// Nothing changes unless these are set (a free Personal Team build stays exactly as app.json says):
//   APPLE_TEAM_ID=XXXXXXXXXX        the Apple team that signs the app
//   LINK_BUNDLE_ID=com.you.link     a bundle id that team can register (com.metaintros.link is taken)
//   LINK_GLASSES_HOTSPOT=1          adds Apple's Hotspot Configuration entitlement (paid teams only). Meta's
//                                   glasses SDK needs it to join the glasses' Wi-Fi for video.
// See docs/GLASSES.md.
module.exports = ({ config }) => {
  const ios = { ...config.ios };
  if (process.env.APPLE_TEAM_ID) ios.appleTeamId = process.env.APPLE_TEAM_ID;
  if (process.env.LINK_BUNDLE_ID) ios.bundleIdentifier = process.env.LINK_BUNDLE_ID;
  const hotspot = process.env.LINK_GLASSES_HOTSPOT === '1';
  if (hotspot) ios.entitlements = { ...ios.entitlements, 'com.apple.developer.networking.HotspotConfiguration': true };
  return { ...config, ios, extra: { ...config.extra, linkGlassesHotspot: hotspot } };
};
