import type { Metadata } from "next";
import Script from "next/script";
import "./base.css";
import "./product.css";
import { SITE_DEFAULT_DESCRIPTION, SITE_DEFAULT_TITLE, SITE_NAME, SITE_URL } from "@/lib/site";

const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DEFAULT_DESCRIPTION,
  keywords: [
    "best facebook ads examples",
    "meta ads examples",
    "facebook ad examples",
    "indian brand ads",
    "meta ads swipe file",
    "facebook ads swipe file",
    "food ads examples",
    "ad creative examples",
    "facebook ads inspiration",
    "indian food ads",
    "dtc ad inspiration",
    "ugc ads india",
  ],
  authors: [{ name: "LISN Agency", url: "https://lisn.agency" }],
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
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Best Facebook Ad Examples — Indian Food & Beverage Ad Library" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_DEFAULT_TITLE,
    description: SITE_DEFAULT_DESCRIPTION,
    images: [OG_IMAGE],
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
    url: "https://lisn.agency",
  };
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DEFAULT_DESCRIPTION,
    inLanguage: "en-IN",
    about: [
      { "@type": "Thing", name: "Advertising" },
      { "@type": "Thing", name: "Digital Marketing" },
      { "@type": "Thing", name: "Facebook Advertising" },
      { "@type": "Thing", name: "Creative Strategy" },
    ],
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
