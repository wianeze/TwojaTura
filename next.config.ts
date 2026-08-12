import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cf.geekdo-images.com" },
      { protocol: "https", hostname: "cf.geekdo-static.com" },
    ],
  },
};

export default nextConfig;
