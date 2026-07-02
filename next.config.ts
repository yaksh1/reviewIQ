import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server output for a lean Docker image (single-box deploy).
  output: "standalone",
  // These have native bindings / spawn external processes — keep them out of
  // the bundled server output so they load from node_modules at runtime.
  serverExternalPackages: ["better-sqlite3", "playwright", "playwright-core"],
};

export default nextConfig;
