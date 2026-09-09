import type { Signer } from 'ethers';
import { EnsKycList__factory } from '../typechain-types';

/** A party's KYC as this list holds it, read back off Hedera rather than from our own records. */
export interface Approval {
  /** Unix seconds the ENS name expires. Zero means never approved, or approval taken back. */
  expiresAt: bigint;
  /** The ENS name the approval came from. */
  name: string;
}

/**
 * Deploys the list the token will consult, owned by whoever publishes onto it.
 *
 * The publisher defaults to the signer because the account that reads Sepolia is the account
 * that writes Hedera — splitting them would mean an operator who could publish approvals it
 * had not read.
 *
 * @param signer - Account that pays for the deployment
 * @param publisher - Account allowed to publish and withdraw, if not the signer
 * @returns Address of the deployed list
 */
export async function deployEnsKycList(signer: Signer, publisher?: string): Promise<string> {
  const list = await new EnsKycList__factory(signer).deploy(publisher ?? (await signer.getAddress()));
  await list.waitForDeployment();
  return list.getAddress();
}

/**
 * Records on Hedera what a party's ENS name says about its KYC.
 *
 * @param signer - The list's publisher
 * @param list - Address of the list
 * @param wallet - The wallet named by the `rf.kyc.wallet` record
 * @param expiresAt - Unix seconds the ENS name expires
 * @param name - The ENS name the approval came from
 * @returns Hash of the publishing transaction
 */
export async function publishKyc(
  signer: Signer,
  list: string,
  wallet: string,
  expiresAt: number | bigint,
  name: string,
): Promise<string> {
  const receipt = await (
    await EnsKycList__factory.connect(list, signer).publish(wallet, expiresAt, name)
  ).wait();
  return receipt!.hash;
}

/** Takes a party's approval back before its expiry. Requires the publisher. */
export async function withdrawKyc(signer: Signer, list: string, wallet: string): Promise<string> {
  const receipt = await (await EnsKycList__factory.connect(list, signer).withdraw(wallet)).wait();
  return receipt!.hash;
}

/**
 * Answers the same question the token asks during a transfer, at this block.
 *
 * Deliberately the contract's own answer rather than a comparison done here: a check written in
 * TypeScript could disagree with the one that actually decides the trade.
 */
export async function isKycApproved(signer: Signer, list: string, wallet: string): Promise<boolean> {
  return (await EnsKycList__factory.connect(list, signer).getKycStatus(wallet)) === 1n;
}

/** Reads a party's stored expiry and the ENS name it came from. */
export async function approvalOf(signer: Signer, list: string, wallet: string): Promise<Approval> {
  const approval = await EnsKycList__factory.connect(list, signer).approvalOf(wallet);
  return { expiresAt: approval.expiresAt, name: approval.name };
}
