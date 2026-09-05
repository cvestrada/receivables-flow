import type { Invoice } from '@rf/shared';

/*
 * Empty until the lane that owns this portal fills it. The typed binding is the
 * point: it proves the shared vocabulary resolves and compiles from inside the
 * app, which is the one thing about this wiring that can silently break.
 */
const invoices: Invoice[] = [];

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-3 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Ironline Freight</h1>
      <p className="text-neutral-500">Sell an unpaid invoice and get the cash today.</p>
      <p className="text-sm text-neutral-400">
        {invoices.length} to show.
      </p>
    </main>
  );
}
