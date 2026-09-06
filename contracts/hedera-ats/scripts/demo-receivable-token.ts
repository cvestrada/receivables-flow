import { ethers } from 'hardhat';
import { deploySystemWithNewBlr } from '@hashgraph/asset-tokenization-contracts/scripts';
import {
  IAccessControl__factory,
  IBalanceTracker__factory,
  ICommonErrors__factory,
  ICore__factory,
  ITransfer__factory,
} from '@hashgraph/asset-tokenization-contracts';
import {
  approveHolder,
  isApprovedHolder,
  issueReceivableToken,
  mintTo,
  readTerms,
  revokeHolder,
} from '../src/receivable-token';

const line = (label: string, value: string) => console.log(`  ${label.padEnd(22)}${value}`);
const step = (n: string, title: string) => console.log(`\n${'─'.repeat(64)}\n${n}  ${title}\n${'─'.repeat(64)}`);

/*
 * ATS reverts with custom errors, which ethers cannot name unless the error is
 * declared on the interface the call went through. Decoding against the two
 * interfaces that own these errors turns "unrecognized" into the actual rule.
 */
function revertReason(error: unknown): string {
  const candidate = error as { data?: string; info?: { error?: { data?: string } }; shortMessage?: string };
  const data = candidate.data ?? candidate.info?.error?.data;
  if (typeof data === 'string' && data.length > 2) {
    for (const iface of [ICommonErrors__factory.createInterface(), IAccessControl__factory.createInterface()]) {
      try {
        const parsed = iface.parseError(data);
        if (parsed) return `${parsed.name}(${parsed.args.map((a) => String(a)).join(', ')})`;
      } catch {
        /* error is not declared on this interface — try the next one */
      }
    }
  }
  return candidate.shortMessage ?? 'reverted';
}

async function main(): Promise<void> {
  const [issuer, investor, stranger] = await ethers.getSigners();

  step('SETUP', 'Stand up ATS on the local network');
  const system = await deploySystemWithNewBlr(issuer, 'hardhat', {
    useTimeTravel: false,
    saveOutput: false,
    deployOnlyBondConfig: true,
    verifyDeployment: false,
  });
  const ats = { factory: system.infrastructure.factory.proxy, resolver: system.infrastructure.blr.proxy };
  line('ATS factory', ats.factory);
  line('contracts deployed', `${system.summary.totalFacets} facets — none of them ours`);

  step('1', 'Receivables Flow issues Acme invoice #1042');
  const token = await issueReceivableToken(
    issuer,
    ats,
    { reference: 'Acme Invoice #1042', code: 'RF1042', faceValueUsd: 50_000, maturityDays: 60 },
    [issuer.address],
  );
  const core = ICore__factory.connect(token, issuer);
  const terms = await readTerms(issuer, token);
  line('token address', token);
  line('name', await core.name());
  line('symbol', await core.symbol());
  line('face value', `$${terms.faceValueUsd.toLocaleString('en-US')}`);
  line('matures', new Date(terms.maturityDate * 1000).toDateString());

  await mintTo(issuer, token, issuer.address, 50_000);
  const balances = IBalanceTracker__factory.connect(token, issuer);
  line('issued to treasury', `${(await balances.balanceOf(issuer.address)).toString()} units`);

  step('2', 'A wallet nobody approved tries to receive it');
  line('stranger', stranger.address);
  line('on approved list?', String(await isApprovedHolder(issuer, token, stranger.address)));
  try {
    await ITransfer__factory.connect(token, issuer).transfer(stranger.address, 10_000);
    console.log('\n  ⚠️  TRANSFER SUCCEEDED — the lock is not working\n');
  } catch (error) {
    line('transfer result', 'REFUSED by the contract');
    line('revert reason', revertReason(error));
  }
  line('stranger balance', `${(await balances.balanceOf(stranger.address)).toString()} units — nothing moved`);

  step('3', 'Receivables Flow approves a real investor');
  await approveHolder(issuer, token, investor.address);
  line('investor', investor.address);
  line('on approved list?', String(await isApprovedHolder(issuer, token, investor.address)));
  await ITransfer__factory.connect(token, issuer).transfer(investor.address, 10_000);
  line('transfer result', 'SETTLED');
  line('investor balance', `${(await balances.balanceOf(investor.address)).toString()} units = $10,000 of the invoice`);

  step('4', 'Receivables Flow withdraws that approval');
  await revokeHolder(issuer, token, investor.address);
  line('on approved list?', String(await isApprovedHolder(issuer, token, investor.address)));
  try {
    await ITransfer__factory.connect(token, issuer).transfer(investor.address, 1_000);
    console.log('\n  ⚠️  TRANSFER SUCCEEDED — revocation is not working\n');
  } catch (error) {
    line('transfer result', 'REFUSED by the contract');
    line('revert reason', revertReason(error));
  }
  line('investor balance', `${(await balances.balanceOf(investor.address)).toString()} units — unchanged`);

  step('5', 'Someone who is not Receivables Flow tries to approve themselves');
  try {
    await approveHolder(stranger, token, stranger.address);
    console.log('\n  ⚠️  APPROVAL SUCCEEDED — the compliance role is not enforced\n');
  } catch (error) {
    line('approval result', 'REFUSED by the contract');
    line('revert reason', revertReason(error));
  }
  line('on approved list?', String(await isApprovedHolder(issuer, token, stranger.address)));
  console.log('');
}

main().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});
