import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glance - The Dashboard Skill for OpenClaw",
  description:
    "Stop configuring dashboards. Just tell OpenClaw what you want to see. Glance gives your OpenClaw agent a canvas to build, update, and read widgets.",
  metadataBase: new URL("https://glance.app"),
  openGraph: {
    title: "Glance - The Dashboard Skill for OpenClaw",
    description:
      "Stop configuring dashboards. Just tell OpenClaw what you want to see.",
    siteName: "Glance",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Glance - The Dashboard Skill for OpenClaw",
    description:
      "Stop configuring dashboards. Just tell OpenClaw what you want to see.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
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
