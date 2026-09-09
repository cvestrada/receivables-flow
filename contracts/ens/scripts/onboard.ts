import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ethers as hre } from 'hardhat';
import { ethers } from 'ethers';

import {
  ABI,
  clearRetiredRecord,
  encodeName,
  givePage,
  issuePass,
  openBranch,
  openRegistry,
  retireName,
  readPass,
  readRecord,
  readScore,
  writeRecords,
} from '../src/ens';

const BASE_LABEL = process.env.ENS_BASE_LABEL ?? 'receivablesflow';
const BUSINESS_LABEL = process.env.ENS_BUSINESS_LABEL ?? 'ironline';

/*
 * The two sides of the market, each a registry of its own between the platform's name and the
 * companies on it. `woodgrove.investor.receivablesflow.eth` says which side it is before a
 * single record is read; two names on one flat level cannot.
 */
const BUSINESS_BRANCH = 'business';
const INVESTOR_BRANCH = 'investor';
const INVESTOR_LABEL = process.env.ENS_INVESTOR_LABEL ?? 'woodgrove';

/**
 * How long Woodgrove's clearance lasts.
 *
 * A quarter is the interval a fund's accreditation is actually reviewed on, and short enough
 * that the lapse is a real event during the project rather than a hypothetical one.
 */
const PASS_SECONDS = 90 * 24 * 60 * 60;

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
 * business does not need a funded account just to be turned away.
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
 * The business and the fund are real parties with their own keys in production. Until those
 * exist, deriving them from a fixed label keeps a re-run byte-identical — a random address
 * would make the script look like it had changed something when it had not.
 */
function placeholder(role: string, platform: string): string {
  return ethers.getAddress(ethers.dataSlice(ethers.id(`${role}:${platform}`), 12));
}

async function main(): Promise<void> {
  const [platform] = await hre.getSigners();
  const platformAddress = await platform.getAddress();
  const business = process.env.BUSINESS_ADDRESS ?? placeholder('business', platformAddress);
  const investor = process.env.INVESTOR_ADDRESS ?? placeholder('investor', platformAddress);

  console.log(`platform ${platformAddress}`);

  const registry = await openRegistry(platform as never, BASE_LABEL);
  console.log(`registry ${registry.registry} under ${registry.baseName}`);

  // Names issued before the market had two sides would otherwise sit beside the new ones and
  // read as a second, contradictory record for the same company.
  for (const stale of [BUSINESS_LABEL, INVESTOR_LABEL]) {
    const hash = await retireName(platform as never, registry, stale);
    if (hash) console.log(`retired  ${stale}.${registry.baseName} in ${hash}`);
  }

  const businesses = await openBranch(platform as never, registry, BUSINESS_BRANCH);
  const investors = await openBranch(platform as never, registry, INVESTOR_BRANCH);
  console.log(`branch   ${businesses.baseName} -> ${businesses.registry}`);
  console.log(`branch   ${investors.baseName} -> ${investors.registry}`);

  const page = await givePage(platform as never, businesses, BUSINESS_LABEL);
  console.log(`page     ${page.name} -> ${page.resolver}`);

  // The company is approved at onboarding the same way the fund is, so HQ has one kind of row
  // to flip rather than two.
  const companyPass = await issuePass(platform as never, businesses, BUSINESS_LABEL, business, PASS_SECONDS);
  console.log(`approved ${page.name} for ${business}`);

  // Names issued before the record was renamed still carry the old key beside the new one.
  const stale = await clearRetiredRecord(platform as never, page.resolver, page.name);
  if (stale) console.log(`cleared  the old record on ${page.name} in ${stale}`);

  await writeRecords(platform as never, page.resolver, page.name, COUNTS);

  console.log('\nrecord, read back from chain:');
  for (const key of Object.keys(COUNTS)) {
    console.log(`  ${key.padEnd(22)} ${await readRecord(hre.provider as never, page.resolver, page.name, key)}`);
  }

  // Derived here from the counts above, not fetched. Nobody wrote this number down, and the
  // line that produces it is the whole of the formula.
  const score = await readScore(hre.provider as never, businesses, BUSINESS_LABEL);
  console.log(`  credit score           ${score ?? 'unrated'} of 100`);

  console.log('\nwho may write what:');
  const checks: [string, string, string, string][] = [
    ['business writes its own count', business, 'rf.invoices.repaid', '99'],
    ['business writes another field', business, 'description', 'hijacked'],
  ];
  for (const [label, from, key, value] of checks) {
    console.log(`  ${label.padEnd(32)} ${await attempt(page.resolver, from, page.name, key, value)}`);
  }

  const pass = await issuePass(platform as never, investors, INVESTOR_LABEL, investor, PASS_SECONDS);
  console.log(`\npass     ${pass.name} -> ${pass.resolver}`);

  const staleFund = await clearRetiredRecord(platform as never, pass.resolver, pass.name);
  if (staleFund) console.log(`cleared  the old record on ${pass.name} in ${staleFund}`);

  const standing = await readPass(hre.provider as never, investors, INVESTOR_LABEL);
  console.log('\napproval pass, read back from chain:');
  console.log(`  wallet                 ${standing.wallet}`);
  console.log(`  expires                ${new Date(Number(standing.expiresAt) * 1000).toISOString()}`);

  // The same read, asked at two moments. Nothing is written between them — the pass lapses
  // because the date passed, which is the whole reason it is a date and not a flag.
  const lapsed = await readPass(hre.provider as never, investors, INVESTOR_LABEL, standing.expiresAt + 1n);
  console.log('\nmay Woodgrove hold a receivable:');
  console.log(`  today                  ${standing.cleared ? 'cleared' : 'lapsed'}`);
  console.log(`  once the pass expires  ${lapsed.cleared ? 'cleared' : 'lapsed'}`);

  const record = {
    network: (await hre.provider.getNetwork()).name,
    baseName: registry.baseName,
    registry: registry.registry,
    businesses,
    investors,
    business: { name: page.name, resolver: page.resolver, wallet: companyPass.wallet },
    investor: {
      name: pass.name,
      resolver: pass.resolver,
      wallet: pass.wallet,
      expiresAt: pass.expiresAt.toString(),
    },
  };
  const path = join(__dirname, '..', 'deployed.json');
  writeFileSync(path, `${JSON.stringify(record, null, 2)}\n`);
  console.log(`\nwrote ${path}`);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
