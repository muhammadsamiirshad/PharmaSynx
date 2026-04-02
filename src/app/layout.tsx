"use client";

import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.className} w-full overflow-x-hidden`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
