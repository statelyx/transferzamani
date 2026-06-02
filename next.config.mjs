/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.sofascore.com"
      }
    ]
  }
};

export default nextConfig;
