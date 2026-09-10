import type { NextConfig } from 'next';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

/*
 * HQ signs with the same Sepolia account the contracts package registers names from, and that
 * key lives at the repository root. Next only looks beside the app itself, so it is loaded here
 * rather than copied into a second file. `.env.local` is read first so a machine's own values
 * win over the shared file, which is what that name means everywhere else.
 */
for (const file of ['.env.local', '.env']) {
  loadEnv({ path: join(process.cwd(), '..', '..', file) });
}

const nextConfig: NextConfig = {
  /*
   * The shared vocabulary and the ENS package are published as TypeScript source rather than
   * compiled output, so Next has to be told to compile them.
   */
  transpilePackages: ['@rf/shared', '@rf/contracts-ens'],
};

export default nextConfig;
