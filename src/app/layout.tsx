import type { Metadata } from "next";
import Script from "next/script";
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
      <Script async src="https://www.googletagmanager.com/gtag/js?id=G-RS0TMEM6GG" strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-RS0TMEM6GG');`}
      </Script>
    </html>
  );
}
