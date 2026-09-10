import { ethers } from 'ethers';

/**
 * The ENSv2 deployment made for the hackathon, which is not the one on the production docs.
 *
 * Two ENSv2 deployments run on Sepolia at the same time. Building against the production
 * addresses compiles, deploys and passes its own tests while writing to a registry the
 * hackathon explorer never reads — a failure with no error message. Every address this
 * package uses is written down once, here.
 */
export const SEPOLIA = {
  ethRegistry: '0x1d78834d97c1d7b1a38c1dedbd1a287cfed3971e',
  ethRegistrar: '0x7d1b7f586a62ac3f54b9a396849757814283270b',
  userRegistryImpl: '0x47b442d0cf617c41cabaff5f02f44dd1e5f72546',
  permissionedResolverImpl: '0xa9d3814ab151bf6e37a427432795371a8361614e',
  verifiableFactory: '0x894bc9cc8ff1ad96b8a288c86a8c71d662c07780',
  universalResolver: '0xd26f2040d083af1cd2962ba303f4bea0c4faf142',
  mockUsdc: '0xcbfd80f74375c54e545af34788ff465f96f66f05',
} as const;

/**
 * Enhanced Access Control role bits, as the deployed contracts define them.
 *
 * Roles occupy one bit per nybble, and each has an admin counterpart 128 bits higher that
 * authorizes granting it. A bitmap with any other bit set is rejected outright, so these are
 * OR-ed together rather than approximated with a blanket mask.
 */
const admin = (role: bigint) => role << 128n;

export const ROLES = {
  registrar: 1n << 0n,
  unregister: 1n << 12n,
  renew: 1n << 16n,
  setSubregistry: 1n << 20n,
  setResolver: 1n << 24n,
  setAddr: 1n << 0n,
  setText: 1n << 4n,
  clear: 1n << 32n,
} as const;

/** What the platform holds on its own registry: it issues names and points them. */
export const REGISTRY_ROLES =
  ROLES.registrar |
  ROLES.unregister |
  ROLES.renew |
  ROLES.setSubregistry |
  ROLES.setResolver |
  admin(ROLES.registrar) |
  admin(ROLES.unregister) |
  admin(ROLES.renew) |
  admin(ROLES.setSubregistry) |
  admin(ROLES.setResolver);

/**
 * What the platform holds on the record store — deliberately not the text-write role.
 *
 * The platform takes `setText`'s *admin* role, which lets it hand out write access per
 * record, and grants itself only the three counts. Withholding the blanket write role keeps
 * the grant list on a page short enough to read: every field anyone can write is one the
 * platform had to name, so a record nobody granted is a record nobody can touch.
 */
export const RESOLVER_ROLES =
  ROLES.setAddr |
  ROLES.clear |
  admin(ROLES.setAddr) |
  admin(ROLES.setText) |
  admin(ROLES.clear);

/**
 * What a business profile publishes.
 *
 * Four raw counts and nothing derived. A stored grade would make the platform the author
 * of an opinion a funder has no reason to weight above its own underwriting; four numbers
 * and a published formula let every reader arrive at the same score without us.
 *
 * Paid is split into on time and late because the two are different facts about a business
 * and neither is a default. Which one an invoice was is not a judgement anybody makes: the
 * redemption carries a consensus timestamp and the security carries its maturity date, so
 * the answer is a comparison of two numbers already on the chain.
 */
export const PROFILE_RECORDS = [
  'rf.invoices.financed',
  'rf.invoices.ontime',
  'rf.invoices.late',
  'rf.invoices.defaulted',
] as const;

/**
 * The record naming the wallet whose KYC has passed.
 *
 * Named for what a reader would look for rather than for our internals: an explorer shows the
 * raw key, so `rf.kyc.wallet` has to say on its own that this is the wallet KYC applies to.
 * Keeping the wallet in a record rather than deriving it from the label lets a party rotate its
 * wallet without being re-issued a name, and emptying it is how KYC is taken back.
 */
export const KYC_WALLET_RECORD = 'rf.kyc.wallet';

/** What the record was called before it said KYC. Cleared on sight so no name carries both. */
export const RETIRED_WALLET_RECORD = 'rf.pass.wallet';

/**
 * The payment behind the latest ending on a business's page.
 *
 * A count on its own is an assertion: it says an invoice was paid and offers nothing to check
 * that against. Naming the transfer that ended the invoice turns the count into an index of
 * something that happened on a public network, which anybody can go and look at without asking
 * us anything. It is deliberately not part of the score — a reader who distrusts the count can
 * follow this record instead of arguing about the number.
 */
export const SETTLEMENT_RECORD = 'rf.invoices.settlement';

/**
 * Every record the platform is given write access to when a page is issued.
 *
 * Kept as one list because grants are topped up on each onboard run: a record that is not named
 * here is a record no existing page can ever publish, however carefully the rest of the code
 * writes to it.
 */
export const WRITABLE_RECORDS = [
  ...PROFILE_RECORDS,
  KYC_WALLET_RECORD,
  RETIRED_WALLET_RECORD,
  SETTLEMENT_RECORD,
] as const;


export const ABI = {
  registrar: [
    'function isAvailable(string) view returns (bool)',
    'function MIN_COMMITMENT_AGE() view returns (uint256)',
    'function getRegisterPrice(string,uint64,address) view returns (uint256,uint256)',
    'function makeCommitment(string,address,bytes32,address,address,uint64,bytes32) pure returns (bytes32)',
    'function commit(bytes32)',
    'function register(string,address,bytes32,address,address,uint64,address,bytes32) returns (uint256)',
  ],
  registry: [
    'function register(string,address,address,address,uint256,uint64) returns (uint256)',
    'function ownerOf(uint256) view returns (address)',
    'function findOwner(string) view returns (address)',
    'function findTokenId(string) view returns (uint256)',
    'function findExpiry(string) view returns (uint64)',
    'function getSubregistry(string) view returns (address)',
    'function getResolver(string) view returns (address)',
    'function setResolver(uint256,address)',
    'function setSubregistry(uint256,address)',
  ],
  resolver: [
    'function initialize((address,uint256)[],bytes[])',
    'function setText(bytes,string,string)',
    'function resolve(bytes,bytes) view returns (bytes)',
    'function grantSetterRoles(bytes,address) returns (bool)',
    'function revokeRoles(uint256,uint256,address) returns (bool)',
    'function decodeSetter(bytes) pure returns (bytes,uint256,uint256)',
    'function hasRoles(uint256,uint256,address) view returns (bool)',
  ],
  factory: [
    'function deployProxy(address,uint256,bytes) returns (address)',
    'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
  ],
  erc20: [
    'function mint(address,uint256)',
    'function approve(address,uint256) returns (bool)',
    'function balanceOf(address) view returns (uint256)',
  ],
} as const;

/**
 * A name in the wire format the resolver takes.
 *
 * The refactored ENSv2 resolver addresses records by the encoded name rather than by a
 * namehash, so this is not interchangeable with `ethers.namehash`.
 */
export function encodeName(name: string): string {
  const labels = name.split('.').map((label) => {
    const bytes = ethers.toUtf8Bytes(label);
    return ethers.concat([new Uint8Array([bytes.length]), bytes]);
  });
  return ethers.hexlify(ethers.concat([...labels, new Uint8Array([0])]));
}

/**
 * The blob that scopes a grant to one text record on one name.
 *
 * `grantSetterRoles` does not take a name and a key — it takes the setter call the grantee is
 * being allowed to make, and derives the permission target from it. Handing it a call for a
 * different key produces a different target, which is what keeps a grant to one field from
 * spilling onto the rest of a company's page.
 */
export function buildSetterBlob(name: string, key: string): string {
  return new ethers.Interface(ABI.resolver).encodeFunctionData('setText', [
    encodeName(name),
    key,
    '',
  ]);
}

type Signer = ethers.Signer & { provider: ethers.Provider };

async function deployProxy(signer: Signer, implementation: string, initData: string) {
  const factory = new ethers.Contract(SEPOLIA.verifiableFactory, ABI.factory, signer);
  const receipt = await (await factory.deployProxy(implementation, ethers.toBigInt(ethers.randomBytes(32)), initData)).wait();
  const event = receipt.logs
    .map((log: ethers.Log) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: ethers.LogDescription | null) => parsed?.name === 'ProxyDeployed');

  if (!event) throw new Error('VerifiableFactory did not report a deployed proxy');
  return event.args.proxyAddress as string;
}

export interface Registry {
  baseName: string;
  registry: string;
  resolver: string;
}

/**
 * What a caller needs to reach a name: where the platform's registry lives, and what it sits
 * beneath. Narrower than `Registry` on purpose — reading a pass should not require holding the
 * platform's own resolver address, which a stranger has no reason to have.
 */
export type RegistryRef = Pick<Registry, 'baseName' | 'registry'>;

/**
 * Buy the platform's own public name and open its registry beneath it.
 *
 * Runs once, before anyone signs up. Everything after this is a call rather than a purchase,
 * which is what makes giving a page to the next company free.
 */
export async function openRegistry(signer: Signer, label: string, years = 1): Promise<Registry> {
  const platform = await signer.getAddress();
  const registrar = new ethers.Contract(SEPOLIA.ethRegistrar, ABI.registrar, signer);
  const ethRegistry = new ethers.Contract(SEPOLIA.ethRegistry, ABI.registry, signer);
  const baseName = `${label}.eth`;

  const existing = await ethRegistry.getSubregistry(label).catch(() => ethers.ZeroAddress);
  if (!(await registrar.isAvailable(label))) {
    if (existing === ethers.ZeroAddress) {
      throw new Error(`${baseName} is taken by someone else — pick another label`);
    }
    return { baseName, registry: existing, resolver: await ethRegistry.getResolver(label) };
  }

  const resolver = await deployProxy(
    signer,
    SEPOLIA.permissionedResolverImpl,
    new ethers.Interface(ABI.resolver).encodeFunctionData('initialize', [
      [[platform, RESOLVER_ROLES]],
      [],
    ]),
  );
  const registry = await deployProxy(
    signer,
    SEPOLIA.userRegistryImpl,
    new ethers.Interface(['function initialize((address,uint256)[])']).encodeFunctionData(
      'initialize',
      [[[platform, REGISTRY_ROLES]]],
    ),
  );

  const duration = BigInt(years) * 31_536_000n;
  const [base, premium] = await registrar.getRegisterPrice(label, duration, SEPOLIA.mockUsdc);
  const price = base + premium;
  const usdc = new ethers.Contract(SEPOLIA.mockUsdc, ABI.erc20, signer);

  // The hackathon's USDC mints to anyone who asks, so the only thing a human has to go and
  // fetch is gas. Topping up here keeps that out of the runbook.
  if ((await usdc.balanceOf(platform)) < price) {
    await (await usdc.mint(platform, price * 10n)).wait();
  }
  await (await usdc.approve(SEPOLIA.ethRegistrar, price)).wait();

  // Commit-reveal: the commitment must age before it can be spent, so a watcher cannot see
  // the name in the mempool and register it first.
  const secret = ethers.hexlify(ethers.randomBytes(32));
  const referrer = ethers.ZeroHash;
  const commitment = await registrar.makeCommitment(
    label,
    platform,
    secret,
    registry,
    resolver,
    duration,
    referrer,
  );
  await (await registrar.commit(commitment)).wait();
  await waitForCommitment(signer, await registrar.MIN_COMMITMENT_AGE());

  await (
    await registrar.register(
      label,
      platform,
      secret,
      registry,
      resolver,
      duration,
      SEPOLIA.mockUsdc,
      referrer,
    )
  ).wait();

  return { baseName, registry, resolver };
}

async function waitForCommitment(signer: Signer, minAge: bigint): Promise<void> {
  const provider = signer.provider as ethers.JsonRpcProvider;
  // On a fork the clock is ours to move; against the live chain it is not.
  if (typeof provider.send === 'function' && (await provider.getNetwork()).chainId === 31337n) {
    await provider.send('evm_increaseTime', [Number(minAge) + 1]);
    await provider.send('evm_mine', []);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, (Number(minAge) + 5) * 1000));
}

/**
 * Open a side of the market as a registry of its own.
 *
 * `business` and `investor` sit between the platform's name and the companies beneath it, so
 * `woodgrove.investor.receivablesflow.eth` says which side of the trade it is before anyone
 * resolves a single record. Two names on one flat level cannot say that, and on a two-sided
 * market that is the first thing a reader needs.
 *
 * Runs once per side. Everything beneath it is a call, exactly as the platform's own registry
 * made each company page a call rather than a purchase.
 */
export async function openBranch(
  signer: Signer,
  { registry: registryAddress, baseName }: RegistryRef,
  label: string,
  years = 1,
): Promise<RegistryRef> {
  const platform = await signer.getAddress();
  const registry = new ethers.Contract(registryAddress, ABI.registry, signer);
  const name = `${label}.${baseName}`;

  const standing = await registry.getSubregistry(label).catch(() => ethers.ZeroAddress);
  if (standing !== ethers.ZeroAddress) return { baseName: name, registry: standing };

  const subregistry = await deployProxy(
    signer,
    SEPOLIA.userRegistryImpl,
    new ethers.Interface(['function initialize((address,uint256)[])']).encodeFunctionData(
      'initialize',
      [[[platform, REGISTRY_ROLES]]],
    ),
  );

  const expiry = BigInt(Math.floor(Date.now() / 1000)) + BigInt(years) * 31_536_000n;
  await (
    await registry.register(
      label,
      platform,
      subregistry,
      ethers.ZeroAddress,
      ROLES.setResolver | ROLES.setSubregistry,
      expiry,
    )
  ).wait();

  return { baseName: name, registry: subregistry };
}

/**
 * Take a name back out of the registry.
 *
 * Only used to clear away names issued before the market had two sides — a name left on the
 * old flat level would show up beside the new ones and read as a second, contradictory record
 * for the same company.
 */
export async function retireName(
  signer: Signer,
  { registry: registryAddress }: RegistryRef,
  label: string,
): Promise<string | undefined> {
  const registry = new ethers.Contract(
    registryAddress,
    [...ABI.registry, 'function unregister(uint256)'],
    signer,
  );

  const tokenId = await registry.findTokenId(label).catch(() => 0n);
  if (tokenId === 0n || (await registry.getResolver(label).catch(() => ethers.ZeroAddress)) === ethers.ZeroAddress) {
    return undefined;
  }

  const receipt = await (await registry.unregister(tokenId)).wait();
  return receipt.hash as string;
}

export interface Page {
  name: string;
  resolver: string;
}

/**
 * Give a company its page when it signs up.
 *
 * The platform stays owner — a company that owned its own page could rewrite the record the
 * page exists to publish.
 *
 * Each company gets its own record store rather than sharing the platform's. A grant on this
 * contract is keyed by the record name alone, so a grant on `rf.invoices.repaid` in a shared
 * store would carry over every company on it. The store is the boundary the contract actually
 * enforces, so one company per store is what "these are Ironline's counts" has to mean.
 */
export async function givePage(
  signer: Signer,
  { registry: registryAddress, baseName }: RegistryRef,
  label: string,
  years = 1,
): Promise<Page> {
  const platform = await signer.getAddress();
  const registry = new ethers.Contract(registryAddress, ABI.registry, signer);
  const name = `${label}.${baseName}`;

  const existing = await registry.getResolver(label).catch(() => ethers.ZeroAddress);
  if (existing !== ethers.ZeroAddress) {
    // A page issued before a record existed has no grant for it. Topping the grants up rather
    // than reissuing the name keeps the company's history intact, and a run that changes
    // nothing spends nothing, because each grant is checked before it is made.
    await grantWritable(signer, existing, name, platform);
    return { name, resolver: existing };
  }

  const resolver = await deployProxy(
    signer,
    SEPOLIA.permissionedResolverImpl,
    new ethers.Interface(ABI.resolver).encodeFunctionData('initialize', [
      [[platform, RESOLVER_ROLES]],
      [],
    ]),
  );

  const expiry = BigInt(Math.floor(Date.now() / 1000)) + BigInt(years) * 31_536_000n;
  await (
    await registry.register(
      label,
      platform,
      ethers.ZeroAddress,
      resolver,
      ROLES.setResolver | ROLES.setSubregistry,
      expiry,
    )
  ).wait();

  await grantWritable(signer, resolver, name, platform);

  return { name, resolver };
}

/**
 * Give the platform write access to every record a page publishes.
 *
 * Only the counts and the KYC wallet — there is no score field to grant, because the score is
 * computed by whoever is reading rather than written by whoever is trusted. Each grant is
 * checked first, so calling this on a page that already has them is free.
 */
async function grantWritable(
  signer: Signer,
  resolverAddress: string,
  name: string,
  platform: string,
): Promise<void> {
  for (const key of WRITABLE_RECORDS) {
    await grantSetter(signer, resolverAddress, name, key, platform);
  }
}

/**
 * Give one address write access to one record, unless it already has it.
 *
 * Checking first is what makes every operation in this package safe to run again: a record
 * added after a name was issued needs its grant, and a name that already has it costs nothing.
 */
async function grantSetter(
  signer: Signer,
  resolverAddress: string,
  name: string,
  key: string,
  grantee: string,
): Promise<void> {
  const store = new ethers.Contract(resolverAddress, ABI.resolver, signer);
  const blob = buildSetterBlob(name, key);
  const [, resource] = await store.decodeSetter(blob);

  if (await store.hasRoles(resource, ROLES.setText, grantee)) return;
  await (await store.grantSetterRoles(blob, grantee)).wait();
}

/** Write a company's record onto its page. */
export async function writeRecords(
  signer: Signer,
  resolverAddress: string,
  name: string,
  records: Record<string, string>,
): Promise<void> {
  const resolver = new ethers.Contract(resolverAddress, ABI.resolver, signer);
  const encoded = encodeName(name);

  for (const [key, value] of Object.entries(records)) {
    await (await resolver.setText(encoded, key, value)).wait();
  }
}

/**
 * Read one record back, the way a stranger with only a name would.
 *
 * There is no plain getter on this resolver. A read is the classic `text` call wrapped in
 * `resolve`, which is the same path a wallet or explorer takes — so a passing read here means
 * the record is genuinely visible, not merely present in storage.
 */
const TEXT_GETTER = new ethers.Interface(['function text(bytes32,string) view returns (string)']);

export async function readRecord(
  provider: ethers.Provider,
  resolverAddress: string,
  name: string,
  key: string,
): Promise<string> {
  const resolver = new ethers.Contract(resolverAddress, ABI.resolver, provider);
  const answer = await resolver.resolve(
    encodeName(name),
    TEXT_GETTER.encodeFunctionData('text', [ethers.namehash(name), key]),
  );
  return TEXT_GETTER.decodeFunctionResult('text', answer)[0] as string;
}

/** What a business's page says about its invoices: how many it took, and how each one ended. */
export interface Counts {
  financed: number;
  /** Matured invoices paid on or before their maturity date. */
  ontime: number;
  /** Matured invoices paid, but after their maturity date. */
  late: number;
  /** Matured invoices nobody paid. */
  defaulted: number;
}

/**
 * What a late payment is worth against an on-time one, out of 100.
 *
 * Half, because a business that pays late has done something materially different from both
 * the one that paid on time and the one that never paid — an investor who was owed money on
 * day 60 and received it on day 75 was not made whole on the terms it bought. Putting the
 * number here rather than inside the sum is the point: it is the one judgement in the
 * formula, so it is stated once, in the open, where anyone can disagree with it out loud.
 */
export const LATE_WEIGHT = 50;

/**
 * The published formula. The whole of it.
 *
 * A business's score is what its matured invoices earned, out of 100 each for the ones paid on
 * time and `LATE_WEIGHT` for the ones paid late, averaged over everything that matured. Nobody
 * drew a band and no key anywhere writes the answer down — two funders who disagree about a
 * company can each run this line and get the same number.
 *
 * `financed` is not an input. An invoice nobody has had to pay yet is neither a payment nor a
 * miss, so financing more of them must not move a business up or down.
 *
 * A business with nothing matured is unrated rather than scored. Unrated means nobody knows
 * yet; zero means everyone does, and collapsing the two would let the worst record on the
 * platform hide behind the same answer as a newcomer's.
 */
export function creditScore({ ontime, late, defaulted }: Counts): number | undefined {
  const matured = ontime + late + defaulted;
  if (matured === 0) return undefined;

  return Math.round((ontime * 100 + late * LATE_WEIGHT) / matured);
}

/** How a matured invoice ended: the business paid it, or it never paid it. */
export type Ending = 'repaid' | 'defaulted';

/**
 * What a business's page says once day 60 has ended.
 *
 * One invoice moves from outstanding to matured, and which way it went is the whole of the
 * difference: paying adds to the invoices paid on time, not paying adds to the ones never paid.
 * `financed` does not move, because the invoice was counted as financed on the day it was sold
 * — counting it again at maturity would read as a business that raised money on it twice.
 *
 * Nothing here is idempotent, and it should not be: this answers what one more ending does to a
 * record. Whether an ending has already happened is a question about day 60, which belongs to
 * whoever is holding the record of it, not to a sum.
 */
export function applyOutcome(counts: Counts, ending: Ending): Counts {
  return ending === 'repaid'
    ? { ...counts, ontime: counts.ontime + 1 }
    : { ...counts, defaulted: counts.defaulted + 1 };
}

/**
 * The record a business is onboarded with.
 *
 * Six invoices matured — four paid on time, one paid late, one never paid — which scores 75.
 * Deliberately not a clean sheet: a business onboarded at 100 has nowhere to go, so repaying
 * $50,000 on time would leave its next invoice priced exactly where it was and the platform's
 * central claim — that a public record earns a business cheaper money — would be true in the
 * arithmetic and invisible on the screen. Starting mid-range is what lets both endings show.
 */
export const ONBOARD_COUNTS: Counts = { financed: 7, ontime: 4, late: 1, defaulted: 1 };

/**
 * A tally written the way a page publishes it.
 *
 * One place turns counts into records, so onboarding a business and recording an ending cannot
 * drift into publishing different keys for the same fact.
 */
export function countRecords({ financed, ontime, late, defaulted }: Counts): Record<string, string> {
  return {
    'rf.invoices.financed': String(financed),
    'rf.invoices.ontime': String(ontime),
    'rf.invoices.late': String(late),
    'rf.invoices.defaulted': String(defaulted),
  };
}

/**
 * The count a profile published before paying late was distinguishable from paying.
 *
 * Kept readable rather than dropped, because a business's record is the one thing on this
 * platform that must survive our own changes of mind — a page written last month cannot be
 * made unrated by a release note.
 */
export const LEGACY_PAID = 'rf.invoices.repaid';

/** What a profile's raw text records say, before anything is counted. */
export interface RawCounts {
  financed: string;
  ontime: string;
  late: string;
  defaulted: string;
  /** The legacy count, present only on profiles written before the split. */
  paid: string;
}

/**
 * Read a profile's counts, whichever vocabulary it was written in.
 *
 * A profile carrying neither `ontime` nor `late` predates the distinction, and the only
 * honest reading of its `repaid` count is that those invoices were paid — nobody recorded
 * whether any of them were late, so inventing a late one would be worse than reading them
 * all as on time. Once the profile is republished with the split, this stops applying: the
 * new records win the moment either of them exists.
 */
export function splitPaid({ financed, ontime, late, defaulted, paid }: RawCounts): Counts {
  const legacy = ontime === '' && late === '';

  return {
    financed: readCount(financed),
    ontime: readCount(legacy ? paid : ontime),
    late: legacy ? 0 : readCount(late),
    defaulted: readCount(defaulted),
  };
}

/**
 * Work out a business's score from its public page, the way a stranger would.
 *
 * Takes a provider and the platform's registry and nothing else — no signer, and no call to
 * Receivables Flow. The counts are read off the page and the sum is done here, so there is no
 * point in this path where the answer is something we handed out.
 */
export async function readScore(
  provider: ethers.Provider,
  { registry: registryAddress, baseName }: RegistryRef,
  label: string,
): Promise<number | undefined> {
  const registry = new ethers.Contract(registryAddress, ABI.registry, provider);
  const name = `${label}.${baseName}`;

  // A company with no page is in the same position as one with no matured invoices: there is
  // nothing to score, which is a different answer from scoring it badly.
  const resolver = await registry.getResolver(label).catch(() => ethers.ZeroAddress);
  if (resolver === ethers.ZeroAddress) return undefined;

  const [financed, ontime, late, defaulted, paid] = await Promise.all([
    readRecord(provider, resolver, name, 'rf.invoices.financed').catch(() => ''),
    readRecord(provider, resolver, name, 'rf.invoices.ontime').catch(() => ''),
    readRecord(provider, resolver, name, 'rf.invoices.late').catch(() => ''),
    readRecord(provider, resolver, name, 'rf.invoices.defaulted').catch(() => ''),
    readRecord(provider, resolver, name, LEGACY_PAID).catch(() => ''),
  ]);

  return creditScore(splitPaid({ financed, ontime, late, defaulted, paid }));
}

/** A record that was never written reads as none, so a blank page comes back unrated. */
function readCount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface Pass {
  name: string;
  resolver: string;
  wallet: string;
  expiresAt: bigint;
  /** The transaction that changed the pass, when this call changed anything. */
  hash?: string;
}

export interface PassVerdict {
  wallet: string;
  expiresAt: bigint;
  cleared: boolean;
}

/**
 * Whether a pass clears a fund at a given moment.
 *
 * Split out from the chain read so the one decision that matters can be checked against dates
 * directly. A fund is cleared while its expiry is ahead of the moment asked about — never at
 * the expiry itself, so the answer does not depend on which side of a second the caller lands.
 */
export function decidePass(wallet: string, expiresAt: bigint, at: bigint): PassVerdict {
  return { wallet, expiresAt, cleared: wallet !== '' && expiresAt > 0n && at < expiresAt };
}

/**
 * Clear an investor to hold receivables, until a date.
 *
 * The name is issued with an expiry rather than a flag someone has to remember to turn off:
 * a fund's accreditation is renewed on a date in the real world, and a permission that
 * outlives it is quietly wrong from the day it stops being true.
 *
 * The platform stays owner, exactly as it does for a business page. A fund that owned its
 * pass could hand it to a fund that was never cleared, which is the one thing the pass exists
 * to prevent.
 */
export async function issuePass(
  signer: Signer,
  { registry: registryAddress, baseName }: RegistryRef,
  label: string,
  wallet: string,
  seconds: number,
): Promise<Pass> {
  const platform = await signer.getAddress();
  const registry = new ethers.Contract(registryAddress, ABI.registry, signer);
  const name = `${label}.${baseName}`;

  /*
   * A name that already stands is kept and its record brought up to date, rather than a second
   * name being issued. That is what makes clearing a fund again after a revocation the same
   * action as clearing it the first time — the operator has one button, not two.
   */
  const standing = await registry.getResolver(label).catch(() => ethers.ZeroAddress);
  if (standing !== ethers.ZeroAddress) {
    // A name issued before this record existed has no grant for it — see `grantSetter`.
    await grantSetter(signer, standing, name, KYC_WALLET_RECORD, platform);
    await grantSetter(signer, standing, name, RETIRED_WALLET_RECORD, platform);

    const current = await readRecord(signer.provider, standing, name, KYC_WALLET_RECORD);
    const store = new ethers.Contract(standing, ABI.resolver, signer);
    const receipt =
      current === wallet
        ? undefined
        : await (await store.setText(encodeName(name), KYC_WALLET_RECORD, wallet)).wait();

    return {
      name,
      resolver: standing,
      wallet,
      expiresAt: await registry.findExpiry(label),
      hash: receipt?.hash,
    };
  }

  const resolver = await deployProxy(
    signer,
    SEPOLIA.permissionedResolverImpl,
    new ethers.Interface(ABI.resolver).encodeFunctionData('initialize', [
      [[platform, RESOLVER_ROLES]],
      [],
    ]),
  );

  // The chain's clock, not this machine's. On a fork the two are not the same, and the expiry
  // has to mean something to the registry that enforces it.
  const now = BigInt((await signer.provider.getBlock('latest'))?.timestamp ?? 0);
  const expiresAt = now + BigInt(seconds);

  await (
    await registry.register(
      label,
      platform,
      ethers.ZeroAddress,
      resolver,
      ROLES.setResolver | ROLES.setSubregistry,
      expiresAt,
    )
  ).wait();

  const store = new ethers.Contract(resolver, ABI.resolver, signer);
  await (await store.grantSetterRoles(buildSetterBlob(name, KYC_WALLET_RECORD), platform)).wait();
  const receipt = await (await store.setText(encodeName(name), KYC_WALLET_RECORD, wallet)).wait();

  return { name, resolver, wallet, expiresAt, hash: receipt.hash };
}

/**
 * Answer whether a fund may hold a receivable right now, the way a counterparty would.
 *
 * Takes a provider and the platform's registry and nothing else — no signer, no call to
 * Receivables Flow. That is the property worth having: the other side of a trade decides for
 * itself rather than trusting the platform earning a fee on it.
 */
export async function readPass(
  provider: ethers.Provider,
  { registry: registryAddress, baseName }: RegistryRef,
  label: string,
  at?: bigint,
): Promise<Pass & PassVerdict> {
  const registry = new ethers.Contract(registryAddress, ABI.registry, provider);
  const name = `${label}.${baseName}`;
  const moment = at ?? BigInt((await provider.getBlock('latest'))?.timestamp ?? 0);

  // An expired name stops resolving at all, so a missing resolver is a lapsed pass rather
  // than an error — the same answer a fund that was never cleared gets.
  const resolver = await registry.getResolver(label).catch(() => ethers.ZeroAddress);
  if (resolver === ethers.ZeroAddress) {
    return { name, resolver, ...decidePass('', 0n, moment) };
  }

  const expiresAt: bigint = await registry.findExpiry(label).catch(() => 0n);
  const wallet = await readRecord(provider, resolver, name, KYC_WALLET_RECORD).catch(() => '');

  return { name, resolver, ...decidePass(wallet, expiresAt, moment) };
}

/**
 * Take a standing pass back before its expiry.
 *
 * Withdrawing the wallet rather than the name leaves the expiry visible, so a reader can tell
 * a pass that was pulled from one that simply ran out. Only the platform holds the role that
 * makes this write land; anyone else is refused by the resolver.
 */
export async function revokePass(
  signer: Signer,
  { registry: registryAddress, baseName }: RegistryRef,
  label: string,
): Promise<string> {
  const registry = new ethers.Contract(registryAddress, ABI.registry, signer);
  const resolver = await registry.getResolver(label);
  const store = new ethers.Contract(resolver, ABI.resolver, signer);

  const receipt = await (
    await store.setText(encodeName(`${label}.${baseName}`), KYC_WALLET_RECORD, '')
  ).wait();

  return receipt.hash as string;
}

/**
 * Empty the record this one used to be called, on a name that still carries it.
 *
 * A name showing both `rf.pass.wallet` and `rf.kyc.wallet` would read as two answers to one
 * question, and the explorer shows every record it finds. Skipped when there is nothing there,
 * so a name issued after the rename costs nothing.
 */
export async function clearRetiredRecord(
  signer: Signer,
  resolverAddress: string,
  name: string,
): Promise<string | undefined> {
  const standing = await readRecord(signer.provider, resolverAddress, name, RETIRED_WALLET_RECORD);
  if (standing === '') return undefined;

  const store = new ethers.Contract(resolverAddress, ABI.resolver, signer);
  const receipt = await (
    await store.setText(encodeName(name), RETIRED_WALLET_RECORD, '')
  ).wait();

  return receipt.hash as string;
}
