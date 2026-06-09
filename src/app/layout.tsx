import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/client";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mundial '26 · Bet Pool",
  description: "Friends-only World Cup 2026 prediction pool.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen antialiased`}>
        <TRPCReactProvider>
          <Nav />
          <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-24">
            {children}
          </main>
          <Toaster />
        </TRPCReactProvider>
      </body>
    </html>
  );
}
