#!/usr/bin/env bash
# Puts Meta's Wearables Device Access Toolkit 1.0.1 frameworks (MWDATCore, MWDATCamera) where the GlanceGlasses
# pod expects them. Run once before `pod install` / `expo run:ios`. Using them means agreeing to Meta's
# Wearables Developer Terms: https://wearables.developer.meta.com/terms
set -euo pipefail
cd "$(dirname "$0")/.."
dest=modules/glance-glasses/ios/Frameworks
if [ -d "$dest/MWDATCore.xcframework" ] && [ -d "$dest/MWDATCamera.xcframework" ]; then echo "Meta DAT already in $dest"; exit 0; fi
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git clone --quiet --depth 1 --branch 1.0.1 https://github.com/facebook/meta-wearables-dat-ios "$tmp/dat"
mkdir -p "$dest"
cp -R "$tmp/dat/MWDATCore.xcframework" "$tmp/dat/MWDATCamera.xcframework" "$dest/"
echo "Meta DAT 1.0.1 frameworks in $dest"
