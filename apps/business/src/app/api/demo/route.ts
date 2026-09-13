import { JsonRpcProvider, Network, Wallet } from 'ethers';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { ONBOARD_COUNTS, countRecords, writeRecords } from '@rf/contracts-ens';
import deployed from '@rf/contracts-ens/deployed.json';
import { redeemAll } from '@rf/privy/demo';
import { forgetSubmission } from '@/lib/submission';
import { unlinkSync } from 'node:fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Put the demo back to the moment it starts.
 *
 * Four things drift between runs. Three are ours and one is the chain's:
 *
 *   - the invoice's own state, the approvals, and the day-60 record — three files, forgotten;
 *   - Ironline's counts on ENS, rewritten to what onboarding gave it (one Sepolia transaction);
 *   - the receivable's units, redeemed from whoever holds them so it can be issued again — the
 *     security is capped at its face value and would otherwise refuse the next mint.
 *
 * Refreshing the page resets none of these; that was the question, and the answer is this
 * button. The ENS write and the redemptions are real transactions and take about a minute.
 */
const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';
const SEPOLIA = new Network('sepolia', 11_155_111);

function forget(path: string) {
  try {
    unlinkSync(path);
  } catch {
    /* already forgotten */
  }
}

/** The investor portal calls this from its own origin; a demo has no secrets to protect here. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST() {
  const report: Record<string, unknown> = {};

  forgetSubmission();
  forget(join(process.env.DEMO_STATE_DIR ?? '.', '.approvals.json'));
  forget(join(process.env.DEMO_STATE_DIR ?? '.', '.repayment.json'));
  report.local = 'invoice, approvals and repayment forgotten';

  const { business } = deployed as { business?: { name: string; resolver: string } };
  const key = process.env.SEPOLIA_PLATFORM_WALLET_PRIVATE_KEY;
  if (business && key) {
    const provider = new JsonRpcProvider(RPC_URL, SEPOLIA, { staticNetwork: true });
    try {
      await writeRecords(new Wallet(key, provider) as never, business.resolver, business.name, countRecords(ONBOARD_COUNTS));
      report.ens = { ...ONBOARD_COUNTS, name: business.name };
    } catch (error) {
      report.ens = { failed: error instanceof Error ? error.message : String(error) };
    } finally {
      provider.destroy();
    }
  } else {
    report.ens = 'skipped — no platform key';
  }

  try {
    report.hedera = await redeemAll();
  } catch (error) {
    report.hedera = { failed: error instanceof Error ? error.message : String(error) };
  }

  return NextResponse.json(report, { headers: CORS });
}
