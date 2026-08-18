import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indian Food Ad Library",
  description: "A curated index of advertising creative from Indian food and beverage brands.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
