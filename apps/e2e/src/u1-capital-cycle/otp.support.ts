/**
 * Reading a real sign-in code out of a real inbox.
 *
 * Privy's email login sends a six-digit code and will not accept anything else, so a test that
 * wants to prove a director can sign in has to receive mail. Resend's inbound inbox is that
 * mailbox: the director addresses are on a Resend inbound domain, and this polls the account's
 * received mail until the code Privy just sent turns up.
 *
 * Plain `fetch` against Resend's REST API rather than the SDK — this is two GETs, and a test
 * harness that pulls a mail-sending library in to read two JSON documents is a dependency
 * nobody will thank us for at submission time.
 */

/** Resend's own maximum page size. A busy account can push a fresh mail past a smaller page. */
const PAGE_SIZE = 100;

const POLL_INTERVAL_MS = 2_000;

/**
 * Long enough for Privy to send and Resend to receive; short enough to fail inside a test.
 *
 * Raised from ninety seconds after a run where the fund's code took longer than that to land —
 * two sign-ins in one test means the second one queues behind the first.
 */
const POLL_TIMEOUT_MS = 150_000;

interface ReceivedSummary {
  id: string;
  to: string[];
  created_at: string;
}

async function resendGet<T>(path: string, key: string): Promise<T> {
  const response = await fetch(`https://api.resend.com${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!response.ok) {
    throw new Error(`Resend ${path} answered ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

/**
 * Wait for the sign-in code Privy sent to `email` after `sentAt`.
 *
 * `sentAt` matters: the same address is used by every run, so an inbox holds older codes that
 * are all six digits and all look right. Taking the newest mail that arrived after the button
 * was pressed is what stops a test from passing on last week's code.
 *
 * @param email - The address the code was sent to
 * @param sentAt - Epoch milliseconds taken immediately before submitting the address
 * @param key - A Resend API key with access to the inbound inbox
 * @returns The six digits, as a string
 */
export async function waitForSignInCode(
  email: string,
  sentAt: number,
  key: string,
): Promise<string> {
  const deadline = sentAt + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    const list = await resendGet<{ data?: ReceivedSummary[] }>(
      `/emails/receiving?limit=${PAGE_SIZE}`,
      key,
    );

    const newest = (list.data ?? [])
      .filter((mail) => mail.to.includes(email) && Date.parse(mail.created_at) >= sentAt)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

    if (!newest) continue;

    const mail = await resendGet<{ html?: string; text?: string }>(
      `/emails/receiving/${newest.id}`,
      key,
    );

    const code = (mail.html ?? mail.text ?? '').match(/\b(\d{6})\b/);
    if (code) return code[1];
  }

  throw new Error(`no sign-in code reached ${email} within ${POLL_TIMEOUT_MS / 1000}s`);
}

/** The credentials this flow needs, or undefined when the machine has not been set up for it. */
export function signInCredentials(): { email: string; key: string } | undefined {
  const key = process.env.RESEND_API_KEY;
  const email = process.env.E2E_DIRECTOR_EMAIL ?? process.env.PRIVY_BUSINESS_DIRECTOR_EMAILS?.split(',')[0]?.trim();

  return key && email ? { email, key } : undefined;
}
