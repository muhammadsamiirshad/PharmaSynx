/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '5000',
                pathname: '/**',
            },
        ],
    },
    typescript: {
        ignoreBuildErrors: false,
    },
    reactStrictMode: true,
    experimental: {
        appDir: true,
    }
};

module.exports = nextConfig;