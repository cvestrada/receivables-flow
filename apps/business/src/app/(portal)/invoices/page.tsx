import { redirect } from 'next/navigation';

/** What is still owed is the half a business opens this tab to see. */
export default function InvoicesPage() {
  redirect('/invoices/outstanding');
}
