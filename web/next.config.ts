import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WASM and data files from node_modules at runtime.
  serverExternalPackages: ["@electric-sql/pglite"],
  // NEXT_DIST_DIR lets a test server run beside your own `npm run dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Documents are uploaded through a server action (10 MB files, F-DOC-1).
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
