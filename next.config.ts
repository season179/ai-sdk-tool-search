import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["auto-tools.localhost", "*.auto-tools.localhost"],
  devIndicators: false,
};

export default nextConfig;
