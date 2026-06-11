import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["ai-sdk-app.localhost", "*.ai-sdk-app.localhost"],
  devIndicators: false,
};

export default nextConfig;
