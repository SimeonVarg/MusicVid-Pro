/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * The heavy static assets never change without changing their path, so let the
   * browser keep them forever. This is the difference between a phone paying for
   * the 31 MB FFmpeg core on every visit and paying once — Next.js's default for
   * files in public/ is `public, max-age=0, must-revalidate`.
   *
   * NOT here on purpose: Cross-Origin-Opener/Embedder-Policy. They would enable
   * SharedArrayBuffer and the multi-threaded FFmpeg core, but that core
   * DEADLOCKS on this app's filter graph — measured Sept 5 2026, zero frames
   * after 70s on a job the single-threaded core finishes in 19s, both with
   * mounted (WORKERFS) and copied (MEMFS) inputs. Hanging forever is worse than
   * slow, so the single-threaded core stays. See STATUS.md Round 16.
   */
  async headers() {
    return [
      {
        source: '/ffmpeg/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/samples/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/fonts/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

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