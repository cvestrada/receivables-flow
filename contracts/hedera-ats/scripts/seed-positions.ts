import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ethers } from 'hardhat';
import { Wallet } from 'ethers';
import {
  IAccessControl__factory,
  IController__factory,
} from '@hashgraph/asset-tokenization-contracts';
import { ATS_ROLES } from '@hashgraph/asset-tokenization-contracts/scripts';
import { approveHolder, isApprovedHolder } from '../src/receivable-token';

/**
 * Put the receivable where the rest of the demo expects to find it.
 *
 * Issuance mints every unit to the company account, which is right: the business owns its own
 * receivable until somebody buys it. The primary sale — company to fund, against payment — is
 * the settlement contract's job and is not driven end to end yet. Until it is, the resale on
 * day 20 and the repayment on day 60 have nothing to move, and both screens fall back to
 * balances they remembered rather than balances they read.
 *
 * So this settles the primary sale the way a platform acting as the security's controller
 * would: the whole position moves from the company to the fund's signing key in one forced
 * transfer, and every party the later steps need is put on the control list first. The buyer
 * with no pass is deliberately left off it — the refusal on day 20 has to be the asset's own.
 *
 * Run once after `issue`, and again after any re-issue. Nothing here is hidden: the controller
 * role is granted to the platform key on screen, and the transfer is on HashScan like any other.
 */
const GAS = 2_000_000;

function repo(): string {
  for (let dir = __dirname; ; dir = dirname(dir)) {
    try {
      readFileSync(join(dir, 'libs', 'privy', 'accounts.json'));
      return dir;
    } catch {
      if (dirname(dir) === dir) throw new Error('libs/privy/accounts.json not found');
    }
  }
}

async function main(): Promise<void> {
  const root = repo();
  const deployed = JSON.parse(readFileSync(join(root, 'contracts/hedera-ats/deployed.json'), 'utf8')) as {
    hederaTestnet: { receivableToken: string; receivableDvp: string };
  };
  const accounts = JSON.parse(readFileSync(join(root, 'libs/privy/accounts.json'), 'utf8')) as {
    company: { address: string };
    fund: { address: string };
  };

  const token = deployed.hederaTestnet.receivableToken;
  const settlement = deployed.hederaTestnet.receivableDvp;

  const [operator] = await ethers.getSigners();
  if (!operator) throw new Error('No account configured');

  const bridgelineKey = process.env.HEDERA_BRIDGELINE_WALLET_PRIVATE_KEY;
  const bridgeline = bridgelineKey ? new Wallet(bridgelineKey).address : undefined;

  console.log(`token      ${token}`);
  console.log(`company    ${accounts.company.address}`);
  console.log(`fund       ${accounts.fund.address}`);
  console.log(`fund key   ${operator.address}  (signs the fund's on-chain moves for the demo)`);
  console.log(`settlement ${settlement}`);
  console.log(`bridgeline ${bridgeline ?? '(HEDERA_BRIDGELINE_WALLET_PRIVATE_KEY not set)'}`);

  /* Everyone the later steps hand units to, allowed to hold them. */
  const holders = [operator.address, accounts.fund.address, settlement, bridgeline].filter(
    (address): address is string => Boolean(address),
  );
  for (const holder of holders) {
    if (await isApprovedHolder(operator, token, holder)) {
      console.log(`holder     ${holder} already approved`);
      continue;
    }
    await approveHolder(operator, token, holder);
    console.log(`holder     ${holder} approved`);
  }

  /* The platform key becomes the controller, which is what lets it settle the primary sale. */
  const access = IAccessControl__factory.connect(token, operator);
  if (!(await access.hasRole(ATS_ROLES.ROLE_CONTROLLER, operator.address))) {
    const granted = await access.grantRole(ATS_ROLES.ROLE_CONTROLLER, operator.address, { gasLimit: GAS });
    await granted.wait();
    console.log(`controller ${operator.address} granted`);
  }

  /* The whole position, company → fund's key, as the settlement of the primary sale. */
  const controller = IController__factory.connect(token, operator);
  const erc20 = new ethers.Contract(
    token,
    ['function balanceOf(address) view returns (uint256)'],
    operator,
  );
  const held = (await erc20.balanceOf(accounts.company.address)) as bigint;

  if (held === 0n) {
    console.log(`position   company holds nothing to move — already settled?`);
  } else {
    const moved = await controller.controllerTransfer(
      accounts.company.address,
      operator.address,
      held,
      '0x',
      '0x',
      { gasLimit: GAS },
    );
    const receipt = await moved.wait();
    console.log(`position   ${held} units company → fund key in ${receipt?.hash}`);
  }

  console.log(`fund key   now holds ${await erc20.balanceOf(operator.address)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
