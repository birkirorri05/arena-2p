import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Socket.io server runs separately on port 3001; proxy WS upgrades in dev
  async rewrites() {
    return [
      {
        source: "/socket.io/:path*",
        destination: "http://localhost:3001/socket.io/:path*",
      },
    ];
  },
};

export default nextConfig;
