import { describe, expect, it } from 'vitest';

import { toParty } from './standing';

describe('toParty', () => {
  const base = {
    id: 'woodgrove',
    label: 'Woodgrove Capital',
    side: 'fund' as const,
    name: 'woodgrove.investor.receivablesflow.eth',
    subject: '0xE1e76C63fb819B35cDC09dbb3D03B3d85eeaE2D8',
  };
  const WALLET = '0xE1e76C63fb819B35cDC09dbb3D03B3d85eeaE2D8';
  const DAY = 86_400n;
  const EXPIRES = 1_800_000_000n;

  it('reads as approved while a wallet is named and the date is ahead', () => {
    expect(toParty(base, WALLET, EXPIRES, EXPIRES - DAY).approved).toBe(true);
  });

  it('reads as not approved once the record has been withdrawn', () => {
    // Rejecting wipes the wallet and leaves the date alone, so the date alone cannot decide.
    expect(toParty(base, '', EXPIRES, EXPIRES - DAY).approved).toBe(false);
  });

  it('reads as not approved once the date has passed', () => {
    expect(toParty(base, WALLET, EXPIRES, EXPIRES + DAY).approved).toBe(false);
  });

  it('still produces a row for a party that has no name yet', () => {
    const row = toParty({ ...base, name: '' }, '', 0n, EXPIRES);

    expect(row.approved).toBe(false);
    expect(row.until).toBe('—');
    expect(row.label).toBe('Woodgrove Capital');
  });

  it('shows the date as a plain day rather than a timestamp', () => {
    expect(toParty(base, WALLET, EXPIRES, EXPIRES - DAY).until).toBe('2027-01-15');
  });
});
