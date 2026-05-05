import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    // Allow importing runtime sources via tsconfig paths (../../packages/*)
    root: path.resolve(__dirname, "../.."),
  },
  webpack: (config, { isServer, webpack }) => {
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
    // `ws` optional native `bufferutil` breaks when bundled (bufferUtil.mask is not a function)
    // and crashes the gateway on gateway-rpc WebSocket send. Bake flags into server chunks so
    // `ws/lib/buffer-util.js` skips native require even before any shim import runs.
    if (isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          "process.env.WS_NO_BUFFER_UTIL": JSON.stringify("1"),
          "process.env.WS_NO_UTF_8_VALIDATE": JSON.stringify("1"),
        }),
      );
    }
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
