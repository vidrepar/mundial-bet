import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* standalone output for slim Docker image on Hetzner */
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
