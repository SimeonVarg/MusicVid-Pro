/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Webpack config for audio/video processing
  webpack: (config, { isServer }) => {
    // Handle audio worklets and wasm files
    config.module.rules.push({
      test: /\.(wasm|worklet)$/,
      type: 'asset/resource',
    });

    // Ignore node-specific modules in client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Prevent konva server bundle from trying to resolve optional node-canvas.
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };

    return config;
  },
};

export default nextConfig;