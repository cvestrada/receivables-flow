/** An account on either settlement network. */
export type Address = `0x${string}`;

/** An ENS name such as `ironline.receivablesflow.eth`. */
export type EnsName = string;

/** A calendar date in ISO 8601 form, such as `2026-11-04`. */
export type IsoDate = string;

/**
 * A money amount, held as a decimal string in the currency's major unit.
 *
 * Amounts cross a network boundary on every request and end up inside token
 * balances that exceed the safe integer range. A string survives both, where a
 * number would silently lose cents on the largest invoices.
 */
export type Amount = string;

/** A bill the business has sent its customer and is waiting to be paid on. */
export interface Invoice {
  id: string;
  amount: Amount;
  currency: 'USD';
  /** The day the customer owes payment. */
  dueDate: IsoDate;
  /** The business that is owed the money. */
  payee: EnsName;
  /**
   * The customer that owes the money.
   *
   * Held as a plain name rather than an account: this party never touches the
   * platform, and their payment arriving is an event we are told about rather
   * than one we can observe.
   */
  payer: string;
}

/** Where an invoice has got to once it has been sold. */
export type ReceivableStatus = 'issued' | 'funded' | 'redeemed' | 'defaulted';

/** An invoice turned into something an investor can buy and be paid out on. */
export interface Receivable {
  id: string;
  invoiceId: string;
  /** What the holders are paid at maturity, if the customer pays. */
  faceValue: Amount;
  /** What the investor paid for it — always below face value. */
  purchasePrice: Amount;
  maturityDate: IsoDate;
  status: ReceivableStatus;
}

/**
 * Permission to hold a receivable, issued by the platform and read by the asset
 * contract when a transfer is attempted.
 *
 * The expiry must be compared against the moment of the transfer, not the moment
 * the pass was read. A pass fetched while valid can lapse before the transfer
 * lands, and treating it as still valid is how an unapproved holder gets in.
 */
export interface EligibilityPass {
  holder: Address;
  name: EnsName;
  expiresAt: IsoDate;
}

/** One investor's share of one receivable. */
export interface Holding {
  receivableId: string;
  holder: Address;
  /** Share of the face value owned, in basis points — 10000 is the whole thing. */
  shareBps: number;
}
