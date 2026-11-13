#!/usr/bin/env bash
# Run the app on a phone in Expo Go (no Vercel link needed on the phone).
#   QUEUEUP_URL      the Link server the phone talks to (default: the live Vercel app, which forwards /api to it)
#   EXPO_PUBLIC_CONVEX_URL  Glance's Convex backend
#   MODE             --tunnel (default; works on any network) or --lan (phone and Mac on the same Wi-Fi)
# Glance's camera, face and microphone features need a development build; in Expo Go they say so instead of crashing.
set -euo pipefail
cd "$(dirname "$0")/.."
export EXPO_PUBLIC_QUEUEUP_URL="${QUEUEUP_URL:-https://queueup-expo.vercel.app}"
export EXPO_PUBLIC_CONVEX_URL="${EXPO_PUBLIC_CONVEX_URL:-https://dynamic-pony-636.convex.cloud}"
MODE="${MODE:---tunnel}"
if [ "$MODE" = "--tunnel" ] && ! npm ls -g @expo/ngrok >/dev/null 2>&1; then npm install -g @expo/ngrok@^4.1.0; fi
# --go: open in Expo Go, not a development build (expo-dev-client is installed for Glance's native build).
exec npx expo start --go "$MODE" --clear
