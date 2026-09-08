import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ethers, network } from 'hardhat';
import { issueReceivableToken, readTerms, type Invoice } from '../src/receivable-token';

/*
 * The ATS deployment the ATS web app itself points at on Hedera testnet, verified
 * live via the mirror node. Overridden per network through .env, so a token can be
 * issued against our own deployment without touching this file.
 */
const DEFAULT_FACTORY = '0xd1F118A40f3b02883D35909eF2517e7EDd78379d';
const DEFAULT_RESOLVER = '0xBA2D5FC2083A0b8f164c50e65d782087fBA18E0a';

const DEMO_INVOICE: Invoice = {
  reference: 'Acme Invoice #1042',
  code: 'RF1042',
  faceValueUsd: 50_000,
  maturityDays: 60,
};

/**
 * Issues the demo invoice as a security on the selected network.
 *
 * The issued address is recorded in deployed.json because every downstream issue
 * needs it, and re-issuing to find it out again would produce a different token.
 */
async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();

  if (!operator) {
    throw new Error('No account configured — set the private key in .env');
  }

  const ats = {
    factory: process.env.ATS_FACTORY_ID ?? DEFAULT_FACTORY,
    resolver: process.env.ATS_RESOLVER_ID ?? DEFAULT_RESOLVER,
  };

  const token = await issueReceivableToken(operator, ats, DEMO_INVOICE, [operator.address]);
  const terms = await readTerms(operator, token);

  console.log(`network  ${network.name}`);
  console.log(`token    ${token}`);
  console.log(`face     $${terms.faceValueUsd.toLocaleString('en-US')}`);
  console.log(`matures  ${new Date(terms.maturityDate * 1000).toISOString()}`);

  const path = join(__dirname, '..', 'deployed.json');
  const existing: Record<string, Record<string, unknown>> = JSON.parse(readFileSync(path, 'utf8'));

  /*
   * Merged, not replaced. The settlement contract is deployed by its own script and recorded
   * under the same network key, and reissuing the token must not wipe its address.
   */
  existing[network.name] = {
    ...existing[network.name],
    receivableToken: token,
    factory: ats.factory,
    resolver: ats.resolver,
    faceValueUsd: terms.faceValueUsd,
    maturityDate: terms.maturityDate,
  };
  writeFileSync(path, `${JSON.stringify(existing, null, 2)}\n`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
