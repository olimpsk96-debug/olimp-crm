import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/method/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru"}/api/method/:path*`,
      },
      {
        source: "/api/resource/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://erp.olimp-ural.ru"}/api/resource/:path*`,
      },
    ];
  },
};

export default nextConfig;
