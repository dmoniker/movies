import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = 'https://hiddengemmovies.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Hidden Gem Movies',
    template: '%s | Hidden Gem Movies',
  },
  description:
    'Discover high-rated, low-visibility movies by genre — the classic hidden gem formula.',
  applicationName: 'Hidden Gem Movies',
  openGraph: {
    title: 'Hidden Gem Movies',
    description:
      'Discover high-rated, low-visibility movies by genre — the classic hidden gem formula.',
    url: siteUrl,
    siteName: 'Hidden Gem Movies',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: 'Hidden Gem Movies',
    description:
      'Discover high-rated, low-visibility movies by genre — the classic hidden gem formula.',
  },
  alternates: {
    canonical: '/',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden max-w-full">{children}</body>
    </html>
  );
}
