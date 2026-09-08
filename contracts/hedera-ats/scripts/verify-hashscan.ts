import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { network } from 'hardhat';

/*
 * HashScan reads verified sources from Sourcify rather than holding its own copy — its
 * verifier host now redirects there outright. Hardhat's verify task still speaks Sourcify's
 * v1 API, which was retired and answers with an HTML 404, so the submission is made against
 * v2 here instead of through the plugin.
 */
const SOURCIFY = 'https://sourcify.dev/server';
const CONTRACT = 'contracts/ReceivableDvp.sol:ReceivableDvp';

/** Standard JSON input and the exact compiler build, straight out of the last compile. */
function buildInput(): { stdJsonInput: unknown; compilerVersion: string } {
  const dir = join(__dirname, '..', 'artifacts', 'build-info');
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));

  for (const file of files) {
    const info = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (CONTRACT.split(':')[0]! in info.input.sources) {
      return { stdJsonInput: info.input, compilerVersion: info.solcLongVersion };
    }
  }

  throw new Error('No build info for the contract — run `npx hardhat compile` first');
}

/**
 * Publishes the settlement contract's source so anyone can read it at its address.
 *
 * Verification is asynchronous: the submission returns an id and the result is polled. A
 * resubmission of something already verified completes with `already_verified` rather than a
 * match, which is success — the script is safe to run again.
 */
async function main(): Promise<void> {
  const chainId = (await import('hardhat')).network.config.chainId;
  const deployed = JSON.parse(readFileSync(join(__dirname, '..', 'deployed.json'), 'utf8'));
  const address = deployed[network.name]?.receivableDvp;

  if (!address) {
    throw new Error(`No settlement contract recorded for ${network.name} — deploy it first`);
  }

  const submission = await fetch(`${SOURCIFY}/v2/verify/${chainId}/${address}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...buildInput(), contractIdentifier: CONTRACT }),
  });

  if (!submission.ok) {
    throw new Error(`Sourcify refused the submission: ${submission.status} ${await submission.text()}`);
  }

  const { verificationId } = (await submission.json()) as { verificationId: string };

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const job = (await (await fetch(`${SOURCIFY}/v2/verify/${verificationId}`)).json()) as {
      isJobCompleted: boolean;
      contract?: { match: string | null };
      error?: { customCode?: string; message?: string };
    };

    if (job.isJobCompleted) {
      console.log(`chain    ${chainId}`);
      console.log(`address  ${address}`);

      if (job.error?.customCode === 'already_verified') {
        console.log('match    already verified');
        return;
      }
      if (!job.contract?.match) {
        throw new Error(`Verification failed: ${job.error?.message ?? 'no match'}`);
      }

      console.log(`match    ${job.contract.match}`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error('Verification did not finish in time — check Sourcify directly');
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
