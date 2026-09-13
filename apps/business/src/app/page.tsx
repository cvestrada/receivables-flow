import { redirect } from 'next/navigation';

/** The portal opens on the invoice, because that is the only thing on it to act on. */
export default function Home() {
  redirect('/invoices/outstanding');
}
