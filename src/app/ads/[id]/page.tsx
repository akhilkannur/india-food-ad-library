import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getApprovedAd, getApprovedAds } from "@/lib/data";
import { isVideoCreative } from "@/lib/media";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

function adTitle(ad: NonNullable<Awaited<ReturnType<typeof getApprovedAd>>>) {
  const hook = ad.headline || ad.hook || ad.format;
  return `${hook} — ${ad.brand.name} Meta ad`;
}

function adDescription(ad: NonNullable<Awaited<ReturnType<typeof getApprovedAd>>>) {
  const parts = [
    `${ad.brand.name} ${ad.format} creative`,
    ad.creative_style ? `in ${ad.creative_style} format` : null,
    ad.selling_angle ? `with a ${ad.selling_angle} angle` : null,
    ad.language ? `in ${ad.language}` : null,
  ].filter(Boolean);
  const base = `Steal inspiration from this ${parts.join(" ")} (${ad.category}) for your Indian DTC food & beverage campaigns.`;
  return ad.hook && ad.headline !== ad.hook ? `${base} Hook: ${ad.hook}.` : base;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ad = await getApprovedAd(id);
  if (!ad) return { title: "Ad not found", robots: { index: false, follow: false } };

  const title = adTitle(ad);
  const description = adDescription(ad);
  const image = ad.thumbnail_url || ad.creative_url || undefined;
  const canonical = `/ads/${ad.id}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description,
      url: canonical,
      ...(image ? { images: [{ url: image, alt: `${ad.brand.name} — ${ad.headline || ad.hook || ad.format}` }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(value),
  );
}

export default async function AdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ad = await getApprovedAd(id);
  if (!ad) notFound();

  const allAds = await getApprovedAds();
  const related = allAds
    .filter((candidate) => candidate.id !== ad.id)
    .filter(
      (candidate) =>
        candidate.brand.slug === ad.brand.slug || candidate.creative_style === ad.creative_style,
    )
    .slice(0, 6);

  const video = isVideoCreative(ad);
  const image = ad.thumbnail_url || ad.creative_url;
  const richAlt = `${ad.brand.name} ${ad.format} ad${ad.headline ? `: ${ad.headline}` : ad.hook ? ` — ${ad.hook}` : ""} (${ad.category}, ${ad.language})`;
  const canonical = `${SITE_URL}/ads/${ad.id}`;

  const creativeWorkJsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: adTitle(ad),
    description: adDescription(ad),
    creator: { "@type": "Brand", name: ad.brand.name },
    inLanguage: ad.language,
    datePublished: ad.first_seen_at,
    url: canonical,
    ...(image ? { image } : {}),
    ...(video && ad.creative_url
      ? { associatedMedia: { "@type": "VideoObject", contentUrl: ad.creative_url, thumbnailUrl: image } }
      : {}),
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Ad library", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: ad.brand.name, item: `${SITE_URL}/brands/${ad.brand.slug}` },
      { "@type": "ListItem", position: 3, name: ad.headline || ad.hook || "Ad", item: canonical },
    ],
  };

  return (
    <div className="library-app">
      <SiteHeader showFluidOrb={false} />
      <main className="library-shell">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWorkJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

        <nav aria-label="Breadcrumb" className="ad-breadcrumb">
          <Link href="/">Ad library</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/brands/${ad.brand.slug}`}>{ad.brand.name}</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{ad.headline || ad.hook || "Ad"}</span>
        </nav>

        <div className="ad-page__layout">
          <div className="ad-page__creative">
            {video && ad.creative_url ? (
              <video src={ad.creative_url} poster={image || undefined} controls playsInline preload="metadata" aria-label={`${ad.brand.name} video ad`} />
            ) : image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={richAlt} loading="eager" />
            ) : (
              <p>Creative preview unavailable — use the original ad link below.</p>
            )}
          </div>

          <div className="ad-page__copy">
            <p className="ad-page__kicker">
              {ad.category} · {ad.format}
              {ad.creative_style ? ` · ${ad.creative_style}` : ""}
            </p>
            <h1>{ad.headline || ad.hook || `${ad.brand.name} ad`}</h1>
            {ad.body_copy && <p className="ad-page__body">{ad.body_copy}</p>}
            {ad.hook && ad.hook !== ad.headline && (
              <p className="ad-page__hook">
                Hook: <strong>{ad.hook}</strong>
              </p>
            )}

            <dl className="detail-list">
              <div><dt>Brand</dt><dd><Link href={`/brands/${ad.brand.slug}`}>{ad.brand.name}</Link></dd></div>
              <div><dt>Ad format</dt><dd>{ad.creative_style || "Not classified"}</dd></div>
              <div><dt>Media type</dt><dd>{ad.format}</dd></div>
              <div><dt>Message angle</dt><dd>{ad.selling_angle || "Not classified"}</dd></div>
              <div><dt>Language</dt><dd>{ad.language}</dd></div>
              <div><dt>CTA</dt><dd>{ad.cta || "Not available"}</dd></div>
              <div><dt>First seen</dt><dd>{formatDate(ad.first_seen_at)}</dd></div>
            </dl>

            <div className="button-row">
              <a className="button button--primary" href={ad.source_url} target="_blank" rel="noreferrer">View original ad</a>
              {(ad.creative_url || ad.thumbnail_url) && (
                <a className="button button--download" href={`/api/ads/${encodeURIComponent(ad.id)}/download`} target="_blank" rel="noreferrer">Download creative</a>
              )}
              <Link className="button" href={`/brands/${ad.brand.slug}`}>More {ad.brand.name} ads</Link>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-ads" className="ad-page__related">
            <h2 id="related-ads">More inspiration like this</h2>
            <ul>
              {related.map((item) => (
                <li key={item.id}>
                  <Link href={`/ads/${item.id}`}>
                    {item.headline || item.hook || `${item.brand.name} ${item.format}`} — {item.brand.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
