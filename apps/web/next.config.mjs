/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Monorepo-ish workspace: avoid Next picking the wrong root.
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  experimental: {
    // Keeps server components defaults; we'll use client components where needed.
  }
};

export default nextConfig;

