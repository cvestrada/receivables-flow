import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /*
   * The shared vocabulary is published as TypeScript source rather than compiled
   * output, so Next has to be told to compile it. Without this the app builds
   * cleanly until the first import and then fails on unparsed syntax.
   */
  transpilePackages: ['@rf/shared', '@rf/privy'],
};

export default nextConfig;
