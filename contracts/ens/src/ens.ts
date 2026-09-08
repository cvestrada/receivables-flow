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
 * record, and grants itself only the three counts. Withholding the blanket write role is what
 * makes "only the reviewer sets the rating" a property of the chain rather than a promise:
 * the platform has no role that would let it write that field.
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
 * Three raw counts and nothing derived. A pre-computed grade would make the platform the
 * author of an opinion a funder has no reason to weight above its own underwriting; three
 * numbers let anyone compute their own.
 */
export const PROFILE_RECORDS = [
  'rf.invoices.financed',
  'rf.invoices.repaid',
  'rf.invoices.defaulted',
  'credit.rating',
] as const;

/** The one record the platform never writes — see `appointReviewer`. */
export const RATING_RECORD = 'credit.rating';

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
 * different key produces a different target, which is the whole basis of the reviewer role.
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
 * contract is keyed by the record name alone, so a reviewer appointed for `credit.rating` on a
 * shared store would hold that grant over every company on it. The store is the boundary the
 * contract actually enforces, so one company per store is what "this reviewer rates Ironline"
 * has to mean.
 */
export async function givePage(
  signer: Signer,
  { registry: registryAddress, baseName }: Registry,
  label: string,
  years = 1,
): Promise<Page> {
  const platform = await signer.getAddress();
  const registry = new ethers.Contract(registryAddress, ABI.registry, signer);
  const name = `${label}.${baseName}`;

  const existing = await registry.getResolver(label).catch(() => ethers.ZeroAddress);
  if (existing !== ethers.ZeroAddress) return { name, resolver: existing };

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

  // The platform gives itself write access to the counts and to nothing else. The rating is
  // conspicuously absent: it is the reviewer's field, and the platform holds no role that
  // would let it be written here.
  const store = new ethers.Contract(resolver, ABI.resolver, signer);
  for (const key of PROFILE_RECORDS) {
    if (key === RATING_RECORD) continue;
    await (await store.grantSetterRoles(buildSetterBlob(name, key), platform)).wait();
  }

  return { name, resolver };
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
    if (key === RATING_RECORD) {
      throw new Error('the rating is the reviewer\'s field — the platform does not write it');
    }
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

/**
 * Give one address write access to one field and nothing else.
 *
 * The permission target is derived by the deployed resolver from the setter blob rather than
 * recomputed here. Recomputing it would mean this package's idea of the target and the
 * contract's could drift apart, and the grant would silently land on the wrong record.
 */
export async function appointReviewer(
  signer: Signer,
  resolverAddress: string,
  name: string,
  reviewer: string,
  key: string = RATING_RECORD,
): Promise<void> {
  const resolver = new ethers.Contract(resolverAddress, ABI.resolver, signer);
  await (await resolver.grantSetterRoles(buildSetterBlob(name, key), reviewer)).wait();
}

/** Take the rating back from a reviewer who is no longer appointed. */
export async function revokeReviewer(
  signer: Signer,
  resolverAddress: string,
  name: string,
  reviewer: string,
  key: string = RATING_RECORD,
): Promise<void> {
  const resolver = new ethers.Contract(resolverAddress, ABI.resolver, signer);
  const [, resource] = await resolver.decodeSetter(buildSetterBlob(name, key));
  await (await resolver.revokeRoles(resource, ROLES.setText, reviewer)).wait();
}

/**
 * The record naming the wallet a pass clears.
 *
 * The pass itself is the name and the expiry the registry holds against it — this record only
 * says who the clearance is for. Keeping the wallet here rather than deriving it from the
 * label is what lets a fund rotate its wallet without being re-issued a name, and clearing it
 * is how the platform takes a pass back before its date comes round.
 */
export const PASS_WALLET_RECORD = 'rf.pass.wallet';

export interface Pass {
  name: string;
  resolver: string;
  wallet: string;
  expiresAt: bigint;
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
  { registry: registryAddress, baseName }: Registry,
  label: string,
  wallet: string,
  seconds: number,
): Promise<Pass> {
  const platform = await signer.getAddress();
  const registry = new ethers.Contract(registryAddress, ABI.registry, signer);
  const name = `${label}.${baseName}`;

  const standing = await registry.getResolver(label).catch(() => ethers.ZeroAddress);
  if (standing !== ethers.ZeroAddress) {
    return {
      name,
      resolver: standing,
      wallet: await readRecord(signer.provider, standing, name, PASS_WALLET_RECORD),
      expiresAt: await registry.findExpiry(label),
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
  await (await store.grantSetterRoles(buildSetterBlob(name, PASS_WALLET_RECORD), platform)).wait();
  await (await store.setText(encodeName(name), PASS_WALLET_RECORD, wallet)).wait();

  return { name, resolver, wallet, expiresAt };
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
  { registry: registryAddress, baseName }: Registry,
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
  const wallet = await readRecord(provider, resolver, name, PASS_WALLET_RECORD).catch(() => '');

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
  { registry: registryAddress, baseName }: Registry,
  label: string,
): Promise<void> {
  const registry = new ethers.Contract(registryAddress, ABI.registry, signer);
  const resolver = await registry.getResolver(label);
  const store = new ethers.Contract(resolver, ABI.resolver, signer);

  await (await store.setText(encodeName(`${label}.${baseName}`), PASS_WALLET_RECORD, '')).wait();
}
