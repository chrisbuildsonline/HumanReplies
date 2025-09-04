/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  assetPrefix: process.env.NODE_ENV === 'production' ? '/dashboard' : '',
  basePath: process.env.NODE_ENV === 'production' ? '/dashboard' : '',
  experimental: {
    appDir: true
  }
}

module.exports = nextConfig