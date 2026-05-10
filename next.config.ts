import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	serverExternalPackages: ['bun:sqlite'],
	output: "standalone"
};

export default nextConfig;
