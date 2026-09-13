import { redirect } from 'next/navigation';

/** The fund opens on what it is offered and what it holds — the only tab with actions on it. */
export default function Home() {
  redirect('/portfolio');
}
