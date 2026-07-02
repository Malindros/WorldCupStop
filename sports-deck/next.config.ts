import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig & { turbopack?: { root?: string } } = {
  /* config options here */
  reactCompiler: true,
  // Ensure Turbopack uses the project folder as the workspace root (absolute)
  turbopack: { root: path.resolve(__dirname) },
  images: {
    localPatterns: [
      { pathname: "/**" },
    ],
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh4.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh5.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh6.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
