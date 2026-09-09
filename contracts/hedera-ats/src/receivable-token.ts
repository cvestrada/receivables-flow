import { ZeroAddress, type Signer } from 'ethers';
import {
  IAccessControl__factory,
  ICap__factory,
  IControlList__factory,
  IFactory__factory,
  IMaturity__factory,
  IMint__factory,
  INominalValue__factory,
} from '@hashgraph/asset-tokenization-contracts';
import { ATS_ROLES, BOND_CONFIG_ID, deployBondFromFactory } from '@hashgraph/asset-tokenization-contracts/scripts';

/** Addresses of an ATS deployment this package issues tokens against. */
export interface AtsDeployment {
  factory: string;
  resolver: string;
}

/** The invoice being turned into a security. */
export interface Invoice {
  /** Human reference, e.g. "Acme Invoice #1042". Becomes part of the token name. */
  reference: string;
  /** Short code for the token, e.g. "RF1042". */
  code: string;
  /**
   * The token's full name, when the invoice record already carries one.
   *
   * Falls back to the reference, which is what the earlier demo tokens were named
   * after. A note that is sold on has a name of its own, and it is decided by the
   * record rather than assembled here.
   */
  name?: string;
  /** Total face value in whole US dollars. */
  faceValueUsd: number;
  /** Days from issuance until the invoice is payable. */
  maturityDays: number;
}

/** Terms read back off an issued token, never from our own records. */
export interface ReceivableTerms {
  faceValueUsd: number;
  /** Unix seconds. */
  maturityDate: number;
}

const DAY_IN_SECONDS = 24 * 60 * 60;

/** Each unit of the token is worth one dollar, so a $50,000 invoice issues 50,000 units. */
const NOMINAL_VALUE_PER_UNIT = 100;
const NOMINAL_VALUE_DECIMALS = 2;
const TOKEN_DECIMALS = 6;

/** "USD" as the bytes3 ISO 4217 code ATS stores on the token. */
const USD = '0x555344';

/** RegulationType.REG_S — the offering sits outside the US-person rules. */
const REG_S = 1;
const REGULATION_SUBTYPE_NONE = 0;

/**
 * Issues one invoice as its own security and returns its address.
 *
 * The token is created in whitelist mode, which cannot be changed afterwards — an
 * address absent from the control list can never receive it. `approvedHolders`
 * seeds that list at creation; the signer must be among them to hold the supply
 * it mints.
 *
 * `externalKycLists` are contracts ATS consults on every transfer, for the sender as well as the
 * recipient, so a party they refuse cannot sell any more than it can buy. They are fixed at
 * creation: a token whose KYC source could be swapped afterwards would let whoever holds the
 * admin role decide a trade the source was supposed to decide.
 *
 * @param signer - Account that becomes admin, issuer and compliance operator
 * @param ats - Where the ATS factory and resolver live on this network
 * @param invoice - The invoice's reference, face value and payment window
 * @param approvedHolders - Addresses allowed to hold the token from the start
 * @param externalKycLists - Contracts asked whether a party is KYC approved, during the transfer
 * @returns Address of the newly issued token
 */
export async function issueReceivableToken(
  signer: Signer,
  ats: AtsDeployment,
  invoice: Invoice,
  approvedHolders: string[] = [],
  externalKycLists: string[] = [],
): Promise<string> {
  const admin = await signer.getAddress();
  const factory = IFactory__factory.connect(ats.factory, signer);

  /*
   * Step 1 of the Core Logic diagram — map the invoice onto the parameters ATS
   * expects. Supply is one unit per dollar of face value, so the units an
   * investor buys read directly as dollars of the invoice.
   */
  const startingDate = Math.floor(Date.now() / 1000);
  const token = await deployBondFromFactory(
    {
      adminAccount: admin,
      factory,
      securityData: {
        arePartitionsProtected: false,
        isMultiPartition: false,
        resolver: ats.resolver,
        resolverProxyConfiguration: { key: BOND_CONFIG_ID, version: 1 },
        isControllable: true,
        isWhiteList: true,
        maxSupply: BigInt(invoice.faceValueUsd) * 10n ** BigInt(TOKEN_DECIMALS),
        erc20MetadataInfo: {
          name: invoice.name ?? `Receivables Flow · ${invoice.reference}`,
          symbol: invoice.code,
          isin: buildIsin(invoice.code),
          decimals: TOKEN_DECIMALS,
        },
        clearingActive: false,
        internalKycActivated: false,
        erc20VotesActivated: false,
        externalPauses: [],
        externalControlLists: [],
        externalKycLists,
        compliance: ZeroAddress,
        identityRegistry: ZeroAddress,
        rbacs: [
          { role: ATS_ROLES.ROLE_CONTROL_LIST, members: [admin] },
          { role: ATS_ROLES.ROLE_ISSUER, members: [admin] },
          { role: ATS_ROLES.ROLE_CAP, members: [admin] },
        ],
      },
      bondDetails: {
        currency: USD,
        nominalValue: NOMINAL_VALUE_PER_UNIT,
        nominalValueDecimals: NOMINAL_VALUE_DECIMALS,
        startingDate,
        maturityDate: startingDate + invoice.maturityDays * DAY_IN_SECONDS,
      },
      proceedRecipients: [],
      proceedRecipientsData: [],
    },
    {
      regulationType: REG_S,
      regulationSubType: REGULATION_SUBTYPE_NONE,
      additionalSecurityData: {
        countriesControlListType: false,
        listOfCountries: '',
        info: '',
      },
    },
  );

  const address = await token.getAddress();

  /*
   * Whitelist mode is already live at this point, so nobody can hold the token
   * until they are on the list — including whoever will mint the supply.
   */
  for (const holder of approvedHolders) {
    await approveHolder(signer, address, holder);
  }

  return address;
}

/**
 * Reads the invoice's face value and payment date back off the token.
 *
 * Face value is not stored as one number: ATS keeps a per-unit nominal value and
 * a supply cap, so the invoice total is reconstructed from the two.
 */
export async function readTerms(signer: Signer, token: string): Promise<ReceivableTerms> {
  const nominal = INominalValue__factory.connect(token, signer);
  const [nominalValue, nominalDecimals, maxSupply, maturityDate] = await Promise.all([
    nominal.getNominalValue(),
    nominal.getNominalValueDecimals(),
    ICap__factory.connect(token, signer).getMaxSupply(),
    IMaturity__factory.connect(token, signer).getMaturityDate(),
  ]);

  const units = Number(maxSupply) / 10 ** TOKEN_DECIMALS;
  const valuePerUnit = Number(nominalValue) / 10 ** Number(nominalDecimals);

  return {
    faceValueUsd: units * valuePerUnit,
    maturityDate: Number(maturityDate),
  };
}

/** Adds one address to the token's approved-holder list. Requires the compliance role. */
export async function approveHolder(signer: Signer, token: string, holder: string): Promise<void> {
  const tx = await IControlList__factory.connect(token, signer).addToControlList(holder);
  await tx.wait();
}

/** Removes one address from the token's approved-holder list. Requires the compliance role. */
export async function revokeHolder(signer: Signer, token: string, holder: string): Promise<void> {
  const tx = await IControlList__factory.connect(token, signer).removeFromControlList(holder);
  await tx.wait();
}

/** Reports whether an address may currently hold the token. */
export async function isApprovedHolder(signer: Signer, token: string, holder: string): Promise<boolean> {
  return IControlList__factory.connect(token, signer).isInControlList(holder);
}

/** Mints token units to an address. Requires the issuer role, and the address must be approved. */
export async function mintTo(signer: Signer, token: string, to: string, units: number): Promise<void> {
  const tx = await IMint__factory.connect(token, signer).mint(to, units);
  await tx.wait();
}

/**
 * Hands the right to issue the token to another account.
 *
 * The account that created the token holds this role, and the account that should
 * hold it is the one the directors approve through. Requires the admin role.
 */
export async function grantIssuerRole(signer: Signer, token: string, account: string): Promise<void> {
  const tx = await IAccessControl__factory.connect(token, signer).grantRole(
    ATS_ROLES.ROLE_ISSUER,
    account,
  );
  await tx.wait();
}

/**
 * Takes the right to issue the token away from an account.
 *
 * Used on the account that created the token, so that afterwards no key we hold
 * can issue the note — which is what makes two directors approving the only way it
 * comes into existence.
 */
export async function revokeIssuerRole(signer: Signer, token: string, account: string): Promise<void> {
  const tx = await IAccessControl__factory.connect(token, signer).revokeRole(
    ATS_ROLES.ROLE_ISSUER,
    account,
  );
  await tx.wait();
}

/** Reports whether an address holds a given ATS role on the token. */
export async function hasRole(signer: Signer, token: string, role: string, account: string): Promise<boolean> {
  return IAccessControl__factory.connect(token, signer).hasRole(role, account);
}

/**
 * Builds a valid ISIN for one invoice.
 *
 * The factory rejects an ISIN whose check digit is wrong, so the digit is
 * computed rather than supplied. The body is derived from the invoice code so
 * two invoices never collide.
 */
function buildIsin(code: string): string {
  const body = code
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .padEnd(9, '0')
    .slice(0, 9);
  const withCountry = `US${body}`;

  const digits = withCountry
    .split('')
    .map((character) => {
      const value = character.charCodeAt(0);
      return value >= 65 ? String(value - 55) : character;
    })
    .join('');

  /*
   * Luhn from the right: every second digit is doubled, and a doubled result
   * above nine is reduced by nine.
   */
  let sum = 0;
  let double = true;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }

  return `${withCountry}${(10 - (sum % 10)) % 10}`;
}
