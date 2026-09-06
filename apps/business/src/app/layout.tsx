import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';

const archivo = Archivo({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-archivo' });
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Ironline Freight',
  description: 'Sell an unpaid invoice and get the cash today.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plex.variable} ${plexMono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
