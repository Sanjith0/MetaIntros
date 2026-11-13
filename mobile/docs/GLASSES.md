# Build Link with Meta glasses on a paid Apple team

Link's Glance screen can use Ray-Ban Meta glasses as its camera (`modules/glance-glasses`, Meta Wearables Device
Access Toolkit 1.0.1). The glasses send video over their own Wi-Fi hotspot, and joining it needs Apple's
**Hotspot Configuration** entitlement. Free (Personal Team) Apple accounts cannot sign that entitlement, so on a
free team the glasses connect but no video arrives. Build on a paid Apple Developer team instead.

## What you need

- A Mac with Xcode (26.x was used) signed in to the **paid** team (Xcode → Settings → Accounts), Node 22.13+ and
  npm, and CocoaPods (`brew install cocoapods`).
- The iPhone plugged in, unlocked, trusted, with Developer Mode on (Settings → Privacy & Security).
- Your 10-character Apple team ID (Xcode → Settings → Accounts → the team, or developer.apple.com → Membership).

## Steps

```sh
git clone https://github.com/Sanjith0/MetaIntros.git && cd MetaIntros/mobile   # or: git pull
npm ci
scripts/fetch-meta-dat.sh            # Meta's SDK frameworks (about 40 MB, not in git)

export APPLE_TEAM_ID=XXXXXXXXXX                 # the paid team
export LINK_BUNDLE_ID=com.yourname.link         # any id that team can register; com.metaintros.link is taken
export LINK_GLASSES_HOTSPOT=1                   # adds the Hotspot entitlement
export EXPO_PUBLIC_QUEUEUP_URL=https://queueup-expo.vercel.app
export EXPO_PUBLIC_CONVEX_URL=https://dynamic-pony-636.convex.cloud
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8      # CocoaPods fails without a UTF-8 locale

npx expo prebuild --platform ios --clean
npx expo run:ios --device --configuration Release
```

`--device` lists connected devices; pick the iPhone. A **Release** build carries the app's code inside it, so the
phone does not need this Mac or a dev server afterwards. Glance itself loads from https://queueup-expo.vercel.app,
whose data comes from the Queue Up server behind that site.

If Xcode asks about signing, open `ios/Link.xcworkspace`, select the Link target → Signing & Capabilities, and
check that the paid team is selected and "Hotspot Configuration" is listed.

## On the phone

1. In the Meta AI app: glasses paired and on, Developer Mode on for the glasses.
2. In Link: an event → Join with Glance → the round Glasses button → "1. Connect Meta AI" (approve in Meta AI) →
   "2. Allow glasses camera".
3. Pick "Ray-Ban Meta" as the camera on the live scan or a conversation. The dot on the Glasses button turns
   green when frames arrive.

Without `LINK_GLASSES_HOTSPOT=1` the app builds exactly as `app.json` says (no entitlement), which is what a free
team needs; the glasses then connect but report that the video link did not start.
