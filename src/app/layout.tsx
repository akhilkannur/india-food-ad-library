import type { Metadata } from "next";
import "./base.css";
import "./product.css";

export const metadata: Metadata = {
  title: "India Food Ad Library — Indian food advertising",
  description: "Browse advertising creative from Indian food and beverage brands.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="product-body">{children}</body>
    </html>
  );
}
