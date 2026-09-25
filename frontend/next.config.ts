import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.e2b.app", "*.e2b.dev"],
  async rewrites() {
    const backend = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";
    return [
      { source: "/health", destination: `${backend}/health` },
    ];
  },
};

export default nextConfig;
