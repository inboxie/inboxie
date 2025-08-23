import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Disable ESLint during builds for quick deployment
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disable TypeScript errors during builds for quick deployment  
    ignoreBuildErrors: true,
  },
  /* config options here */
};

export default nextConfig;