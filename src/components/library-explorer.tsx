"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, SlidersHorizontal } from "lucide-react";
import { AdDetailDialog } from "@/components/ad-detail-dialog";
import { CreativePreview } from "@/components/creative-preview";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Ad } from "@/lib/types";

type SortOrder = "newest" | "oldest";

export function LibraryExplorer({ ads, demoMode }: { ads: Ad[]; demoMode: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(ads.map((ad) => ad.category))).sort()],
    [ads],
  );

  const visibleAds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ads
      .filter((ad) => category === "All" || ad.category === category)
      .filter((ad) => {
        if (!query) return true;
        return [ad.brand.name, ad.category, ad.format, ad.creative_style, ad.selling_angle, ad.hook, ad.headline, ad.language]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const delta = new Date(right.first_seen_at).getTime() - new Date(left.first_seen_at).getTime();
        return sortOrder === "newest" ? delta : -delta;
      });
  }, [ads, category, search, sortOrder]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".header-search input")?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <SiteHeader search={search} onSearch={setSearch} />
      <main className="shell">
        <section className="library-hero">
          <div className="library-hero__copy">
            <p className="eyebrow">India / food creative index</p>
            <h1 className="page-intro__heading">What food brands are putting into market.</h1>
            <p className="page-intro__description">
              A considered collection of live Indian food advertising. Browse the visual language, offers and hooks shaping the category.
            </p>
          </div>
          <div className="library-hero__stats" aria-label="Library summary">
            <div><strong>{ads.length}</strong><span>ads captured</span></div>
            <div><strong>{categories.length - 1}</strong><span>categories</span></div>
            <div><strong>Weekly</strong><span>new releases</span></div>
          </div>
          <div className="page-intro__meta">
            <p className="dataset-note">
              {visibleAds.length} {demoMode ? "demo" : "approved"} {visibleAds.length === 1 ? "ad" : "ads"}
            </p>
          </div>
        </section>

        <section className="filter-band" aria-label="Filter ads">
          <div className="filter-band__inner">
            <div className="filter-label"><SlidersHorizontal size={15} /> Filter by</div>
            <div className="filter-scroll">
              {categories.map((item) => (
                <button
                  className="filter-chip"
                  type="button"
                  key={item}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <label className="sort-control">
              <span className="sr-only">Sort ads</span>
              <select className="sort-select" value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <ChevronDown size={14} aria-hidden="true" />
            </label>
          </div>
        </section>

        <div className="result-line" aria-live="polite">
          <span className="result-line__title">Latest creative</span>
          <span>{visibleAds.length} results</span>
          {demoMode && <span>Sample records · connect Supabase for live data</span>}
        </div>

        {visibleAds.length ? (
          <section className="ad-grid" aria-label="Approved ads">
            {visibleAds.map((ad, index) => (
              <article className="ad-card" key={ad.id}>
                <div className="ad-card__media">
                  <CreativePreview ad={ad} priority={index === 0} />
                  <button className="ad-card__open" type="button" onClick={() => setSelectedAd(ad)}>
                    View creative <ArrowUpRight size={15} strokeWidth={1.8} />
                  </button>
                  <button
                    className="icon-button card-action"
                    type="button"
                    onClick={() => setSelectedAd(ad)}
                    aria-label={`View details for ${ad.brand.name} ad`}
                  >
                    <ArrowUpRight size={17} strokeWidth={1.8} />
                  </button>
                </div>
                <div className="ad-card__meta">
                  <h2 className="ad-card__brand">{ad.brand.name}</h2>
                  <span className="ad-card__date">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(ad.first_seen_at))}</span>
                  <p className="ad-card__tags"><span>{ad.creative_style || ad.format}</span><span>{ad.selling_angle || ad.hook || "Unclassified"}</span></p>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="empty-state">
            <h2>No ads match this filter.</h2>
            <p>Clear the search or choose another category.</p>
            <button className="button" type="button" onClick={() => { setSearch(""); setCategory("All"); }}>
              Clear filters
            </button>
          </section>
        )}
      </main>
      <SiteFooter />
      <AdDetailDialog ad={selectedAd} onClose={() => setSelectedAd(null)} />
    </>
  );
}
