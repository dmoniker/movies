import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: '/movies',
  assetPrefix: '/movies',
  // Critical for GitHub Pages + static export with basePath
  // Ensures all _next/static/* assets are prefixed correctly
};

export default nextConfig;
