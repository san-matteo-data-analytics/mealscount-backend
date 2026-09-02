import path from "node:path";
import type { NextConfig } from "next";

// The Python side (server.py) serves the JSON API. In local full-stack dev that is
// the Flask app on :5000; otherwise we proxy to production so the UI works standalone.
const API_ORIGIN = process.env.MEALSCOUNT_API_ORIGIN ?? "http://127.0.0.1:5000";

const nextConfig: NextConfig = {
  // This app lives inside the Python repo, which has its own lockfile; pin the
  // trace root so Next does not walk up and treat the repo root as the project.
  outputFileTracingRoot: path.join(__dirname),

  // The Flask routes end in a slash. Without this Next 308-redirects the slash
  // away, forcing an extra round-trip on every optimize call.
  skipTrailingSlashRedirect: true,

  experimental: {
    // Next's dev proxy for rewrites defaults to a 30s timeout and then kills the
    // socket, which surfaces as "Failed to proxy ... socket hang up (ECONNRESET)"
    // even though Flask is alive and still working. /api/districts/optimize/ runs
    // the strategies synchronously and routinely exceeds 30s once a district has
    // more than ~15 schools, so give it room.
    proxyTimeout: 10 * 60 * 1000,
  },

  async rewrites() {
    return [
      // Flask's routes are declared with a trailing slash. ":path*" does not
      // capture one, so match that form explicitly first -- otherwise Flask
      // 308s to an absolute internal URL and the proxy is bypassed.
      { source: "/api/:path*/", destination: `${API_ORIGIN}/api/:path*/` },
      { source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` },
    ];
  },
};

export default nextConfig;
