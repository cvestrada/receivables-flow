import { redirect } from 'next/navigation';

/** A fund opens on what it is being offered, because that is where money moves first. */
export default function PortfolioPage() {
  redirect('/portfolio/offered');
}
