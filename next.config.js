/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Include chromium binaries in the deployment bundle
    outputFileTracingIncludes: {
      '/api/generate-pdf': ['./node_modules/@sparticuz/chromium/**/*'],
      '/api/**': ['./node_modules/@sparticuz/chromium/**/*']
    },
    // External packages that should not be bundled
    serverComponentsExternalPackages: ['@sparticuz/chromium']
  },

  // Webpack configuration for proper module resolution
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude chromium from client-side bundle
      config.externals = config.externals || [];
      config.externals.push('@sparticuz/chromium');
    }
    return config;
  }
};

module.exports = nextConfig;
