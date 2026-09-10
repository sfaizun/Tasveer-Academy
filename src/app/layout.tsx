import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tasveer Academy Portal",
  description: "Admissions, enrolment, scheduling and fee collection for Tasveer Academy.",
};

const THEME_BOOT = `
try {
  var t = localStorage.getItem('ta-theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
