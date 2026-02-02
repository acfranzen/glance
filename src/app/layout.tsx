import type { Metadata } from 'next';
import { DM_Sans, Playfair_Display } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Glance - One Look at Your Day',
  description: 'A personal productivity dashboard with drag-and-drop widgets that aggregate data from multiple sources.',
  metadataBase: new URL('https://glance.app'),
  openGraph: {
    title: 'Glance - One Look at Your Day',
    description: 'A personal productivity dashboard with drag-and-drop widgets that aggregate data from multiple sources.',
    siteName: 'Glance',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Glance - One Look at Your Day',
    description: 'A personal productivity dashboard with drag-and-drop widgets.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${playfair.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
