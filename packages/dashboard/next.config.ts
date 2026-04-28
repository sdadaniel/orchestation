import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Allow importing runtime sources via tsconfig paths (../../packages/*)
    root: path.resolve(__dirname, "../.."),
  },
  // Allow accessing dev-only resources (e.g. /_next/webpack-hmr) from 127.0.0.1.
  // Next blocks non-allowed origins in development by default.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
