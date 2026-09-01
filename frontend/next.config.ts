import path from "node:path";
import type { NextConfig } from "next";

// The Python side (server.py) serves the JSON API. In local full-stack dev that is
// the Flask app on :5000; otherwise we proxy to production so the UI works standalone.
const API_ORIGIN = process.env.MEALSCOUNT_API_ORIGIN ?? "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  // This app lives inside the Python repo, which has its own lockfile; pin the
  // trace root so Next does not walk up and treat the repo root as the project.
  outputFileTracingRoot: path.join(__dirname),

  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
};

export default nextConfig;
