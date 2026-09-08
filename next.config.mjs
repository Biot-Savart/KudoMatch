/** @type {import('next').NextConfig} */
const nextConfig = {
	images: {
		remotePatterns: [
			{ protocol: 'https', hostname: 'media.api-sports.io' },
			{ protocol: 'https', hostname: 'media.api-football.com' },
			{ protocol: 'https', hostname: 'api.dicebear.com' },
			{ protocol: 'https', hostname: 'img.sofascore.com' },
		],
	},
};

export default nextConfig;
