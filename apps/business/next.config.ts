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
   * Where the build lands, overridable.
   *
   * The e2e suite serves this app twice: once with the Privy app id cleared, which is the
   * portal a judge can open without an account, and once with it left in, which is the one the
   * sign-in test drives. Two builds of the same app share one `.next` unless told otherwise —
   * whichever finished last served both ports, and the gate appeared in front of every test
   * that expected a dashboard.
   */
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  /*
   * The shared vocabulary is published as TypeScript source rather than compiled
   * output, so Next has to be told to compile it. Without this the app builds
   * cleanly until the first import and then fails on unparsed syntax.
   */
  transpilePackages: ['@rf/shared', '@rf/privy', '@rf/contracts-ens', '@rf/contracts-hedera-ats'],
};

export default nextConfig;
