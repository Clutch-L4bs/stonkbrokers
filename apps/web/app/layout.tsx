import type { Metadata } from "next";
import "./globals.scss";
import { Providers } from "./providers";
import { AppShell } from "./components/AppShell";

export const metadata: Metadata = {
  title: "Stonk Brokers",
  description: "Stonk Brokers on Robinhood Chain"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="scanlines" aria-hidden="true" />
        <div className="noise" aria-hidden="true" />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

