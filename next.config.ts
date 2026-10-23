import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: process.cwd(),
  // Media and local runtimes are private worker data, never deployable web assets.
  outputFileTracingExcludes: { "/*": ["./.private/**/*", "./worker/**/*", "./.worker-build/**/*"] },
};

export default nextConfig;
