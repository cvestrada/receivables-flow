import { ethers } from 'hardhat';
import type { Signer } from 'ethers';
import { MockScheduleService__factory } from '../typechain-types';
import type { MockScheduleService } from '../typechain-types';

/** Where Hedera's schedule service answers on every Hedera network. */
export const SCHEDULE_SERVICE = '0x000000000000000000000000000000000000016b';

/**
 * Puts the stand-in schedule service where Hedera's real one lives, and hands it back.
 *
 * Every settlement books its repayment, so on Hardhat — which has nothing at that address —
 * every settlement test needs this first. Placing code there leaves whatever storage was
 * already at the address untouched, which is why the stand-in is asked to forget the previous
 * test's booking before it is returned.
 *
 * @param signer - Any funded account; it only deploys the code that gets copied across
 */
export async function installScheduleService(signer: Signer): Promise<MockScheduleService> {
  const stand = await new MockScheduleService__factory(signer).deploy();
  await ethers.provider.send('hardhat_setCode', [
    SCHEDULE_SERVICE,
    await ethers.provider.getCode(await stand.getAddress()),
  ]);

  const service = MockScheduleService__factory.connect(SCHEDULE_SERVICE, signer);
  await service.reset();
  return service;
}
