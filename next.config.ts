import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Canteen item photos are resized in the browser before upload, but leave headroom in case
  // a phone photo can't be resized (the canteen bucket itself caps files at 3 MB).
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
