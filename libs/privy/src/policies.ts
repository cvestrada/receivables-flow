/**
 * Every rule the two accounts run under, as plain data.
 *
 * Nothing here talks to Privy. Keeping the rules separate from the code that
 * sends them means a wrong threshold or a reversed comparison is caught by a
 * test that needs no credentials — a rule that is wrong here would be enforced
 * perfectly by Privy and still be wrong.
 */

/** How many of Ironline Freight's three people must approve before its account acts. */
export const APPROVERS_REQUIRED = 2;

/** How many people share Ironline Freight's account. */
export const APPROVER_COUNT = 3;

/** The most Woodgrove Capital may put into a single invoice. */
export const FUND_CAP_USD = 100_000;

/**
 * What one HBAR stands for in the story's dollars.
 *
 * The demo talks in tens of thousands of dollars, which no testnet faucet will
 * ever hand out. Scaling at one fixed published rate lets both accounts be
 * funded far above every amount attempted, so a refusal can never be mistaken
 * for an empty account.
 */
export const USD_PER_HBAR = 10_000;

const WEIBAR_PER_HBAR = 10n ** 18n;

/** Hedera's EVM interface counts value in weibar, the same 18 decimals as wei. */
export function usdToWeibar(usd: number): bigint {
  return (BigInt(usd) * WEIBAR_PER_HBAR) / BigInt(USD_PER_HBAR);
}

export interface ApprovingGroup {
  display_name: string;
  user_ids: string[];
  authorization_threshold: number;
}

export interface PolicyCondition {
  field_source: 'ethereum_transaction';
  field: string;
  operator: 'lte' | 'gt' | 'in_condition_set';
  value: string;
}

export interface PolicyRule {
  name: string;
  method: 'eth_sendTransaction';
  conditions: PolicyCondition[];
  action: 'ALLOW' | 'DENY';
}

export interface Policy {
  version: '1.0';
  name: string;
  chain_type: 'ethereum';
  rules: PolicyRule[];
}

/**
 * The group that owns Ironline Freight's account.
 *
 * Members are people with Privy dashboard logins rather than keys held by a
 * server, which is what makes the second approval a person deciding rather than
 * a process running.
 */
export function buildApprovingGroup(directorUserIds: string[]): ApprovingGroup {
  return {
    display_name: 'Ironline Freight directors',
    user_ids: directorUserIds,
    authorization_threshold: APPROVERS_REQUIRED,
  };
}

/**
 * Woodgrove Capital's mandate, written so its account cannot breach it.
 *
 * @param ratedListId - The list of invoices the platform has rated B or better
 */
export function buildFundPolicy(ratedListId: string): Policy {
  const cap = usdToWeibar(FUND_CAP_USD).toString();

  return {
    version: '1.0',
    name: 'Woodgrove Capital mandate',
    chain_type: 'ethereum',
    rules: [
      /*
       * The only thing the fund is ever permitted to do: buy an invoice that is
       * within the cap and on the rated list. Privy refuses any request that
       * matches no rule, so every other action is already denied by omission.
       */
      {
        name: 'Buy a rated invoice within the mandate',
        method: 'eth_sendTransaction',
        conditions: [
          { field_source: 'ethereum_transaction', field: 'value', operator: 'lte', value: cap },
          {
            field_source: 'ethereum_transaction',
            field: 'to',
            operator: 'in_condition_set',
            value: ratedListId,
          },
        ],
        action: 'ALLOW',
      },

      /*
       * Refusing over-mandate purchases outright, rather than leaving them to be
       * denied by omission, is what makes the refusal say why on camera.
       */
      {
        name: 'Refuse anything over the mandate',
        method: 'eth_sendTransaction',
        conditions: [
          { field_source: 'ethereum_transaction', field: 'value', operator: 'gt', value: cap },
        ],
        action: 'DENY',
      },
    ],
  };
}
