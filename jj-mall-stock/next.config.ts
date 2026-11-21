import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "swr"],
  },
  async rewrites() {
    return [
      {
        source: "/uploads/products/:filename",
        destination: "/api/uploads/products/:filename",
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
