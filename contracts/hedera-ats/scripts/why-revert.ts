import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ethers } from 'hardhat';
import { BOND_CONFIG_ID, ATS_ROLES } from '@hashgraph/asset-tokenization-contracts/scripts';
import { IFactory__factory } from '@hashgraph/asset-tokenization-contracts/typechain-types';
import { ZeroAddress } from 'ethers';
const DEFAULT_FACTORY = '0xd1F118A40f3b02883D35909eF2517e7EDd78379d';
const DEFAULT_RESOLVER = '0xBA2D5FC2083A0b8f164c50e65d782087fBA18E0a';

/**
 * Ask the factory to deploy without actually deploying, so it can say why it will not.
 *
 * Hedera's relay reports a failed deployment as a receipt with `status: 0` and no revert data,
 * which is how an ATS bond creation that reverts for a nameable reason arrives looking like a
 * network flake. A static call runs the same code and returns the revert string.
 */
/** Turn a revert selector into the ATS error it names, using ATS's own registry. */
function name(data: string | undefined): string {
  if (!data) return '(no data)';

  const selector = data.slice(0, 10);
  const source = readFileSync(
    join(
      __dirname,
      '../../../node_modules/@hashgraph/asset-tokenization-contracts/build/scripts/domain/atsRegistry.generated.js',
    ),
    'utf8',
  );

  const at = source.indexOf(`selector: "${selector}"`);
  if (at < 0) return `unknown selector ${selector}`;

  const named = source.slice(0, at).lastIndexOf('name: "');
  return source.slice(named + 7, source.indexOf('"', named + 7));
}

async function main(): Promise<void> {
  const [operator] = await ethers.getSigners();
  if (!operator) throw new Error('No account configured');

  const factory = IFactory__factory.connect(DEFAULT_FACTORY, operator);
  const startingDate = Math.floor(Date.now() / 1000) + 5 * 60;

  const security = {
    arePartitionsProtected: false,
    isMultiPartition: false,
    resolver: DEFAULT_RESOLVER,
    resolverProxyConfiguration: { key: BOND_CONFIG_ID, version: 1 },
    isControllable: true,
    isWhiteList: true,
    maxSupply: 50_000n * 10n ** 6n,
    erc20MetadataInfo: {
      name: 'Receivables Flow · Ironline Freight Note 2026-0417',
      symbol: 'INV0417',
      isin: 'USINV0417003',
      decimals: 6,
    },
    clearingActive: false,
    internalKycActivated: false,
    erc20VotesActivated: false,
    externalPauses: [],
    externalControlLists: [],
    externalKycLists: [],
    compliance: ZeroAddress,
    identityRegistry: ZeroAddress,
    rbacs: [
      { role: ATS_ROLES.DEFAULT_ADMIN_ROLE, members: [operator.address] },
      { role: ATS_ROLES.ROLE_CONTROL_LIST, members: [operator.address] },
      { role: ATS_ROLES.ROLE_ISSUER, members: [operator.address] },
      { role: ATS_ROLES.ROLE_CAP, members: [operator.address] },
    ],
  };

  const bond = {
    currency: '0x555344',
    nominalValue: 1_000_000n,
    nominalValueDecimals: 6,
    startingDate,
    maturityDate: startingDate + 60 * 86_400,
  };

  try {
    const address = await factory.deployBond.staticCall(
      {
        security,
        bondDetails: bond,
        proceedRecipients: [],
        proceedRecipientsData: [],
      },
      {
        regulationType: 1,
        regulationSubType: 0,
        additionalSecurityData: {
          countriesControlListType: false,
          listOfCountries: '',
          info: '',
        },
      },
    );
    console.log('would deploy at', address);
  } catch (error) {
    const e = error as { shortMessage?: string; reason?: string; data?: string; message: string };
    console.log('reason      :', e.reason ?? '(none)');
    console.log('short       :', e.shortMessage ?? '(none)');
    console.log('data        :', e.data ?? '(none)');
    console.log('error       :', name(e.data));
    console.log('message     :', e.message.slice(0, 400));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
