import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	images: {
		remotePatterns: [
			{
				protocol: "http",
				hostname: "localhost",
				port: "8333",
				pathname: "/**/*",
			},
			{
				protocol: "https",
				hostname: "uploads.stamford.dev",
				port: "",
				pathname: "/**/*",
			},
		],
	},
	experimental: {
		nodeMiddleware: true, // Enable Node.js middleware
	},
};

export default nextConfig;
