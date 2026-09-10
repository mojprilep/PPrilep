import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.119", "localhost"],
  // The ЗборЧе dictionary route reads its per-length wordlists from disk at
  // runtime (they're too big to import as JSON without exploding tsc). The path
  // is computed from ?len, so tracing can't see it — include the folder here so
  // the files ship in the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/api/zborche/validate": ["./lib/zborche/words/**/*"],
  },
  // Pretty, search-friendly URL for the live bus map. /prevoz transparently
  // serves the transport utility page (URL stays /prevoz). The page sets its
  // canonical to /prevoz so the old /utility/transport path isn't indexed twice.
  async rewrites() {
    return [{ source: "/prevoz", destination: "/utility/transport" }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "cdn.mojprilep.mk",
      },
      {
        // ImageKit web-proxy in front of Supabase Storage (see lib/utils.ts
        // cdnUrl). Without this, next/image's optimizer 400s any ImageKit URL,
        // breaking every image that renders through <Image> instead of a raw
        // <img> (e.g. the issue detail hero).
        protocol: "https",
        hostname: "ik.imagekit.io",
      },
      {
        protocol: "https",
        hostname: "mojprilep.mk",
      },
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
    // Serve modern formats with smaller payloads
    formats: ["image/avif", "image/webp"],
    // Common breakpoints — Next picks the smallest needed for the device
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 64, 96, 128, 160, 256, 384],
    // Cache optimized images for 30 days
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Next 16 only serves qualities listed here (default is [75] alone) — any
    // other `quality` prop is rejected by the optimizer. 50 = feed thumbnails,
    // 80 = an image the user deliberately opened. See lib/imageQuality.ts.
    qualities: [50, 75, 80],
  },
};

export default nextConfig;
