import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ethers, network } from 'hardhat';
import { ATS_ROLES } from '@hashgraph/asset-tokenization-contracts/scripts';
import { INVOICE } from '@rf/shared/invoice';
import {
  grantIssuerRole,
  hasRole,
  isApprovedHolder,
  issueReceivableToken,
  readTerms,
  revokeIssuerRole,
  type Invoice,
} from '../src/receivable-token';

/*
 * The ATS deployment the ATS web app itself points at on Hedera testnet, verified
 * live via the mirror node. Overridden per network through .env, so a token can be
 * issued against our own deployment without touching this file.
 */
const DEFAULT_FACTORY = '0xd1F118A40f3b02883D35909eF2517e7EDd78379d';
const DEFAULT_RESOLVER = '0xBA2D5FC2083A0b8f164c50e65d782087fBA18E0a';

/** The invoice's own terms, in the shape the factory wants them. */
const NOTE: Invoice = {
  reference: INVOICE.reference,
  code: INVOICE.noteTicker,
  name: INVOICE.noteName,
  faceValueUsd: INVOICE.faceValueUsd,
  maturityDays: INVOICE.maturityDays,
};

/**
 * Ironline Freight's shared account, as provisioning left it.
 *
 * Provisioning writes this file against a live Privy app, so it is absent until
 * that has been run. The absence stops the run rather than skipping the role
 * grant: a note whose issuer is still a key on this laptop looks identical on
 * screen to one only two directors can issue.
 */
function ironlineAccount(): string {
  const override = process.env.HEDERA_IRONLINE_WALLET_ADDRESS;
  if (override) return override;

  for (let dir = __dirname; ; dir = dirname(dir)) {
    const candidate = join(dir, 'libs', 'privy', 'accounts.json');
    if (existsSync(candidate)) {
      const accounts = JSON.parse(readFileSync(candidate, 'utf8')) as {
        company?: { address?: string };
      };
      const address = accounts.company?.address;
      if (!address) throw new Error(`No company account in ${candidate} — run npm run provision -w @rf/privy`);
      return address;
    }
    if (dirname(dir) === dir) {
      throw new Error(
        'libs/privy/accounts.json not found — run npm run provision -w @rf/privy so Ironline Freight has an account to issue to',
      );
    }
  }
}

/**
 * Issues the invoice as a note and hands the right to issue it to Ironline Freight.
 *
 * The issued address is recorded in deployed.json because every downstream run
 * needs it, and re-issuing to find it out again would produce a different note.
 */
async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();

  if (!operator) {
    throw new Error('No account configured — set the private key in .env');
  }

  const ats = {
    factory: process.env.HEDERA_ATS_FACTORY_ADDRESS ?? DEFAULT_FACTORY,
    resolver: process.env.HEDERA_ATS_RESOLVER_ADDRESS ?? DEFAULT_RESOLVER,
  };

  /*
   * Step 1 of the Core Logic diagram — create the note from the invoice record,
   * with Ironline Freight allowed to hold it from the moment it exists. Whitelist
   * mode is fixed at creation, so an address left off here can never receive it.
   */
  const ironline = ironlineAccount();
  const token = await issueReceivableToken(operator, ats, NOTE, [operator.address, ironline]);
  const terms = await readTerms(operator, token);

  /*
   * Step 2 — move the right to issue from this laptop's key to the account the
   * directors approve through, then take it away from the key. Until the second
   * call lands there are two accounts that can issue the note, and only one of
   * them needs two people to agree.
   */
  await grantIssuerRole(operator, token, ironline);
  await revokeIssuerRole(operator, token, operator.address);

  const issuer = await hasRole(operator, token, ATS_ROLES.ROLE_ISSUER, ironline);
  const holder = await isApprovedHolder(operator, token, ironline);
  const operatorStillIssuer = await hasRole(operator, token, ATS_ROLES.ROLE_ISSUER, operator.address);

  console.log(`network  ${network.name}`);
  console.log(`token    ${token}`);
  console.log(`note     ${NOTE.name} (${NOTE.code})`);
  console.log(`face     $${terms.faceValueUsd.toLocaleString('en-US')}`);
  console.log(`matures  ${new Date(terms.maturityDate * 1000).toISOString()}`);
  console.log(`holder   ${ironline} ${holder ? 'approved' : 'NOT APPROVED'}`);
  console.log(`issuer   ${ironline} ${issuer ? 'granted' : 'NOT GRANTED'}`);
  console.log(`operator ${operator.address} ${operatorStillIssuer ? 'STILL ISSUER' : 'no longer issuer'}`);

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
    issuer: ironline,
  };
  writeFileSync(path, `${JSON.stringify(existing, null, 2)}\n`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
