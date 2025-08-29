/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Extend API timeouts for video generation
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Configure timeouts for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Connection',
            value: 'keep-alive',
          },
          {
            key: 'Keep-Alive',
            value: 'timeout=300, max=1000',
          },
        ],
      },
    ];
  },
};

export default config;
