import type { Metadata } from "next";
import Script from "next/script";
import "./base.css";
import "./product.css";
import { SITE_DEFAULT_DESCRIPTION, SITE_DEFAULT_TITLE, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DEFAULT_DESCRIPTION,
  keywords: [
    "indian food ads",
    "indian beverage ads",
    "dtc ad inspiration",
    "meta ads swipe file india",
    "food creative examples",
    "ugc ads india",
    "product demo ads",
    "recipe ads",
  ],
  authors: [{ name: "LISN Agency", url: "https://lisnagency.online" }],
  creator: "LISN Agency",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LISN Agency",
    url: "https://lisnagency.online",
  };
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DEFAULT_DESCRIPTION,
    inLanguage: "en-IN",
  };
  return (
    <html lang="en">
      <body className="product-body">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        {children}</body>
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
