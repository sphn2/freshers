import type { NextConfig } from "next";

const config: NextConfig = {
  allowedDevOrigins: [
    "192.168.*.*",
    "10.*.*.*",
    ...Array.from({ length: 16 }, (_, index) => `172.${index + 16}.*.*`),
  ],
  async rewrites() {
    const backendUrl = (process.env.BACKEND_API_URL || "http://127.0.0.1:5000/api/v1")
      .replace(/\/$/, "");
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/:path*` }];
  },
};

export default config;
