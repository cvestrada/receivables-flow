import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ethers as hre } from 'hardhat';
import { ethers } from 'ethers';

import {
  ABI,
  RATING_RECORD,
  appointReviewer,
  encodeName,
  givePage,
  openRegistry,
  readRecord,
  writeRecords,
} from '../src/ens';

const BASE_LABEL = process.env.ENS_BASE_LABEL ?? 'receivablesflow';
const BUSINESS_LABEL = process.env.ENS_BUSINESS_LABEL ?? 'ironline';

/** What Ironline Freight has done so far, as three numbers anyone can recompute from. */
const COUNTS = {
  'rf.invoices.financed': '6',
  'rf.invoices.repaid': '6',
  'rf.invoices.defaulted': '0',
};

/**
 * Ask whether an address would be allowed to write a record, without spending anything.
 *
 * The refusals are the point of the demo, and a refusal costs nothing to prove: simulating the
 * call from that address returns the same revert the real transaction would. It also means the
 * business and the reviewer do not need funded accounts just to be turned away.
 */
async function attempt(
  resolver: string,
  from: string,
  name: string,
  key: string,
  value: string,
): Promise<'ok' | 'refused'> {
  const data = new ethers.Interface(ABI.resolver).encodeFunctionData('setText', [
    encodeName(name),
    key,
    value,
  ]);

  try {
    await hre.provider.call({ to: resolver, from, data });
    return 'ok';
  } catch {
    return 'refused';
  }
}

/**
 * A stand-in address that is the same on every run.
 *
 * The reviewer and the business are real parties with their own keys in production. Until
 * those exist, deriving them from a fixed label keeps a re-run byte-identical — a random
 * address would make the script look like it had changed something when it had not.
 */
function placeholder(role: string, platform: string): string {
  return ethers.getAddress(ethers.dataSlice(ethers.id(`${role}:${platform}`), 12));
}

async function main(): Promise<void> {
  const [platform] = await hre.getSigners();
  const platformAddress = await platform.getAddress();
  const reviewer = process.env.REVIEWER_ADDRESS ?? placeholder('reviewer', platformAddress);
  const business = process.env.BUSINESS_ADDRESS ?? placeholder('business', platformAddress);

  console.log(`platform ${platformAddress}`);

  const registry = await openRegistry(platform as never, BASE_LABEL);
  console.log(`registry ${registry.registry} under ${registry.baseName}`);

  const page = await givePage(platform as never, registry, BUSINESS_LABEL);
  console.log(`page     ${page.name} -> ${page.resolver}`);

  await writeRecords(platform as never, page.resolver, page.name, COUNTS);
  await appointReviewer(platform as never, page.resolver, page.name, reviewer);
  console.log(`reviewer ${reviewer} appointed on ${RATING_RECORD}`);

  console.log('\nrecord, read back from chain:');
  for (const key of Object.keys(COUNTS)) {
    console.log(`  ${key.padEnd(22)} ${await readRecord(hre.provider as never, page.resolver, page.name, key)}`);
  }

  console.log('\nwho may write what:');
  const checks: [string, string, string, string][] = [
    ['reviewer writes the rating', reviewer, RATING_RECORD, 'B'],
    ['reviewer writes another field', reviewer, 'description', 'hijacked'],
    ['business writes its own rating', business, RATING_RECORD, 'AAA'],
  ];
  for (const [label, from, key, value] of checks) {
    console.log(`  ${label.padEnd(32)} ${await attempt(page.resolver, from, page.name, key, value)}`);
  }

  const record = {
    network: (await hre.provider.getNetwork()).name,
    baseName: registry.baseName,
    registry: registry.registry,
    business: { name: page.name, resolver: page.resolver },
    reviewer,
    ratingRecord: RATING_RECORD,
  };
  const path = join(__dirname, '..', 'deployed.json');
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`\nwrote ${path}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
