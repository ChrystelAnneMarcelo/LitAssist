/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

export default {
  reactStrictMode: true,
  async rewrites() {
    if (isDev) {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:8000/:path*',
        },
      ];
    }
    return [];
  },
};
