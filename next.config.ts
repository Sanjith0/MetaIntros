import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-tools bubble sits on top of the bottom tab bar (and would show in the live demo).
  devIndicators: false,
  // Hackathon prototype: never indexed (DESIGN.md §1.9).
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default nextConfig;
