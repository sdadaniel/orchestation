import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Allow importing runtime sources via tsconfig paths (../../packages/*)
    root: path.resolve(__dirname, "../.."),
  },
  webpack: (config) => {
    // `.orchestration/**` is written continuously by the engine/gateway.
    // Ignore it for webpack's dev watcher to avoid rebuild thrash when running `next dev`/embedded dev.
    config.watchOptions = {
      ...(typeof config.watchOptions === "object" && config.watchOptions
        ? config.watchOptions
        : {}),
      ignored: [
        "**/.orchestration/**",
        "**/node_modules/**",
      ],
    };
    return config;
  },
  // Allow accessing dev-only resources (e.g. /_next/webpack-hmr) from 127.0.0.1.
  // Next blocks non-allowed origins in development by default.
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
