import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Next Demo - Excalidraw MVP',
  description:
    'A minimal diagramming application for creating, editing, saving, and loading diagrams.',
  keywords: ['diagram', 'drawing', 'canvas', 'excalidraw', 'next.js'],
  authors: [{ name: 'Next Demo Team' }],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <div id="root" className="min-h-screen bg-background font-sans antialiased">
          {children}
        </div>
      </body>
    </html>
  );
}
