import type { NextConfig } from 'next';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

/*
 * Every credential lives in the one file at the repository root, and Next only looks beside the
 * app itself. `.env.local` is read first so a machine's own values win over the shared file,
 * which is what that name means everywhere else.
 */
for (const file of ['.env.local', '.env']) {
  loadEnv({ path: join(process.cwd(), '..', '..', file) });
}

const nextConfig: NextConfig = {
  /*
   * The shared vocabulary is published as TypeScript source rather than compiled
   * output, so Next has to be told to compile it. Without this the app builds
   * cleanly until the first import and then fails on unparsed syntax.
   */
  transpilePackages: ['@rf/shared', '@rf/privy', '@rf/contracts-ens', '@rf/contracts-hedera-ats'],
};

export default nextConfig;
