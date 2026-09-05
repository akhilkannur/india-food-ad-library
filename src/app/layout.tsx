import type { Metadata } from "next";
import "./globals.css";
import "./workbench.css";
import "./explore-intro.css";

export const metadata: Metadata = {
  title: "India Food Ad Library — Indian food advertising",
  description: "Browse advertising creative from Indian food and beverage brands.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
