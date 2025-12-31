import './globals.css';

import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { Providers } from './providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Portfolio PWA - Gestión de Inversiones',
    template: '%s | Portfolio PWA',
  },
  description:
    'Aplicación PWA para gestionar y monitorear tus portafolios de inversión en tiempo real. Seguimiento de activos, transacciones y rebalanceo inteligente.',
  keywords: [
    'portfolio',
    'inversiones',
    'finanzas',
    'crypto',
    'acciones',
    'pwa',
  ],
  authors: [{ name: 'Mauricio Pacheco' }],
  creator: 'Mauricio Pacheco',
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://portfolio-pwa.vercel.app',
    title: 'Portfolio PWA - Gestión de Inversiones',
    description:
      'Gestiona y monitorea tus portafolios de inversión en tiempo real',
    siteName: 'Portfolio PWA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portfolio PWA - Gestión de Inversiones',
    description:
      'Gestiona y monitorea tus portafolios de inversión en tiempo real',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (!theme) {
                    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
