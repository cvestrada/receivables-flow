import { ethers as hre } from 'hardhat';

import { readPass } from '../src/ens';
import deployed from '../deployed.json';

/** Print what the registry says about every party — the same answer HQ renders. */
async function main(): Promise<void> {
  const record = deployed as {
    businesses?: { baseName: string; registry: string };
    investors?: { baseName: string; registry: string };
  };

  for (const [side, ref, label] of [
    ['company', record.businesses, 'ironline'],
    ['fund', record.investors, 'woodgrove'],
  ] as const) {
    if (!ref) continue;
    const answer = await readPass(hre.provider as never, ref, label);
    console.log(
      `${side.padEnd(8)} ${answer.name.padEnd(40)} ${answer.cleared ? 'approved' : 'not approved'}  ${answer.wallet || '—'}`,
    );
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
