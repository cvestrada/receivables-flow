import { JsonRpcProvider, Network, Wallet } from 'ethers';
import {
  SETTLEMENT_RECORD,
  applyOutcome,
  countRecords,
  creditScore,
  type Ending,
  writeRecords,
} from '@rf/contracts-ens';
import deployed from '@rf/contracts-ens/deployed.json';
import { record, type Record as Standing } from '@/lib/ens/score';

/**
 * Where day 60 is added to Ironline Freight's own public record.
 *
 * The counts on that page are the only thing the next invoice is priced from, so an ending that
 * never reaches them is an ending that costs the business nothing and earns it nothing. Writing
 * it here — the moment the obligation ends, from the platform's key — is what makes the next
 * price a consequence of what Ironline did rather than of what it was assumed to be.
 *
 * The platform writes, not the business. That was settled when the registry was built: a company
 * that could write its own counts could publish a record of its own choosing, and the page would
 * be worth exactly as much as its own say-so.
 */

/** What Ironline's page said before day 60 and what it says after, and whether it was published. */
export interface Written {
  before: Standing;
  after: Standing;
  /** True when the new record is on the page, false when it is only worked out here. */
  published: boolean;
  /** The transfer the page now points at, where the invoice was paid. */
  hash?: string;
  /** Why nothing was published, when nothing was. */
  reason?: string;
}

interface Deployment {
  business?: { name: string; resolver: string };
}

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://sepolia.gateway.tenderly.co';

/** Stated rather than discovered — the deployment already says which chain this is. */
const SEPOLIA = new Network('sepolia', 11_155_111);

/** What the page will say once the ending is added, worked out from what it says now. */
function next(before: Standing, ending: Ending): Standing {
  const counts = applyOutcome(before, ending);

  return { ...counts, score: creditScore(counts) ?? null };
}

/**
 * Add day 60's ending to Ironline Freight's page, and read the page back.
 *
 * The record returned afterwards is the one the page publishes, not the one this function wrote
 * — a screen that showed what it had tried to write would tell the business its record improved
 * even on a run where nothing landed.
 *
 * A key that is not open is not a reason to show nothing. The same tally is worked out here and
 * returned as unpublished: what Ironline's ending is worth and whether the world can see it yet
 * are two different facts, and only the second one needs a key.
 */
export async function publish(ending: Ending, hash?: string): Promise<Written> {
  const before = await record();
  const projected = next(before, ending);

  const { business } = deployed as Deployment;
  const key = process.env.SEPOLIA_PLATFORM_WALLET_PRIVATE_KEY;

  if (!business || !key) {
    return {
      before,
      after: projected,
      published: false,
      hash,
      reason:
        'The platform key that writes to Ironline’s page is not open — set SEPOLIA_PLATFORM_WALLET_PRIVATE_KEY in the repository .env. The record below is what day 60 earns; it has not been published.',
    };
  }

  const provider = new JsonRpcProvider(RPC_URL, SEPOLIA, { staticNetwork: true });

  try {
    const platform = new Wallet(key, provider);

    await writeRecords(platform as never, business.resolver, business.name, {
      ...countRecords(projected),
      /*
       * The page points at the transfer that ended the invoice rather than announcing an
       * outcome. A default has no transfer to point at, and saying so is the honest record of
       * it — the absence is the fact.
       */
      [SETTLEMENT_RECORD]: hash ?? `RCV-0001 ${ending === 'repaid' ? 'paid' : 'not paid'}`,
    });

    return { before, after: await record(), published: true, hash };
  } catch (error) {
    return {
      before,
      after: projected,
      published: false,
      hash,
      reason: error instanceof Error ? error.message : String(error),
    };
  } finally {
    provider.destroy();
  }
}
