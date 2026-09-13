import { redirect } from 'next/navigation';
import { Outstanding } from '@/components/outstanding';
import { quote } from '@/lib/hedera-ats/quote';
import { invoiceView, readSubmission, statusOf } from '@/lib/submission';

export const dynamic = 'force-dynamic';

/**
 * What Ironline is owed and has not sold yet.
 *
 * The price is fetched here, on the server, because the wizard shows it at step two and a
 * dialog that opened and then went and asked what the invoice was worth would make a person
 * wait at exactly the moment they are deciding.
 */
export default async function OutstandingPage() {
  const held = readSubmission();
  if (statusOf(held) === 'tokenized') redirect('/invoices/financed');

  const priced = await quote();

  return <Outstanding invoice={invoiceView()} quote={priced} />;
}
