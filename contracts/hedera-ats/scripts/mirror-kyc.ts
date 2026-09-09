import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JsonRpcProvider } from 'ethers';
import { ethers, network } from 'hardhat';
import { readPass, type RegistryRef } from '@rf/contracts-ens';
import ens from '@rf/contracts-ens/deployed.json';
import { approvalOf, deployEnsKycList, publishKyc, withdrawKyc } from '../src/ens-kyc-list';

/** One party whose KYC lives on Sepolia and has to be enforceable on Hedera. */
interface Party {
  label: string;
  registry: RegistryRef;
  /**
   * The wallet the party was onboarded with.
   *
   * Needed because a withdrawn record answers with no wallet at all, and the wallet is how this
   * list is indexed — without it a rejection would have nothing to write against and would
   * quietly leave the party still tradeable on Hedera.
   */
  wallet: string;
}

const hashscan = (hash: string) => `https://hashscan.io/testnet/transaction/${hash}`;

/**
 * Carries what the ENS names on Sepolia say about KYC over to the list the token consults.
 *
 * This is the only place the two chains meet, and the only check that can catch them
 * disagreeing. The local suite publishes whatever expiry it invented and then reads it back, so
 * it can never fail that way; here the expiry comes off a name Receivables Flow does not control
 * the clock of, and the run fails if what lands on Hedera is not that same number.
 *
 * Publishing is the whole job for a party still approved. A party whose record is empty, or whose
 * name has already lapsed, is withdrawn instead — a mirror that only ever adds would leave a
 * rejected party tradeable on Hedera long after Sepolia said otherwise.
 */
async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();
  if (!operator) throw new Error('No account configured — set the private key in .env');

  const sepoliaUrl = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
  const sepolia = new JsonRpcProvider(sepoliaUrl);

  const parties: Party[] = [
    { label: labelOf(ens.business.name), registry: ens.businesses, wallet: ens.business.wallet },
    { label: labelOf(ens.investor.name), registry: ens.investors, wallet: ens.investor.wallet },
  ];

  /*
   * The list outlives any one run, because a token already issued against it cannot be pointed
   * at a new one. A run after the first reuses the recorded address rather than deploying.
   */
  const path = join(__dirname, '..', 'deployed.json');
  const deployed: Record<string, Record<string, unknown>> = JSON.parse(readFileSync(path, 'utf8'));
  const recorded = deployed[network.name]?.ensKycList as string | undefined;
  const list = recorded ?? (await deployEnsKycList(operator));

  console.log(`network   ${network.name}`);
  console.log(`sepolia   ${sepoliaUrl}`);
  console.log(`list      ${list}${recorded ? '' : '  (deployed by this run)'}`);

  for (const party of parties) {
    const pass = await readPass(sepolia, party.registry, party.label);
    const approved = pass.wallet !== '' && pass.cleared;
    const wallet = pass.wallet === '' ? party.wallet : pass.wallet;

    const hash = approved
      ? await publishKyc(operator, list, wallet, pass.expiresAt, pass.name)
      : await withdrawKyc(operator, list, wallet);

    /*
     * Read the answer back off Hedera rather than trusting the transaction receipt. A publish
     * that lands with the wrong number still succeeds, and that is exactly the failure this
     * script exists to catch.
     */
    const onHedera = await approvalOf(operator, list, wallet);
    const expected = approved ? pass.expiresAt : 0n;
    if (onHedera.expiresAt !== expected) {
      throw new Error(
        `${pass.name}: Sepolia says ${expected}, Hedera says ${onHedera.expiresAt} — the two chains disagree`,
      );
    }

    console.log(`\n${pass.name}`);
    console.log(`  wallet    ${wallet}`);
    console.log(`  expires   ${expected === 0n ? 'not approved' : new Date(Number(expected) * 1000).toISOString()}`);
    console.log(`  status    ${approved ? 'KYC approved on both chains' : 'KYC rejected on both chains'}`);
    console.log(`  ${hashscan(hash)}`);
  }

  deployed[network.name] = { ...deployed[network.name], ensKycList: list };
  writeFileSync(path, `${JSON.stringify(deployed, null, 2)}\n`);
}

/** The first label of a full name — `ironline.business.receivablesflow.eth` is registered as `ironline`. */
function labelOf(name: string): string {
  return name.split('.')[0];
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
