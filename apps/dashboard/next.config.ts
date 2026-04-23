import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Allow importing runtime sources via tsconfig paths (../../packages/*)
    root: path.resolve(__dirname, "../.."),
  },
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
