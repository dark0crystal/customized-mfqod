// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;


import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
 
const nextConfig: NextConfig = {
    output: 'standalone', // Enable standalone output for Docker
    experimental: {
        // Disabled: compaction was blocking 15-20s frequently, slowing dev more than helping
        // turbopackFileSystemCacheForDev: true,
        // Cache fetch() in Server Components across HMR to avoid re-fetching on every change
        serverComponentsHmrCache: true,
        // Optimize icon library imports (lucide-react, react-icons) to reduce compile work
        optimizePackageImports: ['lucide-react', 'react-icons'],
    },
    images: {
        // Disable optimization so browser fetches images directly from backend.
        // Fixes 400 errors in Docker where frontend container cannot reach backend via localhost.
        unoptimized: true,
        // Allow fetching from private IPs (127.0.0.1, localhost) only in development.
        // Production uses public hostnames; no private-IP fetch there.
        dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
        // Allow images served from the backend in all common setups:
        // - localhost / 127.0.0.1 on port 8000 (dev)
        // - host.docker.internal when running inside Docker
        // - backend service names on the Docker network
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '8000',
                pathname: '/**',
            },
            {
                protocol: 'http',
                hostname: '127.0.0.1',
                port: '8000',
                pathname: '/**',
            },
            {
                protocol: 'http',
                hostname: 'host.docker.internal',
                pathname: '/**',
            },
            {
                protocol: 'http',
                hostname: 'backend',
                pathname: '/**',
            },
            {
                protocol: 'http',
                hostname: 'mfqod-backend',
                pathname: '/**',
            },
        ],
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
