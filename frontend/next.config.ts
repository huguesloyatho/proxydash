import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.jsdelivr.net',
        pathname: '/gh/walkxcode/dashboard-icons/**',
      },
    ],
  },
  devIndicators: false,
};

export default nextConfig;
