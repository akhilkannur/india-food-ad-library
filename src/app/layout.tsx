import type { Metadata } from "next";
import "./globals.css";
import "./brand-directory.css";

export const metadata: Metadata = {
  title: "India Food Ad Library — Creative Index",
  description: "A living index of advertising creative from Indian food and beverage brands.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
