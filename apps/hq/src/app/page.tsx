import { Standing } from '@/components/standing';
import { parties } from '@/lib/ens/standing';

/*
 * Rendered per request. Approving is a fact with a date on it, and a page baked at build time
 * would keep claiming a party was approved long after the registry stopped saying so.
 */
export const dynamic = 'force-dynamic';

export default async function Page() {
  const rows = await parties();

  return (
    <main className="mx-auto flex max-w-[980px] flex-col gap-6 px-8 py-10">
      <header className="flex flex-col gap-1">
        <span className="eyebrow">Receivables Flow HQ</span>
        <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--ink)]">KYC</h1>
        <p className="max-w-[60ch] text-[16px] text-[var(--body)]">
          Who may sell an invoice, and who may buy one. Read from ENS on Sepolia.
        </p>
      </header>

      <Standing parties={rows} />
    </main>
  );
}
