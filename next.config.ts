import type { NextConfig } from "next";

// HTTP security headers (OWASP recommended baseline).
// CSP is intentionally not set here yet: inline styles/scripts from Next +
// Supabase websockets need a carefully built policy — see docs/SECURITY.md.
const securityHeaders = [
	// Clickjacking: this app has no legitimate embedding use case.
	{ key: "X-Frame-Options", value: "DENY" },
	// Stop MIME-sniffing uploaded files into executable content.
	{ key: "X-Content-Type-Options", value: "nosniff" },
	// Don't leak full URLs (which can contain ids) cross-origin.
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	// This app never needs these powerful APIs from third parties.
	{ key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=()" },
	// HSTS: force HTTPS for a year once seen (Vercel serves HTTPS-only anyway).
	{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
	turbopack: {
		root: process.cwd(),
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.supabase.co",
				pathname: "/storage/v1/object/public/**",
			},
		],
	},
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
