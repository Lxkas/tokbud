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
		],
	},
};

export default nextConfig;
