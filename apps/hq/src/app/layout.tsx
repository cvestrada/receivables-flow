import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';
import './globals.css';

/*
 * The same family the two portals use. HQ is a staff page rather than a customer one, but it
 * publishes to the same record they read, and a different typeface would suggest a different
 * system.
 */
const tight = Inter_Tight({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-tight' });

export const metadata: Metadata = {
  title: 'Receivables Flow HQ',
  description: 'Approve or reject KYC for every party on the platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={tight.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
