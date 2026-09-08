import type { Metadata } from 'next';
import { Inter_Tight } from 'next/font/google';
import './globals.css';

/*
 * One variable family covers both the sans and the mono role. `font-variant-numeric:
 * tabular-nums` (set in globals.css) does the column alignment a second monospaced
 * family would otherwise be carried for, which keeps a money column aligned without
 * the width jump a font swap introduces.
 */
const tight = Inter_Tight({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-tight' });

export const metadata: Metadata = {
  title: 'Woodgrove Capital',
  description: 'Fund a receivable and get paid at maturity.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={tight.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
