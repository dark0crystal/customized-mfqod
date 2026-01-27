// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;


import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
 
const nextConfig: NextConfig = {
    output: 'standalone', // Enable standalone output for Docker
    images: {
        // Allow images served from the backend in all common setups:
        // - localhost / 127.0.0.1 on any port (e.g. 8000)
        // - host.docker.internal when running inside Docker
        // - backend service names on the Docker network
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
            },
            {
                protocol: 'http',
                hostname: '127.0.0.1',
            },
            {
                protocol: 'http',
                hostname: 'host.docker.internal',
            },
            {
                protocol: 'http',
                hostname: 'backend',
            },
            {
                protocol: 'http',
                hostname: 'mfqod-backend',
            },
        ],
    },
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: false,
    },
    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        // ignoreBuildErrors: true,
    },
};
 
const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
