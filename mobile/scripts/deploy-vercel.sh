#!/usr/bin/env bash
# Deploys the Expo web build to Vercel, forwarding /api and /images to the Queue Up server.
# Usage: QUEUEUP_URL=https://your-server.example EXPO_PUBLIC_CONVEX_URL=https://x.convex.cloud scripts/deploy-vercel.sh [--prod]
set -euo pipefail
cd "$(dirname "$0")/.."
: "${QUEUEUP_URL:?Set QUEUEUP_URL to the Queue Up server (https://...)}"
QUEUEUP_URL="${QUEUEUP_URL%/}"
node -e '
  const fs = require("fs"); const v = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  v.rewrites = [
    { source: "/api/:path*", destination: process.env.QUEUEUP_URL + "/api/:path*" },
    { source: "/images/:path*", destination: process.env.QUEUEUP_URL + "/images/:path*" },
  ];
  fs.writeFileSync("vercel.deploy.json", JSON.stringify(v, null, 2));
'
npm ci
npm run build:web
# Ship the built files only; the rewrites point at the Queue Up server.
cp vercel.deploy.json dist/vercel.json
cd dist
npx -y vercel@latest deploy ${1:-} --yes
